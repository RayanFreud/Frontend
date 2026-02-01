// Settings Store - User preferences
import { defineStore } from 'pinia'

export interface UserSettings {
    theme: 'dark' | 'light' | 'system'
    videoQuality: 'low' | 'medium' | 'high' | 'auto'
    audioEchoCancellation: boolean
    audioNoiseSuppression: boolean
    audioAutoGainControl: boolean
    mirrorLocalVideo: boolean
    showParticipantNames: boolean
    notificationsEnabled: boolean
    notificationSound: boolean
    language: string
}

const DEFAULT_SETTINGS: UserSettings = {
    theme: 'dark',
    videoQuality: 'auto',
    audioEchoCancellation: true,
    audioNoiseSuppression: true,
    audioAutoGainControl: true,
    mirrorLocalVideo: true,
    showParticipantNames: true,
    notificationsEnabled: true,
    notificationSound: true,
    language: 'fr'
}

export const useSettingsStore = defineStore('settings', () => {
    // State
    const settings = ref<UserSettings>({ ...DEFAULT_SETTINGS })

    // Selected devices (persisted separately)
    const selectedCameraId = ref<string | null>(null)
    const selectedMicrophoneId = ref<string | null>(null)
    const selectedSpeakerId = ref<string | null>(null)

    /**
     * Initialize settings from localStorage
     */
    function init(): void {
        if (typeof window === 'undefined') return

        const saved = localStorage.getItem('truegather_settings')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                settings.value = { ...DEFAULT_SETTINGS, ...parsed }
            } catch (e) {
                console.error('[Settings] Failed to parse saved settings:', e)
            }
        }

        // Load device selections
        selectedCameraId.value = localStorage.getItem('truegather_camera') || null
        selectedMicrophoneId.value = localStorage.getItem('truegather_mic') || null
        selectedSpeakerId.value = localStorage.getItem('truegather_speaker') || null

        // Apply theme
        applyTheme()
    }

    /**
     * Save settings to localStorage
     */
    function save(): void {
        if (typeof window === 'undefined') return

        localStorage.setItem('truegather_settings', JSON.stringify(settings.value))

        if (selectedCameraId.value) {
            localStorage.setItem('truegather_camera', selectedCameraId.value)
        }
        if (selectedMicrophoneId.value) {
            localStorage.setItem('truegather_mic', selectedMicrophoneId.value)
        }
        if (selectedSpeakerId.value) {
            localStorage.setItem('truegather_speaker', selectedSpeakerId.value)
        }
    }

    /**
     * Update a setting
     */
    function updateSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]): void {
        settings.value[key] = value
        save()

        if (key === 'theme') {
            applyTheme()
        }
    }

    /**
     * Apply theme to document
     */
    function applyTheme(): void {
        if (typeof window === 'undefined') return

        const theme = settings.value.theme
        const html = document.documentElement

        if (theme === 'dark') {
            html.classList.add('dark')
        } else if (theme === 'light') {
            html.classList.remove('dark')
        } else {
            // System preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            if (prefersDark) {
                html.classList.add('dark')
            } else {
                html.classList.remove('dark')
            }
        }
    }

    /**
     * Reset to defaults
     */
    function reset(): void {
        settings.value = { ...DEFAULT_SETTINGS }
        selectedCameraId.value = null
        selectedMicrophoneId.value = null
        selectedSpeakerId.value = null
        save()
        applyTheme()
    }

    /**
     * Get video constraints based on quality setting
     */
    function getVideoConstraints(): MediaTrackConstraints {
        switch (settings.value.videoQuality) {
            case 'low':
                return { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } }
            case 'medium':
                return { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } }
            case 'high':
                return { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }
            default:
                return { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
        }
    }

    /**
     * Get audio constraints based on settings
     */
    function getAudioConstraints(): MediaTrackConstraints {
        return {
            echoCancellation: settings.value.audioEchoCancellation,
            noiseSuppression: settings.value.audioNoiseSuppression,
            autoGainControl: settings.value.audioAutoGainControl
        }
    }

    // Initialize on mount
    onMounted(() => {
        init()
    })

    return {
        settings: readonly(settings),
        selectedCameraId,
        selectedMicrophoneId,
        selectedSpeakerId,

        init,
        save,
        updateSetting,
        reset,
        getVideoConstraints,
        getAudioConstraints
    }
})
