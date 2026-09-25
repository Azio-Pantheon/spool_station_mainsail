import { getDefaultState } from './index'
import { MutationTree } from 'vuex'
import { ServerSpoolStationState, SpoolStationFilament, SpoolStationStatus } from './types'
import Vue from 'vue'

export const mutations: MutationTree<ServerSpoolStationState> = {
    reset(state) {
        Object.assign(state, getDefaultState())
    },

    setStatus(state, payload: SpoolStationStatus) {
        Vue.set(state, 'state', payload.state ?? 'idle')
        Vue.set(state, 'pending_qr', payload.pending_qr ?? null)
        Vue.set(state, 'qr_scanned_at', payload.qr_scanned_at ?? null)
        Vue.set(state, 'qr_expires_at', payload.qr_expires_at ?? null)
        Vue.set(state, 'qr_remaining', Number(payload.qr_remaining ?? 0))
        Vue.set(state, 'qr_timeout', Number(payload.qr_timeout ?? 120))
        Vue.set(state, 'filament_id', payload.filament_id ?? null)
        Vue.set(state, 'filament', payload.filament ?? null)
        Vue.set(state, 'last_result', payload.last_result ?? null)
        Vue.set(state, 'fleet_connected', payload.fleet_connected ?? false)
        Vue.set(state, 'fleet_daemon_url', payload.fleet_daemon_url ?? '')
        Vue.set(state, 'station_hostname', payload.station_hostname ?? '')
        Vue.set(state, 'filaments_count', Number(payload.filaments_count ?? 0))
        Vue.set(state, 'status_received_at', Date.now())
    },

    setFilaments(state, payload: SpoolStationFilament[]) {
        Vue.set(state, 'filaments', Array.isArray(payload) ? payload : [])
    },

    setConfig(state, payload: { fleet_daemon_url?: string; fleet_connected?: boolean }) {
        if (typeof payload.fleet_daemon_url === 'string') Vue.set(state, 'fleet_daemon_url', payload.fleet_daemon_url)
        if (typeof payload.fleet_connected === 'boolean') Vue.set(state, 'fleet_connected', payload.fleet_connected)
    },

    setScanning(state, payload: boolean) {
        Vue.set(state, 'scanning', payload)
    },

    setSavingConfig(state, payload: boolean) {
        Vue.set(state, 'saving_config', payload)
    },
}
