<template>
    <v-app :style="cssVars">
        <template v-if="socketIsConnected && guiIsReady">
            <spool-station-page />
            <the-service-worker />
        </template>
        <the-connecting-dialog v-else />
    </v-app>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import TheConnectingDialog from '@/components/TheConnectingDialog.vue'
import TheServiceWorker from '@/components/TheServiceWorker.vue'
import SpoolStationPage from '@/components/SpoolStationPage.vue'
import { panelToolbarHeight, topbarHeight, navigationItemHeight } from '@/store/variables'
import { setAndLoadLocale } from './plugins/i18n'

Component.registerHooks(['metaInfo'])

@Component({
    components: {
        TheConnectingDialog,
        TheServiceWorker,
        SpoolStationPage,
    },
})
export default class App extends Mixins(BaseMixin) {
    public metaInfo(): any {
        return {
            title: 'Spool Station',
            titleTemplate: '%s',
        }
    }

    get customStylesheet() {
        return this.$store.getters['files/getCustomStylesheet']
    }

    get language(): string {
        return this.$store.state.gui.general.language
    }

    get theme(): string {
        return this.$store.state.gui.uiSettings.theme
    }

    get primaryColor(): string {
        return this.$store.state.gui.uiSettings.primary
    }

    get warningColor(): string {
        return this.$vuetify?.theme?.currentTheme?.warning?.toString() ?? '#ff8300'
    }

    get primaryTextColor(): string {
        let splits = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(this.primaryColor)
        if (splits) {
            const r = parseInt(splits[1], 16) * 0.2126
            const g = parseInt(splits[2], 16) * 0.7152
            const b = parseInt(splits[3], 16) * 0.0722
            const perceivedLightness = (r + g + b) / 255

            return perceivedLightness > 0.7 ? '#222' : '#fff'
        }

        return '#ffffff'
    }

    get cssVars(): { [key: string]: string } {
        return {
            '--v-btn-text-primary': this.primaryTextColor,
            '--color-primary': this.primaryColor,
            '--color-warning': this.warningColor,
            '--panel-toolbar-icon-btn-width': panelToolbarHeight + 'px',
            '--panel-toolbar-text-btn-height': panelToolbarHeight + 'px',
            '--topbar-icon-btn-width': topbarHeight + 'px',
            '--sidebar-menu-item-height': navigationItemHeight + 'px',
        }
    }

    @Watch('language')
    async languageChanged(newVal: string): Promise<void> {
        await setAndLoadLocale(newVal)
    }

    @Watch('customStylesheet')
    customStylesheetChanged(newVal: string | null): void {
        const style = document.getElementById('customStylesheet')
        if (newVal !== null && style === null) {
            const newStyle = document.createElement('link')
            newStyle.id = 'customStylesheet'
            newStyle.type = 'text/css'
            newStyle.rel = 'stylesheet'
            newStyle.href = newVal
            document.head.appendChild(newStyle)
        } else if (newVal !== null && style) {
            style.setAttribute('href', newVal)
        } else if (style) style.remove()
    }

    @Watch('primaryColor')
    primaryColorChanged(newVal: string): void {
        this.$nextTick(() => {
            this.$vuetify.theme.currentTheme.primary = newVal
        })
    }

    @Watch('theme')
    themeChanged(newVal: string): void {
        const dark = newVal !== 'light'
        this.$vuetify.theme.dark = dark

        const doc = document.documentElement
        doc.className = dark ? 'theme--dark' : 'theme--light'
    }

    appHeight() {
        this.$nextTick(() => {
            const doc = document.documentElement
            doc.style.setProperty('--app-height', window.innerHeight + 'px')
        })
    }

    mounted(): void {
        this.appHeight()
        window.addEventListener('resize', this.appHeight)
        window.addEventListener('orientationchange', this.appHeight)
    }
}
</script>

<style>
@import './assets/styles/fonts.css';
@import './assets/styles/toastr.css';
@import './assets/styles/page.css';
@import './assets/styles/sidebar.css';
@import './assets/styles/utils.css';
@import './assets/styles/updateManager.css';

:root {
    --app-height: 100%;
}

#content {
    background-attachment: fixed;
    background-size: cover;
    background-repeat: no-repeat;
}

/*noinspection CssUnusedSymbol*/
.v-btn:not(.v-btn--outlined).primary {
    /*noinspection CssUnresolvedCustomProperty*/
    color: var(--v-btn-text-primary);
}
</style>
