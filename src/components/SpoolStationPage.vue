<template>
    <div class="station-root" @click="onPageClick">
        <v-app-bar dense flat>
            <v-icon left color="primary">{{ mdiQrcodeScan }}</v-icon>
            <v-toolbar-title class="subtitle-1">Spool Station</v-toolbar-title>
            <v-spacer />
            <v-chip v-if="stationHostname" x-small outlined class="mr-2 d-none d-sm-flex">{{ stationHostname }}</v-chip>
            <v-chip x-small outlined :color="fleetConnected ? 'success' : 'error'" class="mr-2">
                {{ fleetConnected ? 'Fleet online' : 'Fleet offline' }}
            </v-chip>
            <v-btn icon small title="Fleet daemon URL" @click.stop="openSettings">
                <v-icon small>{{ mdiCog }}</v-icon>
            </v-btn>
        </v-app-bar>

        <v-container class="pa-4" style="max-width: 640px">
            <!-- Touch devices: visible scan box the user can tap to wake the keyboard -->
            <v-text-field
                v-if="isTouch"
                ref="scanInput"
                v-model="scanBuffer"
                label="Batch number (scan or type, then Enter)"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
                dense
                outlined
                hide-details
                class="mb-4"
                :prepend-inner-icon="mdiQrcodeScan"
                @input="onScanFieldInput"
                @keydown.enter="processScan"
                @focus="scanFocused = true"
                @blur="scanFocused = false" />
            <!-- Desktop: hidden scan input -->
            <input
                v-else
                ref="scanInput"
                v-model="scanBuffer"
                class="scan-hidden-input"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
                autofocus
                @input="onScanInput"
                @keydown.enter="processScan"
                @focus="scanFocused = true"
                @blur="scanFocused = false" />

            <v-alert v-if="localError" type="warning" dense text dismissible class="mb-4" @input="localError = ''">
                {{ localError }}
            </v-alert>

            <!-- Station state -->
            <v-card outlined class="mb-4" :class="stateCardClass">
                <v-card-text>
                    <template v-if="isBusy">
                        <div class="d-flex align-center">
                            <v-progress-circular indeterminate size="24" width="3" class="mr-3" />
                            <span class="subtitle-1">
                                {{ state === 'registering' ? 'Registering spool…' : 'Sending scan…' }}
                            </span>
                        </div>
                    </template>
                    <template v-else-if="state === 'awaiting_batch'">
                        <div class="subtitle-1">
                            QR
                            <code>{{ pendingQr }}</code>
                            armed — scan the batch number
                        </div>
                        <div class="d-flex align-center mt-2">
                            <v-chip small outlined :color="qrRemaining > 10 ? 'info' : 'warning'">
                                {{ qrRemaining }}s
                            </v-chip>
                            <span class="caption grey--text ml-2">until the QR expires</span>
                            <v-spacer />
                            <v-btn small text color="error" @click="cancel">Cancel</v-btn>
                        </div>
                    </template>
                    <template v-else>
                        <div class="subtitle-1">Ready</div>
                        <div class="body-2 grey--text">
                            Ready — scan a spool QR on the station scanner, then the batch number here
                        </div>
                    </template>
                    <p v-if="!isTouch" class="caption grey--text mt-2 mb-0">
                        {{
                            scanFocused
                                ? 'Listening for the batch number'
                                : 'Tap or click anywhere to listen for the batch number'
                        }}
                    </p>
                </v-card-text>
            </v-card>

            <!-- Filament preset -->
            <v-card outlined class="mb-4">
                <v-card-title class="subtitle-2 py-2">
                    Filament
                    <v-spacer />
                    <v-btn
                        icon
                        small
                        title="Reload filaments"
                        :loading="filamentsLoading"
                        @click.stop="refreshFilaments">
                        <v-icon small>{{ mdiRefresh }}</v-icon>
                    </v-btn>
                </v-card-title>
                <v-divider />
                <v-card-text class="pt-3">
                    <div class="d-flex align-center">
                        <div
                            v-if="filamentColor"
                            class="station-swatch mr-3 flex-shrink-0"
                            :style="{ backgroundColor: filamentColor }" />
                        <v-select
                            :value="filamentId"
                            :items="filamentItems"
                            label="Filament"
                            dense
                            outlined
                            hide-details
                            :disabled="filamentItems.length === 0"
                            :no-data-text="fleetConnected ? 'No filaments on the fleet daemon' : 'Fleet daemon offline'"
                            @change="onFilamentChange" />
                    </div>
                    <p class="caption grey--text mt-2 mb-0">
                        {{ filamentsCount }} filaments
                        <template v-if="fleetDaemonUrl">from {{ fleetDaemonUrl }}</template>
                    </p>
                </v-card-text>
            </v-card>

            <!-- Last result -->
            <v-alert v-if="lastResult" :type="lastResult.ok ? 'success' : 'error'" dense text class="mb-4">
                <div>{{ lastResult.message }}</div>
                <div v-if="lastResult.ok && lastResult.spool" class="caption mt-1">
                    Spool #{{ lastResult.spool.id }} · {{ lastResultFilamentName }} · lot
                    {{ lastResult.spool.lot_nr || '—' }} · {{ lastResultTime }}
                </div>
                <div v-else class="caption mt-1">{{ lastResultTime }}</div>
            </v-alert>
        </v-container>

        <spool-station-settings-dialog v-model="settingsOpen" />
    </div>
</template>

<script lang="ts">
/**
 * Spool Station page — the whole UI of the station Mainsail build.
 *
 * The station's Moonraker owns the state machine (server.spool_station.*):
 * the USB scanner on the Pi arms a spool QR, this page sends the batch number
 * scanned on the phone. Any Enter-terminated or burst input on this page is
 * taken as the batch number, no content checks. Scan input mechanics are the
 * ones of Scanner Lite's AddSpoolScanMode (hidden input + burst detector).
 */
import Component from 'vue-class-component'
import { Mixins, Watch } from 'vue-property-decorator'
import { mdiCog, mdiQrcodeScan, mdiRefresh } from '@mdi/js'
import BaseMixin from '@/components/mixins/base'
import SpoolStationSettingsDialog from '@/components/SpoolStationSettingsDialog.vue'
import { ScanBurstDetector, takeScanInput, resolveScanInputEl } from '@/plugins/scanBurstDetector'
import { isTouchDevice, warmScanKeyboard } from '@/plugins/scanFocus'
import { flashScreen } from '@/plugins/scanFlash'
import {
    SpoolStationFilament,
    SpoolStationLastResult,
    SpoolStationState,
    SpoolStationStatus,
} from '@/store/server/spoolStation/types'
import { SpoolStationFilamentItem } from '@/store/server/spoolStation/getters'

@Component({
    components: { SpoolStationSettingsDialog },
})
export default class SpoolStationPage extends Mixins(BaseMixin) {
    mdiCog = mdiCog
    mdiQrcodeScan = mdiQrcodeScan
    mdiRefresh = mdiRefresh

    scanBuffer = ''
    scanFocused = false
    scanFlash: 'success' | 'error' | null = null
    scanFlashTimer: ReturnType<typeof setTimeout> | null = null
    /** How long the result flash holds and scan input is ignored after a scan. */
    readonly SCAN_COOLDOWN_MS = 2000
    /** True while scan input is being swallowed after a scan. */
    scanCooldown = false
    /** Auto-submits scanner bursts that arrive without a trailing Enter (set in created). */
    scanBurst: ScanBurstDetector | null = null
    /** Transport-level error of the last phone scan (timeout, socket down); station results live in the store. */
    localError = ''

    settingsOpen = false

    /** Local clock for the QR countdown; ticks once a second while a QR is armed. */
    now = Date.now()
    tickTimer: ReturnType<typeof setInterval> | null = null

    created() {
        this.scanBurst = new ScanBurstDetector((value) => {
            this.scanBuffer = value
            this.processScan()
        })
    }

    mounted() {
        this.resetScanState()
        this.focusScanInput()
        // Poll the field so detection works even if no input events reach us
        this.scanBurst?.watch(() => resolveScanInputEl(this.$refs.scanInput)?.value ?? '')
    }

    beforeDestroy() {
        this.scanBurst?.unwatch()
        this.scanBurst?.reset()
        if (this.scanFlashTimer) clearTimeout(this.scanFlashTimer)
        this.stopTick()
    }

    // --- store ---

    get state(): SpoolStationState {
        return this.$store.state.server.spoolStation.state
    }

    get pendingQr(): string | null {
        return this.$store.state.server.spoolStation.pending_qr
    }

    get qrRemainingServer(): number {
        return this.$store.state.server.spoolStation.qr_remaining ?? 0
    }

    get statusReceivedAt(): number {
        return this.$store.state.server.spoolStation.status_received_at ?? 0
    }

    get filamentId(): number | null {
        return this.$store.state.server.spoolStation.filament_id
    }

    get filament(): SpoolStationFilament | null {
        return this.$store.state.server.spoolStation.filament
    }

    get lastResult(): SpoolStationLastResult | null {
        return this.$store.state.server.spoolStation.last_result
    }

    get fleetConnected(): boolean {
        return this.$store.state.server.spoolStation.fleet_connected ?? false
    }

    get fleetDaemonUrl(): string {
        return this.$store.state.server.spoolStation.fleet_daemon_url ?? ''
    }

    get stationHostname(): string {
        return this.$store.state.server.spoolStation.station_hostname ?? ''
    }

    get filamentsCount(): number {
        return this.$store.state.server.spoolStation.filaments_count ?? 0
    }

    get scanning(): boolean {
        return this.$store.state.server.spoolStation.scanning ?? false
    }

    get filamentItems(): SpoolStationFilamentItem[] {
        return this.$store.getters['server/spoolStation/getFilamentItems']
    }

    get filamentsLoading(): boolean {
        return this.loadings.includes('spoolStationFilaments')
    }

    // --- state ---

    get isTouch(): boolean {
        return isTouchDevice()
    }

    get isBusy(): boolean {
        return this.scanning || this.state === 'registering'
    }

    get stateCardClass(): Record<string, boolean> {
        return {
            'station-state--armed': this.state === 'awaiting_batch',
            'station-state--busy': this.isBusy,
        }
    }

    /** Seconds left on the armed QR, counted down locally from the server value at receive time. */
    get qrRemaining(): number {
        if (this.state !== 'awaiting_batch') return 0
        const elapsed = Math.max(0, Math.floor((this.now - this.statusReceivedAt) / 1000))
        return Math.max(0, this.qrRemainingServer - elapsed)
    }

    get filamentColor(): string | null {
        const filament =
            this.$store.getters['server/spoolStation/getFilamentById'](this.filamentId) ?? this.filament ?? null
        const hex = filament?.color_hex ?? null
        if (!hex) return null
        return hex.startsWith('#') ? hex : `#${hex}`
    }

    get lastResultFilamentName(): string {
        const spool = this.lastResult?.spool ?? null
        if (!spool) return '—'
        const filament: SpoolStationFilament | null =
            this.$store.getters['server/spoolStation/getFilamentById'](spool.filament_id) ?? null
        const vendor = filament?.vendor_name ?? spool.vendor_name ?? ''
        const name = filament?.name ?? spool.filament_name ?? ''
        return [vendor, name].filter(Boolean).join(' — ') || filament?.material || spool.material || '—'
    }

    get lastResultTime(): string {
        const at = this.lastResult?.at ?? null
        if (!at) return ''
        const date = new Date(at)
        if (Number.isNaN(date.getTime())) return ''
        return this.formatTime(date, true)
    }

    // --- countdown ---

    @Watch('state', { immediate: true })
    onStateChange(state: SpoolStationState) {
        if (state === 'awaiting_batch') this.startTick()
        else this.stopTick()
    }

    @Watch('statusReceivedAt')
    onStatusReceived() {
        this.now = Date.now()
    }

    startTick() {
        this.now = Date.now()
        if (this.tickTimer) return
        this.tickTimer = setInterval(() => {
            this.now = Date.now()
        }, 1000)
    }

    stopTick() {
        if (!this.tickTimer) return
        clearInterval(this.tickTimer)
        this.tickTimer = null
    }

    // --- scan input ---

    focusScanInput() {
        this.$nextTick(() => {
            const input = this.$refs.scanInput as { focus?: () => void } | undefined
            input?.focus?.()
        })
    }

    /**
     * Show the scan result and start the cooldown. The flash and the cooldown
     * are one window: input typed while it is active is ignored, and whatever
     * landed in the field is discarded when the window ends so a scanner
     * double-trigger cannot prefix the next scan.
     */
    flashScan(kind: 'success' | 'error') {
        flashScreen(kind, this.SCAN_COOLDOWN_MS)
        this.scanFlash = kind
        this.scanCooldown = true
        if (this.scanFlashTimer) clearTimeout(this.scanFlashTimer)
        this.scanFlashTimer = setTimeout(() => {
            this.scanFlash = null
            this.scanCooldown = false
            this.scanFlashTimer = null
            this.discardScanInput()
            this.focusScanInput()
        }, this.SCAN_COOLDOWN_MS)
    }

    /** Wipe the scan field, model and any pending burst without processing the value. */
    discardScanInput() {
        this.scanBurst?.reset()
        takeScanInput(this.$refs.scanInput, null)
        this.scanBuffer = ''
    }

    onScanInput(event: Event) {
        this.scanBurst?.onInput((event.target as HTMLInputElement).value)
    }

    onScanFieldInput(value: string) {
        this.scanBurst?.onInput(value)
    }

    resetScanState() {
        this.scanBurst?.reset()
        this.scanBuffer = ''
        this.localError = ''
        this.scanFlash = null
        this.scanCooldown = false
        if (this.scanFlashTimer) {
            clearTimeout(this.scanFlashTimer)
            this.scanFlashTimer = null
        }
    }

    /**
     * Tapping anywhere but a control starts listening for the batch number.
     * On phones the keyboard only opens when focus() runs synchronously inside
     * the tap, hence warmScanKeyboard() before moving focus to the scan field.
     */
    onPageClick(event: MouseEvent) {
        const target = event.target as HTMLElement | null
        // Don't steal focus from form inputs, selects, buttons or menus
        if (target?.closest('input, textarea, select, button, .v-input, .v-select, .v-btn, .v-menu')) return
        warmScanKeyboard() // synchronous, inside the tap gesture
        const input = this.$refs.scanInput as { focus?: () => void } | undefined
        input?.focus?.()
    }

    /**
     * Send whatever was scanned/typed as the batch number. Moonraker answers
     * with the new station status; its last_result decides the flash colour.
     * After any attempt input is accepted but ignored for SCAN_COOLDOWN_MS.
     */
    async processScan() {
        this.scanBurst?.reset()
        const scanned = takeScanInput(this.$refs.scanInput, this.scanBuffer)
        this.scanBuffer = ''
        // Cooldown: the field has already been consumed above, so the input is swallowed
        if (this.scanCooldown) return
        if (!scanned) return
        if (this.scanning) return

        this.localError = ''
        try {
            const status: SpoolStationStatus = await this.$store.dispatch('server/spoolStation/scan', {
                code: scanned,
                source: 'phone',
            })
            this.flashScan(status.last_result?.ok ? 'success' : 'error')
        } catch (err) {
            this.localError = (err as Error)?.message || 'Scan failed'
            this.flashScan('error')
        } finally {
            this.focusScanInput()
        }
    }

    // --- controls ---

    onFilamentChange(filamentId: number | null) {
        if (filamentId === this.filamentId) return
        this.$store.dispatch('server/spoolStation/selectFilament', filamentId)
    }

    refreshFilaments() {
        this.$store.dispatch('server/spoolStation/refreshFilaments')
    }

    cancel() {
        this.$store.dispatch('server/spoolStation/cancel')
    }

    openSettings() {
        this.settingsOpen = true
    }
}
</script>

<style scoped>
.station-root {
    min-height: var(--app-height, 100vh);
}
.scan-hidden-input {
    position: absolute;
    left: -9999px;
    opacity: 0;
    width: 1px;
    height: 1px;
}
.station-swatch {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.3);
}
.station-state--armed {
    border-color: var(--v-info-base, #2196f3) !important;
}
.station-state--busy {
    border-color: var(--v-warning-base, #ff8300) !important;
}
</style>
