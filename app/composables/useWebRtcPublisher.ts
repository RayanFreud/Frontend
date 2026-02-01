// WebRTC Publisher Composable
import type { PublishAnswerPayload, SignalingMessage } from '~/types'

export interface PublisherState {
    isInitialized: boolean
    isPublishing: boolean
    isMuted: boolean
    isVideoOff: boolean
    localStream: MediaStream | null
}

export function useWebRtcPublisher() {
    // State
    const pc = ref<RTCPeerConnection | null>(null)
    const localStream = ref<MediaStream | null>(null)
    const isInitialized = ref(false)
    const isPublishing = ref(false)
    const isMuted = ref(false)
    const isVideoOff = ref(false)

    // Event callbacks
    let onIceCandidateCallback: ((candidate: RTCIceCandidate) => void) | null = null
    let onConnectionStateChangeCallback: ((state: RTCPeerConnectionState) => void) | null = null

    /**
     * Initialize RTCPeerConnection
     */
    function initialize(iceServers: RTCIceServer[]): void {
        if (pc.value) {
            pc.value.close()
        }

        pc.value = new RTCPeerConnection({
            iceServers,
            iceCandidatePoolSize: 10
        })

        // ICE candidate handler
        pc.value.onicecandidate = (event) => {
            if (event.candidate && onIceCandidateCallback) {
                onIceCandidateCallback(event.candidate)
            }
        }

        // Connection state handler
        pc.value.onconnectionstatechange = () => {
            const state = pc.value?.connectionState
            console.log('[WebRTC Publisher] Connection state:', state)

            if (state && onConnectionStateChangeCallback) {
                onConnectionStateChangeCallback(state)
            }

            if (state === 'connected') {
                isPublishing.value = true
            } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                isPublishing.value = false
            }
        }

        // ICE connection state handler
        pc.value.oniceconnectionstatechange = () => {
            console.log('[WebRTC Publisher] ICE connection state:', pc.value?.iceConnectionState)
        }

        isInitialized.value = true
        console.log('[WebRTC Publisher] Initialized with ICE servers:', iceServers)
    }

    /**
     * Start capturing local media
     */
    async function startCapture(constraints?: MediaStreamConstraints): Promise<MediaStream> {
        const defaultConstraints: MediaStreamConstraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            }
        }

        const mergedConstraints = { ...defaultConstraints, ...constraints }

        try {
            localStream.value = await navigator.mediaDevices.getUserMedia(mergedConstraints)
            console.log('[WebRTC Publisher] Media capture started')
            return localStream.value
        } catch (error) {
            console.error('[WebRTC Publisher] Failed to capture media:', error)
            throw error
        }
    }

    /**
     * Add local tracks to peer connection
     */
    function addTracks(): void {
        if (!pc.value || !localStream.value) {
            throw new Error('PeerConnection or stream not initialized')
        }

        // ✅ CHANGED: prevent duplicate tracks if addTracks() called twice
        const existingKinds = new Set(
            pc.value.getSenders().map(s => s.track?.kind).filter(Boolean) as string[]
        )

        localStream.value.getTracks().forEach(track => {
            if (existingKinds.has(track.kind)) {
                console.log('[WebRTC Publisher] Track already added, skipping:', track.kind)
                return
            }
            pc.value!.addTrack(track, localStream.value!)
            console.log('[WebRTC Publisher] Added track:', track.kind, 'id:', track.id, 'label:', track.label)
            if (track.kind === 'audio') {
                console.log('[WebRTC Publisher] Audio track published (microphone):', { id: track.id, label: track.label })
            }
        })

        // ✅ CHANGED: debug log of senders
        console.log(
            '[WebRTC Publisher] Senders after addTracks:',
            pc.value.getSenders().map(s => s.track?.kind)
        )
    }

    /**
     * Create and return SDP offer
     */
    async function createOffer(): Promise<RTCSessionDescriptionInit> {
        if (!pc.value) {
            throw new Error('PeerConnection not initialized')
        }

        // ✅ CHANGED: warn (and fail fast) if no tracks were added before offer
        const senderKinds = pc.value.getSenders().map(s => s.track?.kind).filter(Boolean)
        console.log('[WebRTC Publisher] Senders before offer:', senderKinds) // ✅ CHANGED

        if (senderKinds.length === 0) {
            throw new Error('No media tracks added. Call startCapture() + addTracks() BEFORE createOffer().') // ✅ CHANGED
        }

        // ✅ CHANGED: don't force offerToReceiveAudio/Video; let WebRTC build SDP based on tracks
        const offer = await pc.value.createOffer()

        await pc.value.setLocalDescription(offer)
        console.log('[WebRTC Publisher] Created offer')

        return offer
    }

    /**
     * Set remote SDP answer
     */
    async function setAnswer(sdp: string): Promise<void> {
        if (!pc.value) {
            throw new Error('PeerConnection not initialized')
        }

        const answer: RTCSessionDescriptionInit = {
            type: 'answer',
            sdp
        }

        await pc.value.setRemoteDescription(answer)
        console.log('[WebRTC Publisher] Set remote answer')
    }

    /**
     * Add ICE candidate
     */
    async function addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
        if (!pc.value) {
            throw new Error('PeerConnection not initialized')
        }

        await pc.value.addIceCandidate(new RTCIceCandidate(candidate))
        console.log('[WebRTC Publisher] Added ICE candidate')
    }

    /**
     * Toggle audio mute
     */
    function toggleMute(): boolean {
        if (!localStream.value) return isMuted.value

        const audioTracks = localStream.value.getAudioTracks()
        audioTracks.forEach(track => {
            track.enabled = !track.enabled
        })

        isMuted.value = !isMuted.value
        console.log('[WebRTC Publisher] Muted:', isMuted.value)
        return isMuted.value
    }

    /**
     * Toggle video
     */
    function toggleVideo(): boolean {
        if (!localStream.value) return isVideoOff.value

        const videoTracks = localStream.value.getVideoTracks()
        videoTracks.forEach(track => {
            track.enabled = !track.enabled
        })

        isVideoOff.value = !isVideoOff.value
        console.log('[WebRTC Publisher] Video off:', isVideoOff.value)
        return isVideoOff.value
    }

    /**
     * Replace track (e.g., for screen sharing)
     */
    async function replaceTrack(newTrack: MediaStreamTrack): Promise<{ replacedExisting: boolean; addedNew: boolean }> {
        if (!pc.value) {
            throw new Error('PeerConnection not initialized')
        }

        const senders = pc.value.getSenders()
        const sender = senders.find(s => s.track?.kind === newTrack.kind)

        if (sender) {
            await sender.replaceTrack(newTrack)
            console.log('[WebRTC Publisher] Replaced track:', newTrack.kind, 'id:', newTrack.id, 'label:', newTrack.label)
            return { replacedExisting: true, addedNew: false }
        } else {
            // No existing sender for this kind — add the track as a new sender
            const tmpStream = new MediaStream([newTrack])
            pc.value.addTrack(newTrack, tmpStream)
            console.log('[WebRTC Publisher] Added track (no existing sender):', newTrack.kind, 'id:', newTrack.id)
            console.warn('[WebRTC Publisher] Added new sender; renegotiation may be required for peers to receive this track')
            return { replacedExisting: false, addedNew: true }
        }
    }

    /**
     * Set callback for ICE candidates
     */
    function onIceCandidate(callback: (candidate: RTCIceCandidate) => void): void {
        onIceCandidateCallback = callback
    }

    /**
     * Set callback for connection state changes
     */
    function onConnectionStateChange(callback: (state: RTCPeerConnectionState) => void): void {
        onConnectionStateChangeCallback = callback
    }

    /**
     * Get connection statistics
     */
    async function getStats(): Promise<RTCStatsReport | null> {
        if (!pc.value) return null
        return await pc.value.getStats()
    }

    /**
     * Stop publishing and cleanup
     */
    function stop(): void {
        // Stop all local tracks
        if (localStream.value) {
            localStream.value.getTracks().forEach(track => {
                track.stop()
            })
            localStream.value = null
        }

        // Close peer connection
        if (pc.value) {
            pc.value.close()
            pc.value = null
        }

        isInitialized.value = false
        isPublishing.value = false
        isMuted.value = false
        isVideoOff.value = false
        onIceCandidateCallback = null
        onConnectionStateChangeCallback = null

        console.log('[WebRTC Publisher] Stopped')
    }

    // NOTE: Cleanup is now managed explicitly by the RoomStore (leaveRoom / cleanup).
    // Removing composable-level onUnmounted hook prevents unintentional stop() being called
    // during hot-reload or when the composable is used outside of a component setup context.
    // (No automatic cleanup here.)

    return {
        // State
        localStream: readonly(localStream),
        isInitialized: readonly(isInitialized),
        isPublishing: readonly(isPublishing),
        isMuted: readonly(isMuted),
        isVideoOff: readonly(isVideoOff),

        // Methods
        initialize,
        startCapture,
        addTracks,
        createOffer,
        setAnswer,
        addIceCandidate,
        toggleMute,
        toggleVideo,
        replaceTrack,
        onIceCandidate,
        onConnectionStateChange,
        getStats,
        stop
    }
}
