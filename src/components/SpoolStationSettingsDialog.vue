<template>
    <v-dialog :value="value" max-width="420" @input="onDialogInput">
        <v-card>
            <v-card-title class="subtitle-1">Fleet daemon URL</v-card-title>
            <v-card-text>
                <v-text-field
                    v-model="url"
                    label="http://host:8090"
                    dense
                    outlined
                    hide-details
                    autocomplete="off"
                    autocapitalize="off"
                    spellcheck="false"
                    :disabled="saving"
                    @keydown.enter="save" />
                <p class="caption grey--text mt-2 mb-0">Active: {{ activeUrl || '—' }}</p>
                <v-alert v-if="error" type="error" dense text class="mt-3 mb-0">{{ error }}</v-alert>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn text :disabled="saving" @click="close">Cancel</v-btn>
                <v-btn color="primary" text :loading="saving" @click="save">Save</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script lang="ts">
/**
 * Settings dialog of the spool station page: the only setting is the
 * fleet_daemon URL, which Moonraker persists in its own database
 * (server.spool_station.post_config). No page reload is needed; the status
 * that comes back with the save updates the fleet chip on the page.
 */
import Component from 'vue-class-component'
import { Mixins, Prop, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'

@Component
export default class SpoolStationSettingsDialog extends Mixins(BaseMixin) {
    @Prop({ type: Boolean, default: false }) readonly value!: boolean

    url = ''
    error = ''

    get activeUrl(): string {
        return this.$store.state.server.spoolStation.fleet_daemon_url ?? ''
    }

    get saving(): boolean {
        return this.$store.state.server.spoolStation.saving_config ?? false
    }

    @Watch('value')
    onValueChange(open: boolean) {
        if (!open) return
        this.url = this.activeUrl
        this.error = ''
    }

    onDialogInput(open: boolean) {
        if (!open) this.close()
    }

    close() {
        if (this.saving) return
        this.$emit('input', false)
    }

    async save() {
        if (this.saving) return
        const url = this.url.trim().replace(/\/+$/, '')
        this.error = ''

        try {
            await this.$store.dispatch('server/spoolStation/saveConfig', { fleet_daemon_url: url })
            this.$emit('input', false)
            this.$toast.success('Fleet URL saved')
        } catch (err) {
            this.error = (err as Error)?.message || 'Failed to save the fleet URL'
        }
    }
}
</script>
