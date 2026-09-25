import Vue from 'vue'
import { ActionTree } from 'vuex'
import { RootState } from '@/store/types'
import {
    ServerSpoolStationState,
    SpoolStationConfigParams,
    SpoolStationScanParams,
    SpoolStationStatus,
} from '@/store/server/spoolStation/types'

/**
 * Moonraker answers server.spool_station.scan / post_config with the new status
 * dict (business outcomes never raise, see the plan). The websocket client only
 * dispatches the `{ action }` callback on a successful JSON-RPC result, so a
 * malformed request or a dropped socket would leave the caller hanging. Each
 * request therefore keeps one module-scope pending resolver that the callback
 * action settles, guarded by a timeout.
 */
const RESPONSE_TIMEOUT_MS = 15000

interface PendingRequest {
    resolve: (status: SpoolStationStatus) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
}

let pendingScan: PendingRequest | null = null
let pendingConfig: PendingRequest | null = null

function createPending(
    slot: 'scan' | 'config',
    timeoutMessage: string,
    onTimeout: () => void
): Promise<SpoolStationStatus> {
    return new Promise<SpoolStationStatus>((resolve, reject) => {
        // a newer request supersedes an older one that never got its answer
        const previous = slot === 'scan' ? pendingScan : pendingConfig
        if (previous) {
            clearTimeout(previous.timer)
            previous.reject(new Error('Superseded by a newer request'))
        }

        const timer = setTimeout(() => {
            if (slot === 'scan') pendingScan = null
            else pendingConfig = null
            onTimeout()
            reject(new Error(timeoutMessage))
        }, RESPONSE_TIMEOUT_MS)

        const pending: PendingRequest = { resolve, reject, timer }
        if (slot === 'scan') pendingScan = pending
        else pendingConfig = pending
    })
}

function settlePending(slot: 'scan' | 'config', status: SpoolStationStatus | null, error?: Error): void {
    const pending = slot === 'scan' ? pendingScan : pendingConfig
    if (!pending) return
    clearTimeout(pending.timer)
    if (slot === 'scan') pendingScan = null
    else pendingConfig = null
    if (status) pending.resolve(status)
    else pending.reject(error ?? new Error('Invalid response'))
}

function stripRequestParams<T>(payload: T): T {
    if (payload && typeof payload === 'object' && 'requestParams' in payload) {
        delete (payload as { requestParams?: unknown }).requestParams
    }
    return payload
}

function isStatus(payload: unknown): payload is SpoolStationStatus {
    return payload !== null && typeof payload === 'object' && 'state' in (payload as object)
}

export const actions: ActionTree<ServerSpoolStationState, RootState> = {
    reset({ commit }) {
        settlePending('scan', null, new Error('Store reset'))
        settlePending('config', null, new Error('Store reset'))
        commit('reset')
    },

    init({ dispatch }) {
        Vue.$socket.emit('server.spool_station.status', {}, { action: 'server/spoolStation/getStatus' })
        Vue.$socket.emit('server.spool_station.filaments', {}, { action: 'server/spoolStation/getFilaments' })

        dispatch('socket/addInitModule', 'server/spoolStation/getStatus', { root: true })
        dispatch('socket/addInitModule', 'server/spoolStation/getFilaments', { root: true })

        dispatch('socket/removeInitModule', 'server/spoolStation/init', { root: true })
    },

    getStatus({ commit, dispatch }, payload) {
        payload = stripRequestParams(payload)
        dispatch('socket/removeInitModule', 'server/spoolStation/getStatus', { root: true })

        if (!isStatus(payload)) return
        commit('setStatus', payload)
    },

    getFilaments({ commit, dispatch }, payload) {
        payload = stripRequestParams(payload)
        dispatch('socket/removeInitModule', 'server/spoolStation/getFilaments', { root: true })
        dispatch('socket/removeLoading', 'spoolStationFilaments', { root: true })

        commit('setFilaments', payload?.filaments ?? [])
    },

    onStatusNotification({ commit }, payload) {
        if (!isStatus(payload)) return
        commit('setStatus', payload)
    },

    refreshStatus() {
        Vue.$socket.emit('server.spool_station.status', {}, { action: 'server/spoolStation/getStatus' })
    },

    refreshFilaments({ dispatch }) {
        dispatch('socket/addLoading', 'spoolStationFilaments', { root: true })
        Vue.$socket.emit(
            'server.spool_station.filaments',
            { refresh: 1 },
            { action: 'server/spoolStation/getFilaments' }
        )
    },

    selectFilament(_, filament_id: number | null) {
        Vue.$socket.emit(
            'server.spool_station.post_filament',
            { filament_id },
            { action: 'server/spoolStation/getStatus' }
        )
    },

    cancel() {
        Vue.$socket.emit('server.spool_station.cancel', {}, { action: 'server/spoolStation/getStatus' })
    },

    /**
     * Send a phone-side scan (the batch number) and resolve with the status
     * Moonraker returns for it. Rejects on timeout or when the socket is down.
     */
    scan({ commit, rootState }, payload: SpoolStationScanParams): Promise<SpoolStationStatus> {
        const code = (payload?.code ?? '').trim()
        const source = payload?.source ?? 'phone'
        if (!code) return Promise.reject(new Error('Nothing scanned'))
        if (!rootState.socket?.isConnected) return Promise.reject(new Error('Not connected to Moonraker'))

        const promise = createPending('scan', 'No answer from the station (timeout)', () => {
            commit('setScanning', false)
        })
        commit('setScanning', true)
        Vue.$socket.emit(
            'server.spool_station.scan',
            { code, source },
            { action: 'server/spoolStation/onScanResponse' }
        )
        return promise
    },

    onScanResponse({ commit }, payload) {
        payload = stripRequestParams(payload)
        commit('setScanning', false)

        if (!isStatus(payload)) {
            settlePending('scan', null, new Error('Unexpected scan response'))
            return
        }

        commit('setStatus', payload)
        settlePending('scan', payload)
    },

    /** Persist a new fleet_daemon URL on the station; resolves with the resulting status. */
    saveConfig({ commit, rootState }, payload: SpoolStationConfigParams): Promise<SpoolStationStatus> {
        const fleet_daemon_url = (payload?.fleet_daemon_url ?? '').trim()
        if (!rootState.socket?.isConnected) return Promise.reject(new Error('Not connected to Moonraker'))

        const promise = createPending('config', 'No answer from the station (timeout)', () => {
            commit('setSavingConfig', false)
        })
        commit('setSavingConfig', true)
        Vue.$socket.emit(
            'server.spool_station.post_config',
            { fleet_daemon_url },
            { action: 'server/spoolStation/onConfigSaved' }
        )
        return promise
    },

    onConfigSaved({ commit }, payload) {
        payload = stripRequestParams(payload)
        commit('setSavingConfig', false)

        // post_config answers with the config shape ({fleet_daemon_url, fleet_daemon_url_source,
        // station_hostname, qr_timeout, ...}), not the status dict; the fleet_connected flip
        // arrives through notify_spool_station_status once the component has re-probed.
        const isConfig = payload && typeof payload === 'object' && 'fleet_daemon_url' in payload
        if (isConfig) {
            commit('setConfig', {
                fleet_daemon_url: payload.fleet_daemon_url,
                fleet_connected: payload.fleet_connected,
            })
        }

        if (isStatus(payload)) commit('setStatus', payload)

        if (!isConfig && !isStatus(payload)) {
            settlePending('config', null, new Error('Unexpected config response'))
            return
        }

        settlePending('config', payload)
    },
}
