// WebRTC Subscriber Composable

export interface Subscription {
    feedId: string
    pc: RTCPeerConnection
    remoteStream: MediaStream | null
    display: string
    userId: string
}

export function useWebRtcSubscriber() {
    // State - map of feed_id to subscription
    const subscriptions = ref<Map<string, Subscription>>(new Map())

    // ICE servers (set during initialization)
    let iceServers: RTCIceServer[] = []

    // Event callbacks
    let onRemoteStreamCallback: ((feedId: string, stream: MediaStream) => void) | null = null
    let onIceCandidateCallback: ((feedId: string, candidate: RTCIceCandidate) => void) | null = null
    let onConnectionStateChangeCallback: ((feedId: string, state: RTCPeerConnectionState) => void) | null = null

    /**
     * Set ICE servers for all subscriptions
     */
    function setIceServers(servers: RTCIceServer[]): void {
        iceServers = servers
        console.log('[WebRTC Subscriber] ICE servers set:', servers)
    }

    /**
     * Create subscription for a remote feed
     */
    async function subscribe(
        feedId: string,
        offerSdp: string,
        display: string,
        userId: string
    ): Promise<string> {
        // Create new peer connection
        const pc = new RTCPeerConnection({
            iceServers,
            iceCandidatePoolSize: 10
        })

        const subscription: Subscription = {
            feedId,
            pc,
            remoteStream: null,
            display,
            userId
        }

        // Handle incoming tracks
        pc.ontrack = (event) => {
            console.log('[WebRTC Subscriber] Received track:', event.track.kind, 'for feed:', feedId)

            if (!subscription.remoteStream) {
                subscription.remoteStream = new MediaStream()
            }

            subscription.remoteStream.addTrack(event.track)

            // Update the map to trigger reactivity
            subscriptions.value.set(feedId, { ...subscription })

            if (onRemoteStreamCallback) {
                onRemoteStreamCallback(feedId, subscription.remoteStream)
            }
        }

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && onIceCandidateCallback) {
                onIceCandidateCallback(feedId, event.candidate)
            }
        }

        // Handle connection state
        pc.onconnectionstatechange = () => {
            const state = pc.connectionState
            console.log('[WebRTC Subscriber] Connection state for feed', feedId, ':', state)

            if (onConnectionStateChangeCallback) {
                onConnectionStateChangeCallback(feedId, state)
            }
        }

        // Set remote offer
        const offer: RTCSessionDescriptionInit = {
            type: 'offer',
            sdp: offerSdp
        }
        await pc.setRemoteDescription(offer)
        console.log('[WebRTC Subscriber] Set remote offer for feed:', feedId)

        // Create answer
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        console.log('[WebRTC Subscriber] Created answer for feed:', feedId)

        // Store subscription
        subscriptions.value.set(feedId, subscription)

        return answer.sdp!
    }

    /**
     * Add ICE candidate for a subscription
     */
    async function addIceCandidate(feedId: string, candidate: RTCIceCandidateInit): Promise<void> {
        const subscription = subscriptions.value.get(feedId)
        if (!subscription) {
            console.warn('[WebRTC Subscriber] No subscription for feed:', feedId)
            return
        }

        await subscription.pc.addIceCandidate(new RTCIceCandidate(candidate))
        console.log('[WebRTC Subscriber] Added ICE candidate for feed:', feedId)
    }

    /**
     * Get remote stream for a feed
     */
    function getRemoteStream(feedId: string): MediaStream | null {
        const subscription = subscriptions.value.get(feedId)
        return subscription?.remoteStream ?? null
    }

    /**
     * Get all subscriptions
     */
    function getAllSubscriptions(): Subscription[] {
        return Array.from(subscriptions.value.values())
    }

    /**
     * Unsubscribe from a feed
     */
    function unsubscribe(feedId: string): void {
        const subscription = subscriptions.value.get(feedId)
        if (!subscription) return

        // Stop all tracks
        if (subscription.remoteStream) {
            subscription.remoteStream.getTracks().forEach(track => track.stop())
        }

        // Close peer connection
        subscription.pc.close()

        // Remove from map
        subscriptions.value.delete(feedId)
        console.log('[WebRTC Subscriber] Unsubscribed from feed:', feedId)
    }

    /**
     * Set callback for remote streams
     */
    function onRemoteStream(callback: (feedId: string, stream: MediaStream) => void): void {
        onRemoteStreamCallback = callback
    }

    /**
     * Set callback for ICE candidates
     */
    function onIceCandidate(callback: (feedId: string, candidate: RTCIceCandidate) => void): void {
        onIceCandidateCallback = callback
    }

    /**
     * Set callback for connection state changes
     */
    function onConnectionStateChange(callback: (feedId: string, state: RTCPeerConnectionState) => void): void {
        onConnectionStateChangeCallback = callback
    }

    /**
     * Cleanup all subscriptions
     */
    function cleanup(): void {
        subscriptions.value.forEach((subscription, feedId) => {
            if (subscription.remoteStream) {
                subscription.remoteStream.getTracks().forEach(track => track.stop())
            }
            subscription.pc.close()
        })
        subscriptions.value.clear()

        onRemoteStreamCallback = null
        onIceCandidateCallback = null
        onConnectionStateChangeCallback = null

        console.log('[WebRTC Subscriber] Cleaned up all subscriptions')
    }

    // Cleanup on unmount
    onUnmounted(() => {
        cleanup()
    })

    return {
        // State
        subscriptions: readonly(subscriptions),

        // Methods
        setIceServers,
        subscribe,
        addIceCandidate,
        getRemoteStream,
        getAllSubscriptions,
        unsubscribe,
        onRemoteStream,
        onIceCandidate,
        onConnectionStateChange,
        cleanup
    }
}
