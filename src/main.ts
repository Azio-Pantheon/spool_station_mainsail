import 'regenerator-runtime' // async polyfill used by the gcodeviewer
import 'resize-observer-polyfill' // polyfill needed by the responsive class detection
import Vue from 'vue'
import App from '@/App.vue'
import vuetify from '@/plugins/vuetify'
import i18n, { setAndLoadLocale } from '@/plugins/i18n'
import store from '@/store'
import { WebSocketPlugin } from '@/plugins/webSocketClient'
//vue-meta
import VueMeta from 'vue-meta'
//vue-toast-notifications
import VueToast from 'vue-toast-notification'
import 'vue-toast-notification/dist/theme-sugar.css'
import { defaultTheme } from './store/variables'

Vue.config.productionTip = false

Vue.use(VueMeta)

Vue.use(VueToast, {
    duration: 3000,
})

const initLoad = async () => {
    try {
        //load config.json
        const res = await fetch('/config.json')
        const file = (await res.json()) as Record<string, unknown>

        window.console.debug('Loaded config.json')

        await store.dispatch('importConfigJson', file)
        if ('defaultLocale' in file) {
            await setAndLoadLocale(file.defaultLocale as string)
        }

        // Handle theme outside of store init and before vue mount for consistency in dialog
        const theme = file.defaultTheme ?? defaultTheme
        vuetify.framework.theme.dark = theme !== 'light'
    } catch (e) {
        window.console.error('Failed to load config.json')
        window.console.error(e)
    }

    const url = store.getters['socket/getWebsocketUrl']
    Vue.use(WebSocketPlugin, { url, store })
    if (store?.state?.instancesDB === 'moonraker') Vue.$socket.connect()
}

initLoad().then(() =>
    new Vue({
        vuetify,
        store,
        i18n,
        render: (h) => h(App),
    }).$mount('#app')
)
