/**
 * Whole-screen result flash for the scanning modes.
 *
 * Every scan in Scanner Lite (and the same modes inside the full app) flashes
 * the entire viewport green on success and red on failure, regardless of what
 * the mode's own layout looks like. A single fixed overlay is appended to
 * <body> above every Vuetify dialog; it never takes pointer events, so the
 * scan input keeps focus and the next scan is not blocked.
 *
 * Usage: `flashScreen('success')` / `flashScreen('error')` right where the
 * mode decides the outcome of a scan.
 */

export type ScanFlashKind = 'success' | 'error'

const FLASH_ID = 'scan-screen-flash'
const COLORS: Record<ScanFlashKind, string> = {
    success: '#2E7D32',
    error: '#C62828',
}

let hideTimer: ReturnType<typeof setTimeout> | null = null

function getOverlay(): HTMLDivElement | null {
    if (typeof document === 'undefined') return null
    let el = document.getElementById(FLASH_ID) as HTMLDivElement | null
    if (!el) {
        el = document.createElement('div')
        el.id = FLASH_ID
        el.setAttribute('aria-hidden', 'true')
        Object.assign(el.style, {
            position: 'fixed',
            top: '0',
            right: '0',
            bottom: '0',
            left: '0',
            zIndex: '100000',
            pointerEvents: 'none',
            opacity: '0',
            transition: 'opacity 0.5s ease',
        } as Partial<CSSStyleDeclaration>)
        document.body.appendChild(el)
    }
    return el
}

/**
 * Flash the whole screen. `holdMs` is how long the colour stays solid before
 * it fades out; a new flash cancels the previous one immediately.
 */
export function flashScreen(kind: ScanFlashKind, holdMs = 600): void {
    const el = getOverlay()
    if (!el) return
    if (hideTimer) {
        clearTimeout(hideTimer)
        hideTimer = null
    }
    el.style.transition = 'none'
    el.style.background = COLORS[kind]
    el.style.opacity = '0.92'
    // Force a style flush so the fade-out transition below actually animates
    void el.offsetWidth
    el.style.transition = 'opacity 0.5s ease'
    hideTimer = setTimeout(() => {
        el.style.opacity = '0'
        hideTimer = null
    }, holdMs)
}
