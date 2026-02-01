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
        // Backwards-compatible single-feed subscribe (wraps subscribeMultiple)
        const answersdp = await subscribeMultiple([feedId], offerSdp, [display], [userId])
        return answersdp
    }

    /**
     * Subscribe to multiple feeds in one peer connection (server expects a single subscriber session per user)
     */
    async function subscribeMultiple(
        feedIds: string[],
        offerSdp: string,
        displays: string[] = [],
        userIds: string[] = []
    ): Promise<string> {
        // Create new peer connection
        const pc = new RTCPeerConnection({
            iceServers,
            iceCandidatePoolSize: 10
        })

        // Single subscription entry that represents the group peer connection
        const subscription: Subscription = {
            feedId: feedIds.join(','),
            pc,
            remoteStream: null,
            display: displays.join(',') || '',
            userId: userIds.join(',') || ''
        }

        // Store a subscription entry for each feedId pointing to the same subscription object
        for (const f of feedIds) {
            subscriptions.value.set(f, { ...subscription, feedId: f })
        }

        // Helper to emit remote stream for a specific feed
        const emitRemoteForFeed = (feed: string, stream: MediaStream) => {
            if (onRemoteStreamCallback) onRemoteStreamCallback(feed, stream)
        }

        // Handle incoming tracks - try to infer feed_id from stream id (truegather-<feed_id>)
        pc.ontrack = (event) => {
            const incomingStream = event.streams?.[0] ?? null
            let feedFromStream: string | null = null

            // Try stream id (preferred)
            if (incomingStream && incomingStream.id) {
                const m = incomingStream.id.match(/^truegather-(.+)$/)
                if (m && m[1]) feedFromStream = m[1]
            }

            // If no stream id, attempt to infer from track id (server uses "<feed_id>-<kind>" as track id)
            if (!feedFromStream) {
                const trackIdMatch = event.track.id.match(/^(.+)-(?:audio|video)$/)
                if (trackIdMatch && trackIdMatch[1]) {
                    feedFromStream = trackIdMatch[1]
                    console.log('[WebRTC Subscriber] Inferred feed from track id:', trackIdMatch[1])
                }
            }

            const assignedFeed = feedFromStream ?? feedIds[0]
            if (!assignedFeed) {
                console.warn('[WebRTC Subscriber] No feed id available for incoming track; ignoring', { trackId: event.track.id, streamId: incomingStream?.id })
                return
            }

            console.log('[WebRTC Subscriber] Received track:', event.track.kind, 'for inferred feed:', assignedFeed, { trackId: event.track.id, streamId: incomingStream?.id })

            // Update subscription for this feed
            const sub = subscriptions.value.get(assignedFeed)
            if (!sub) {
                // Create a new subscription entry if missing
                const stream = incomingStream ?? new MediaStream()
                if (!incomingStream) stream.addTrack(event.track)
                subscriptions.value.set(assignedFeed, { ...subscription, feedId: assignedFeed, remoteStream: stream })
            } else {
                if (!sub.remoteStream) sub.remoteStream = incomingStream ?? new MediaStream()
                const existingTrackIds = new Set(sub.remoteStream.getTracks().map(t => t.id))
                if (!existingTrackIds.has(event.track.id)) {
                    sub.remoteStream.addTrack(event.track)
                }
                subscriptions.value.set(assignedFeed, { ...sub })
            }

            // Emit the updated stream for this feed
            const streamToEmit = subscriptions.value.get(assignedFeed)!.remoteStream!
            emitRemoteForFeed(assignedFeed, streamToEmit)
        }

        // Handle ICE candidates for the combined pc; use first feed id for signaling identification
        pc.onicecandidate = (event) => {
            const id = feedIds[0]
            if (!id) return
            if (event.candidate && onIceCandidateCallback) {
                onIceCandidateCallback(id, event.candidate)
            }
        }

        pc.onicegatheringstatechange = () => {
            console.log('[WebRTC Subscriber] ICE gathering state:', pc.iceGatheringState, 'feeds:', feedIds)
        }

        pc.onconnectionstatechange = () => {
            const state = pc.connectionState
            console.log('[WebRTC Subscriber] Connection state for feeds', feedIds, ':', state)
            const id = feedIds[0]
            if (!id) return
            if (onConnectionStateChangeCallback) {
                onConnectionStateChangeCallback(id, state)
            }
        }

        // Set remote offer
        const offer: RTCSessionDescriptionInit = {
            type: 'offer',
            sdp: offerSdp
        }
        await pc.setRemoteDescription(offer)
        console.log('[WebRTC Subscriber] Set remote offer for feeds:', feedIds)

        // Create answer and set as local description
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        // Use the pc.localDescription.sdp (authoritative) and ensure it contains ICE ufrag info
        const localSdp = pc.localDescription?.sdp ?? null
        if (!localSdp || !localSdp.includes('a=ice-ufrag')) {
            // Log full SDP in dev for debugging; throw to avoid sending incomplete SDP to server
            console.error('[WebRTC Subscriber] Local SDP missing ice-ufrag; refusing to return incomplete SDP', { localSdp })
            throw new Error('Local SDP missing ice-ufrag')
        }

        console.log('[WebRTC Subscriber] Created answer for feeds:', feedIds)
        return localSdp
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
        subscriptions.value.forEach((subscription) => {
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

    // NOTE: Cleanup is now managed explicitly by the RoomStore (leaveRoom / cleanup).
    // Removing composable-level onUnmounted hook prevents unintentional cleanup being called
    // during hot-reload or when the composable is used outside of a component setup context.
    // (No automatic cleanup here.)

    return {
        // State
        subscriptions: readonly(subscriptions),

        // Methods
        setIceServers,
        subscribe,
        subscribeMultiple,
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
