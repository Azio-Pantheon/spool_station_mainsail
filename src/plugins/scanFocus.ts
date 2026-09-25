/**
 * Mobile keyboard warm-up for keyboard-wedge scanner input.
 *
 * Mobile browsers only raise the soft keyboard (and the IME a scanner phone
 * injects keystrokes through) when `focus()` runs synchronously inside a real
 * touch/click handler. Our scan inputs live inside lazily-rendered Vuetify
 * dialogs, so they cannot be focused until a tick after the tap has ended and
 * the keyboard never opens.
 *
 * Workaround: focus a persistent off-screen input synchronously in the tap,
 * which opens the keyboard. Moving focus to the real scan input afterwards
 * keeps the keyboard open.
 *
 * Call `warmScanKeyboard()` as the FIRST statement of the click handler that
 * opens a scanning mode. It is a no-op on non-touch devices.
 */

const WARMUP_ID = 'scan-keyboard-warmup'

function getWarmupInput(): HTMLInputElement {
    let el = document.getElementById(WARMUP_ID) as HTMLInputElement | null
    if (!el) {
        el = document.createElement('input')
        el.id = WARMUP_ID
        el.type = 'text'
        el.autocomplete = 'off'
        el.setAttribute('aria-hidden', 'true')
        el.tabIndex = -1
        Object.assign(el.style, {
            position: 'fixed',
            left: '-9999px',
            top: '0',
            width: '1px',
            height: '1px',
            opacity: '0',
        } as Partial<CSSStyleDeclaration>)
        document.body.appendChild(el)
    }
    return el
}

export function isTouchDevice(): boolean {
    return typeof window !== 'undefined' && 'ontouchstart' in window
}

export function warmScanKeyboard(): void {
    if (!isTouchDevice()) return
    try {
        getWarmupInput().focus({ preventScroll: true })
    } catch {
        /* ignore */
    }
}
