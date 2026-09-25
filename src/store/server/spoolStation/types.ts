export type SpoolStationState = 'idle' | 'awaiting_batch' | 'registering'

export type SpoolStationResultKind = 'qr' | 'batch' | 'register'

export interface SpoolStationFilament {
    id: number
    name: string
    material: string
    vendor_name: string | null
    color_hex: string | null
    weight?: number | null
    spool_weight?: number | null
    [key: string]: unknown
}

export interface SpoolStationSpool {
    id: number
    qr_code?: string | null
    lot_nr?: string | null
    filament_id?: number | null
    filament_name?: string | null
    vendor_name?: string | null
    material?: string | null
    [key: string]: unknown
}

export interface SpoolStationLastResult {
    ok: boolean
    kind: SpoolStationResultKind
    message: string
    spool: SpoolStationSpool | null
    at: string
}

/** Status payload returned by every server.spool_station.* handler and pushed as notify_spool_station_status. */
export interface SpoolStationStatus {
    state: SpoolStationState
    pending_qr: string | null
    qr_scanned_at: string | null
    qr_expires_at: string | null
    qr_remaining: number
    qr_timeout: number
    filament_id: number | null
    filament: SpoolStationFilament | null
    last_result: SpoolStationLastResult | null
    fleet_connected: boolean
    fleet_daemon_url: string
    station_hostname: string
    filaments_count: number
}

export interface ServerSpoolStationState extends SpoolStationStatus {
    filaments: SpoolStationFilament[]
    /** Date.now() when the current status was committed; clients count qr_remaining down from here. */
    status_received_at: number
    /** True while a phone scan round trip is in flight. */
    scanning: boolean
    /** True while a fleet URL save round trip is in flight. */
    saving_config: boolean
}

export interface SpoolStationScanParams {
    code: string
    source?: 'phone' | 'scanner'
}

export interface SpoolStationConfigParams {
    fleet_daemon_url: string
}
