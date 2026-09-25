import { Module } from 'vuex'
import { ServerSpoolStationState } from '@/store/server/spoolStation/types'
import { actions } from '@/store/server/spoolStation/actions'
import { mutations } from '@/store/server/spoolStation/mutations'
import { getters } from '@/store/server/spoolStation/getters'

export const getDefaultState = (): ServerSpoolStationState => {
    return {
        state: 'idle',
        pending_qr: null,
        qr_scanned_at: null,
        qr_expires_at: null,
        qr_remaining: 0,
        qr_timeout: 120,
        filament_id: null,
        filament: null,
        last_result: null,
        fleet_connected: false,
        fleet_daemon_url: '',
        station_hostname: '',
        filaments_count: 0,
        filaments: [],
        status_received_at: 0,
        scanning: false,
        saving_config: false,
    }
}

// initial state
const state = getDefaultState()

// eslint-disable-next-line
export const spoolStation: Module<ServerSpoolStationState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
