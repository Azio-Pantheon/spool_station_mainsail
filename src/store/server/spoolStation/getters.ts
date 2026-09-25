import { GetterTree } from 'vuex'
import { ServerSpoolStationState, SpoolStationFilament } from './types'

export interface SpoolStationFilamentItem {
    text: string
    value: number
}

// eslint-disable-next-line
export const getters: GetterTree<ServerSpoolStationState, any> = {
    getFilamentItems: (state): SpoolStationFilamentItem[] => {
        return state.filaments.map((f) => {
            const vendor = f.vendor_name || ''
            const name = f.name || ''
            const label = [vendor, name, `(${f.material})`].filter(Boolean).join(' — ')
            return { text: `#${f.id} ${label}`, value: f.id }
        })
    },

    getFilamentById:
        (state) =>
        (id: number | null | undefined): SpoolStationFilament | null => {
            if (id === null || id === undefined) return null
            const found = state.filaments.find((f) => f.id === id)
            if (found) return found
            if (state.filament && state.filament.id === id) return state.filament
            return null
        },
}
