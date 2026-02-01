// Media Devices Composable

export interface MediaDevice {
    deviceId: string
    label: string
    kind: 'audioinput' | 'audiooutput' | 'videoinput'
}

export function useMediaDevices() {
    // State
    const cameras = ref<MediaDevice[]>([])
    const microphones = ref<MediaDevice[]>([])
    const speakers = ref<MediaDevice[]>([])

    const selectedCamera = ref<string | null>(null)
    const selectedMicrophone = ref<string | null>(null)
    const selectedSpeaker = ref<string | null>(null)

    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const hasPermissions = ref(false)

    /**
     * Request media permissions and enumerate devices
     */
    async function requestPermissions(): Promise<boolean> {
        isLoading.value = true
        error.value = null

        try {
            // Request permissions by getting a stream
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            })

            // Stop all tracks immediately
            stream.getTracks().forEach(track => track.stop())

            hasPermissions.value = true
            await enumerateDevices()

            return true
        } catch (err) {
            const e = err as Error
            console.error('[MediaDevices] Permission error:', e)
            error.value = e.name === 'NotAllowedError'
                ? 'Camera and microphone permissions denied'
                : e.message
            hasPermissions.value = false
            return false
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Enumerate all media devices
     */
    async function enumerateDevices(): Promise<void> {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices()

            cameras.value = devices
                .filter(d => d.kind === 'videoinput')
                .map(d => ({
                    deviceId: d.deviceId,
                    label: d.label || `Camera ${cameras.value.length + 1}`,
                    kind: d.kind as 'videoinput'
                }))

            microphones.value = devices
                .filter(d => d.kind === 'audioinput')
                .map(d => ({
                    deviceId: d.deviceId,
                    label: d.label || `Microphone ${microphones.value.length + 1}`,
                    kind: d.kind as 'audioinput'
                }))

            speakers.value = devices
                .filter(d => d.kind === 'audiooutput')
                .map(d => ({
                    deviceId: d.deviceId,
                    label: d.label || `Speaker ${speakers.value.length + 1}`,
                    kind: d.kind as 'audiooutput'
                }))

            // Set defaults if not selected
            if (!selectedCamera.value && cameras.value.length > 0) {
                selectedCamera.value = cameras.value[0].deviceId
            }
            if (!selectedMicrophone.value && microphones.value.length > 0) {
                selectedMicrophone.value = microphones.value[0].deviceId
            }
            if (!selectedSpeaker.value && speakers.value.length > 0) {
                selectedSpeaker.value = speakers.value[0].deviceId
            }

            console.log('[MediaDevices] Enumerated devices:', {
                cameras: cameras.value.length,
                microphones: microphones.value.length,
                speakers: speakers.value.length
            })
        } catch (err) {
            console.error('[MediaDevices] Enumeration error:', err)
            error.value = (err as Error).message
        }
    }

    /**
     * Get preview stream with selected devices
     */
    async function getPreviewStream(): Promise<MediaStream> {
        const constraints: MediaStreamConstraints = {
            audio: selectedMicrophone.value
                ? { deviceId: { exact: selectedMicrophone.value } }
                : true,
            video: selectedCamera.value
                ? { deviceId: { exact: selectedCamera.value } }
                : true
        }

        return await navigator.mediaDevices.getUserMedia(constraints)
    }

    /**
     * Get constraints for selected devices
     */
    function getConstraints(): MediaStreamConstraints {
        return {
            audio: selectedMicrophone.value
                ? {
                    deviceId: { exact: selectedMicrophone.value },
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
                : {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
            video: selectedCamera.value
                ? {
                    deviceId: { exact: selectedCamera.value },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }
                : {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }
        }
    }

    /**
     * Set audio output device
     */
    async function setAudioOutput(element: HTMLAudioElement | HTMLVideoElement): Promise<void> {
        if (!selectedSpeaker.value) return

        if ('setSinkId' in element) {
            try {
                await (element as any).setSinkId(selectedSpeaker.value)
                console.log('[MediaDevices] Set audio output to:', selectedSpeaker.value)
            } catch (err) {
                console.error('[MediaDevices] Failed to set audio output:', err)
            }
        }
    }

    /**
     * Check if screen sharing is supported
     */
    function isScreenShareSupported(): boolean {
        return 'getDisplayMedia' in navigator.mediaDevices
    }

    /**
     * Get screen share stream
     */
    async function getScreenShareStream(): Promise<MediaStream> {
        if (!isScreenShareSupported()) {
            throw new Error('Screen sharing not supported')
        }

        // Try to request audio with the display capture. Some browsers only allow tab audio
        // or may reject audio; if audio request fails, fall back to requesting video only.
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always' },
                audio: true
            })

            // If the returned stream has no audio tracks, that's fine — the caller can handle it.
            return stream
        } catch (err) {
            console.warn('[MediaDevices] getDisplayMedia with audio failed, falling back to video-only:', err)
            return await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always' },
                audio: false
            })
        }
    }

    // Listen for device changes
    onMounted(() => {
        navigator.mediaDevices.addEventListener('devicechange', enumerateDevices)
    })

    onUnmounted(() => {
        navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices)
    })

    return {
        // State
        cameras: readonly(cameras),
        microphones: readonly(microphones),
        speakers: readonly(speakers),
        selectedCamera,
        selectedMicrophone,
        selectedSpeaker,
        isLoading: readonly(isLoading),
        error: readonly(error),
        hasPermissions: readonly(hasPermissions),

        // Methods
        requestPermissions,
        enumerateDevices,
        getPreviewStream,
        getConstraints,
        setAudioOutput,
        isScreenShareSupported,
        getScreenShareStream
    }
}
