// Room Store - Main state management for video room
import { defineStore } from 'pinia'
import type {
    Room,
    Participant,
    Publisher,
    JoinedPayload,
    PublisherJoinedPayload,
    PublisherLeftPayload,
    MemberJoinedPayload,
    MemberLeftPayload,
    SignalingMessage
} from '~/types'

export const useRoomStore = defineStore('room', () => {
    // Dependencies
    const api = useApi()
    const signaling = useSignalingWs()
    const publisher = useWebRtcPublisher()
    const subscriber = useWebRtcSubscriber()
    const toastStore = useToastStore()

    // Room state
    const roomId = ref<string | null>(null)
    const userId = ref<string | null>(null)
    const roomName = ref('')
    const roomInfo = ref<Room | null>(null)

    // Connection state
    const isJoining = ref(false)
    const isJoined = ref(false)
    const token = ref<string | null>(null)
    const iceServers = ref<RTCIceServer[]>([])

    // Participants state
    const participants = ref<Map<string, Participant>>(new Map())
    const publishers = ref<Map<string, Publisher>>(new Map())
    const localStream = ref<MediaStream | null>(null)
    const remoteStreams = ref<Map<string, MediaStream>>(new Map())

    // Helper functions to force Vue reactivity after Map mutations
    function commitParticipants(): void {
        participants.value = new Map(participants.value)
    }

    function commitPublishers(): void {
        publishers.value = new Map(publishers.value)
    }

    function commitRemoteStreams(): void {
        remoteStreams.value = new Map(remoteStreams.value)
    }

    // Settings
    const displayName = ref('')
    const transcriptionEnabled = ref(false)

    // Screen sharing state
    const isScreenSharing = ref(false)
    const _screenStream = ref<MediaStream | null>(null)
    // Keep a backup of the camera/microphone stream so we can restore it after screen sharing
    const _cameraStream = ref<MediaStream | null>(null)
    // Whether the active screen share contains an audio track that is being published
    const isScreenShareAudio = ref(false)

    async function startScreenShare(): Promise<void> {
        if (isScreenSharing.value) return
        if (!publisher.isPublishing.value) {
            toastStore.error('Start your camera before sharing your screen')
            return
        }

        try {
            const media = useMediaDevices()
            if (!media.isScreenShareSupported()) {
                throw new Error('Screen sharing not supported in this browser')
            }

            const stream = await media.getScreenShareStream()
            const videoTrack = stream.getVideoTracks()[0]
            const audioTrack = stream.getAudioTracks()[0] ?? null
            if (!videoTrack) throw new Error('No screen track available')

            // Backup current camera stream so we can restore it later
            _cameraStream.value = localStream.value

            // Replace outgoing video track
            await publisher.replaceTrack(videoTrack)
            console.log('[RoomStore] Replaced video track with screen share track:', { id: videoTrack.id })

            // If screen share provides an audio track (e.g., tab audio), publish it as well
            if (audioTrack) {
                try {
                    const res = await publisher.replaceTrack(audioTrack)
                    console.log('[RoomStore] replaceTrack result for screen audio:', res)
                    if (res.replacedExisting) {
                        console.log('[RoomStore] Published screen-share audio track (replaced existing sender):', { id: audioTrack.id })
                        isScreenShareAudio.value = true
                        toastStore.info('Screen sharing audio enabled')
                    } else if (res.addedNew) {
                        console.warn('[RoomStore] Screen-share audio added as a new sender; a restart of publishing is required for some peers to receive it')
                        isScreenShareAudio.value = false
                        toastStore.info('Applying screen audio requires re-publish — restarting publisher')

                        // Restart publishing to negotiate the new sender (best-effort)
                        try {
                            // Keep tracks so we can re-apply them after restart
                            const savedScreenVideo = videoTrack
                            const savedScreenAudio = audioTrack

                            // Stop publisher gracefully
                            publisher.stop()

                            // Reset publication state for UI
                            const selfParticipant = participants.value.get(userId.value!)
                            if (selfParticipant) {
                                selfParticipant.is_publishing = false
                                participants.value.set(userId.value!, selfParticipant)
                                commitParticipants()
                            }

                            // Start publishing again (this will re-create offer with all tracks)
                            await startPublishing()

                            // Re-apply screen share tracks (video first, then audio)
                            try {
                                await publisher.replaceTrack(savedScreenVideo)
                                console.log('[RoomStore] Re-applied screen video after republish')
                                if (savedScreenAudio) {
                                    const res2 = await publisher.replaceTrack(savedScreenAudio)
                                    console.log('[RoomStore] Re-applied screen audio after republish', res2)
                                    if (res2.replacedExisting) {
                                        isScreenShareAudio.value = true
                                    }
                                }

                                // Restore local preview to screen stream
                                _screenStream.value = stream
                                localStream.value = stream
                                isScreenSharing.value = true

                            } catch (err) {
                                console.warn('[RoomStore] Failed to re-apply screen tracks after republish:', err)
                                isScreenShareAudio.value = false
                            }

                        } catch (err) {
                            console.error('[RoomStore] Failed to restart publisher for screen audio:', err)
                            toastStore.error('Failed to enable screen audio')
                            isScreenShareAudio.value = false
                        }
                    }
                } catch (err) {
                    console.warn('[RoomStore] Failed to publish screen-share audio track:', err)
                    isScreenShareAudio.value = false
                }
            } else {
                console.log('[RoomStore] No audio track present on screen share stream')
                isScreenShareAudio.value = false
            }

            // Keep reference so we can stop it later and update local preview
            _screenStream.value = stream
            localStream.value = stream
            isScreenSharing.value = true

            // When user stops sharing via browser UI, revert
            videoTrack.onended = async () => {
                await stopScreenShare()
            }

            console.log('[RoomStore] Screen sharing started')
            toastStore.info('Screen sharing started')

            // Debug: fetch media status from server to confirm SFU sees this publisher
            try {
                if (roomId.value) {
                    const mediaStatus = await api.getMediaStatus(roomId.value)
                    console.log('[RoomStore] Media status after starting screen share:', mediaStatus)
                }
            } catch (e) {
                console.warn('[RoomStore] Failed to fetch media status after starting screen share:', e)
            }
        } catch (err) {
            console.error('[RoomStore] Failed to start screen share:', err)
            toastStore.error('Failed to start screen share')
            throw err
        }
    }

    async function stopScreenShare(): Promise<void> {
        if (!isScreenSharing.value) return

        try {
            // Stop the screen stream tracks
            if (_screenStream.value) {
                _screenStream.value.getTracks().forEach(t => t.stop())
                _screenStream.value = null
            }

            // Restore camera video/audio tracks if available
            const camStream = _cameraStream.value
            if (camStream) {
                const camVideo = camStream.getVideoTracks()[0]
                const camAudio = camStream.getAudioTracks()[0]
                if (camVideo) {
                    await publisher.replaceTrack(camVideo)
                }
                if (camAudio) {
                    await publisher.replaceTrack(camAudio)
                }

                // Restore local preview to camera stream
                localStream.value = camStream
                _cameraStream.value = null
            } else {
                // If we don't have a camera backup, clear local preview
                localStream.value = null
            }

            isScreenSharing.value = false
            // Clear audio indicator when stopping
            isScreenShareAudio.value = false
            console.log('[RoomStore] Screen sharing stopped')
            toastStore.info('Screen sharing stopped')
        } catch (err) {
            console.error('[RoomStore] Failed to stop screen share:', err)
            toastStore.error('Failed to stop screen share')
            throw err
        }
    }

    // Computed
    const participantCount = computed(() => participants.value.size)
    const publisherCount = computed(() => publishers.value.size)
    const isPublishing = computed(() => publisher.isPublishing.value)
    const isMuted = computed(() => publisher.isMuted.value)
    const isVideoOff = computed(() => publisher.isVideoOff.value)

    // Prevent concurrent startPublishing attempts which can race and leave PC in invalid state
    let startPublishingInProgress = false

    // Subscription synchronization state
    // We serialize subscription attempts to avoid concurrent subscribe/re-subscribe that
    // produce SDP race conditions (e.g. incomplete ICE ufrag in remote SDP). syncSubscriptions
    // centralizes the logic to ensure a single subscribe request and a single subscribe_answer
    // per cycle, and to preserve the expected WebRTC SDP order.
    let subscriptionSyncInProgress = false
    let subscriptionSyncPending = false

    async function syncSubscriptions(): Promise<void> {
        // If a sync is in flight, mark a pending request so we run again afterwards.
        if (subscriptionSyncInProgress) {
            subscriptionSyncPending = true
            return
        }

        // Don't attempt to subscribe if not joined or signaling disconnected
        if (!isJoined.value || !signaling.isConnected.value) return

        subscriptionSyncInProgress = true
        subscriptionSyncPending = false

        try {
            // Build feed list: all publishers except our own
            const allFeeds = Array.from(publishers.value.values())
                .filter(p => p.user_id !== userId.value)
                .map(p => ({ feed_id: p.feed_id }))

            if (allFeeds.length === 0) {
                // No feeds to subscribe to -> cleanup subscriber session and remote streams
                subscriber.cleanup()
                remoteStreams.value.clear()
                commitRemoteStreams()
                console.log('[RoomStore] No publishers found - cleared subscriptions')
                return
            }

            // Request a combined offer from the server for the requested feeds
            const offerResponse = await signaling.sendRequest<SignalingMessage<{ sdp: string; feed_ids: string[] }>>('subscribe', {
                feeds: allFeeds
            })

            // Prepare arrays ordered to match the offer
            const feedIds = allFeeds.map(f => f.feed_id)
            const displays = feedIds.map(id => publishers.value.get(id)?.display ?? '')
            const userIds = feedIds.map(id => publishers.value.get(id)?.user_id ?? '')

            // Subscriber will set remote offer, create answer and set local description.
            // We then take that answer.sdp and send a single subscribe_answer to the server.
            const answerSdp = await subscriber.subscribeMultiple(feedIds, offerResponse.payload.sdp, displays, userIds)

            // Fire-and-forget: backend does not ACK subscribe_answer; using send avoids waiting for a response
            signaling.send('subscribe_answer', { sdp: answerSdp })

            console.log('[RoomStore] Subscribed to feeds:', feedIds)
        } catch (err) {
            console.error('[RoomStore] Failed to synchronize subscriptions:', err)
        } finally {
            subscriptionSyncInProgress = false
            if (subscriptionSyncPending) {
                subscriptionSyncPending = false
                // Run again to pick up any changes that occurred while we were syncing
                await syncSubscriptions()
            }
        }
    }

    /**
     * Create a new room
     */
    async function createRoom(name: string, maxPublishers = 10): Promise<Room> {
        try {
            const room = await api.createRoom({ name, max_publishers: maxPublishers })
            console.log('[RoomStore] Room created:', room.room_id)
            return room
        } catch (error) {
            toastStore.error('Failed to create room')
            throw error
        }
    }

    /**
     * Join an existing room
     */
    async function joinRoom(id: string, display: string): Promise<void> {
        if (isJoining.value || isJoined.value) {
            console.warn('[RoomStore] Already joining or joined')
            return
        }

        isJoining.value = true
        displayName.value = display

        try {
            // Get room info
            roomInfo.value = await api.getRoom(id)
            roomId.value = id
            roomName.value = roomInfo.value.name

            // Join via REST API to get credentials
            const joinResponse = await api.joinRoom(id, { display })
            userId.value = joinResponse.user_id
            token.value = joinResponse.token
            iceServers.value = joinResponse.ice_servers

            console.log('[RoomStore] Joined via API:', joinResponse.user_id)

            // Connect to signaling WebSocket
            await signaling.connect(joinResponse.ws_url)

            // Setup signaling event handlers
            setupSignalingHandlers()

            // Ensure subscriber knows ICE servers even if we don't publish
            subscriber.setIceServers(iceServers.value)

            // Send join_room message
            const joinResult = await signaling.sendRequest<SignalingMessage<JoinedPayload>>('join_room', {
                room_id: id,
                display
            })

            // Initialize participants from REST join response (persisted members)
            if (joinResponse.participants && joinResponse.participants.length > 0) {
                for (const m of joinResponse.participants) {
                    // Skip adding self for now; we'll overwrite later
                    participants.value.set(m.user_id, {
                        user_id: m.user_id,
                        display: m.display,
                        is_publishing: false,
                        is_muted: false,
                        is_video_off: false,
                        joined_at: new Date(m.joined_at as any).toISOString()
                    })
                }
            }
            // Ensure UI updates immediately
            commitParticipants()

            // Replace local participants list from joined payload (server = source of truth)
            participants.value.clear()
            if (joinResult.payload.participants && joinResult.payload.participants.length > 0) {
                for (const m of joinResult.payload.participants) {
                    participants.value.set(m.user_id, {
                        user_id: m.user_id,
                        display: m.display,
                        is_publishing: false,
                        is_muted: false,
                        is_video_off: false,
                        joined_at: m.joined_at ? new Date(m.joined_at as any).toISOString() : new Date().toISOString()
                    })
                }
            }
            // Ensure UI updates immediately
            commitParticipants()

            // Process existing publishers (note: backend sends "publishers", not "existing_publishers")
            if (joinResult.payload.publishers && joinResult.payload.publishers.length > 0) {
                // Add publisher records
                for (const pub of joinResult.payload.publishers) {
                    publishers.value.set(String(pub.feed_id), {
                        feed_id: String(pub.feed_id),
                        display: pub.display,
                        user_id: pub.user_id || '',
                        joined_at: new Date().toISOString()
                    })

                    // Add publisher to participants list if user_id is provided
                    if (pub.user_id) {
                        participants.value.set(pub.user_id, {
                            user_id: pub.user_id,
                            display: pub.display,
                            is_publishing: true,
                            is_muted: false,
                            is_video_off: false,
                            joined_at: new Date().toISOString()
                        })
                    }
                }

                // Ensure UI updates immediately after modifying maps
                commitPublishers()
                commitParticipants()

                // NOTE: Do not start subscription logic inline here to avoid concurrent/duplicate subscriptions.
                // Subscription is centralized in syncSubscriptions() which guarantees only one in-flight subscribe
                // transaction at a time and preserves the order: request offer -> setRemoteDescription -> createAnswer -> setLocalDescription -> send answer.
                // We call syncSubscriptions() below once join flow completes.
            }

            // Add self to participants
            participants.value.set(userId.value!, {
                user_id: userId.value!,
                display,
                is_publishing: false,
                is_muted: false,
                is_video_off: false,
                joined_at: new Date().toISOString()
            })
            commitParticipants()

            isJoined.value = true

            // After finishing join, ensure subscriptions are synchronized in a single place.
            // This avoids concurrent re-subscribe attempts during join and reduces latency / SDP race conditions.
            try {
                await syncSubscriptions()
            } catch (e) {
                console.warn('[RoomStore] syncSubscriptions during join failed:', e)
            }

            toastStore.success('Joined room successfully')
            console.log('[RoomStore] Fully joined room')
        } catch (error) {
                console.error('[RoomStore] Failed to join:', error)
            // Provide more helpful feedback to the user based on error type
            const msg = (error instanceof Error) ? error.message : String(error)
            if (msg.includes('WebSocket connection failed')) {
                toastStore.error('Failed to connect to signaling server — check server or network (see console for details)')
            } else if (msg.includes('Request join_room timed out') || msg.includes('Request join_room')) {
                toastStore.error('Join request timed out — signaling server may be slow or misconfigured')
            } else {
                toastStore.error('Failed to join room')
            }
            await cleanup()
            throw error
        } finally {
            isJoining.value = false
        }
    }

    /**
     * Setup signaling event handlers
     */
    function setupSignalingHandlers(): void {
        // Setup remote stream callback for subscriber
        subscriber.onRemoteStream((feedId: string, stream: MediaStream) => {
            console.log('[RoomStore] Received remote stream for feed:', feedId)
            remoteStreams.value.set(feedId, stream)
            // Trigger reactivity
            commitRemoteStreams()
        })

        // Setup ICE candidate handler for subscriber (single registration)
        // We set this once here so we don't re-register the handler on every subscribe call
        subscriber.onIceCandidate((fId, candidate) => {
            signaling.send('trickle_ice', {
                candidate: candidate.candidate,
                sdp_mid: candidate.sdpMid,
                sdp_mline_index: candidate.sdpMLineIndex,
                target: 'subscriber',
                feed_id: fId
            })
        })

        // Publisher joined
        signaling.on('publisher_joined', (message) => {
            const payload = message.payload as PublisherJoinedPayload
            console.log('[RoomStore] Publisher joined:', payload)

            publishers.value.set(String(payload.feed_id), {
                feed_id: String(payload.feed_id),
                display: payload.display,
                user_id: payload.user_id || '',
                joined_at: new Date().toISOString()
            })

            // Add to participants list if user_id provided
            if (payload.user_id) {
                participants.value.set(payload.user_id, {
                    user_id: payload.user_id,
                    display: payload.display,
                    is_publishing: true,
                    is_muted: false,
                    is_video_off: false,
                    joined_at: new Date().toISOString()
                })
            }

            // Ensure UI updates immediately
            commitPublishers()
            commitParticipants()

            toastStore.info(`${payload.display} joined the room`)

            // Centralized subscription handling:
            // Instead of re-subscribing inline (which caused concurrent subscribe requests and SDP races),
            // call syncSubscriptions() which serializes subscribe operations and ensures exactly one subscribe_answer
            // is sent per subscription cycle. This prevents SDP races like "set_remote_description called with no ice-ufrag".
            void syncSubscriptions()

        })

        // Publisher left
        signaling.on('publisher_left', (message) => {
            const payload = message.payload as PublisherLeftPayload
            console.log('[RoomStore] Publisher left:', payload)

            const pub = publishers.value.get(payload.feed_id)
            if (pub) {
                toastStore.info(`${pub.display} left the room`)
                publishers.value.delete(payload.feed_id)
                remoteStreams.value.delete(payload.feed_id)
                subscriber.unsubscribe(payload.feed_id)

                // Ensure UI updates for publishers and remote streams
                commitPublishers()
                commitRemoteStreams()

                // Re-sync subscriptions to ensure subscriber session does not keep stale state
                // (avoids partially-closed peer connections or dangling tracks after unsubscribe).
                void syncSubscriptions()

                // Mark participant as no longer publishing if we have a matching user_id
                if (pub.user_id) {
                    const p = participants.value.get(pub.user_id)
                    if (p) {
                        p.is_publishing = false
                        participants.value.set(pub.user_id, p)
                        // Update participants UI
                        commitParticipants()
                    }
                }
            }
        })

        // Member joined (presence)
        signaling.on('member_joined', (message) => {
            const payload = message.payload as MemberJoinedPayload
            console.log('[RoomStore] Member joined:', payload)

            participants.value.set(payload.user_id, {
                user_id: payload.user_id,
                display: payload.display,
                is_publishing: false,
                is_muted: false,
                is_video_off: false,
                joined_at: new Date().toISOString()
            })

            // Ensure UI updates immediately
            commitParticipants()

            toastStore.info(`${payload.display} joined the room`)
        })

        // Member left (presence)
        signaling.on('member_left', (message) => {
            const payload = message.payload as MemberLeftPayload
            console.log('[RoomStore] Member left:', payload)

            const p = participants.value.get(payload.user_id)
            if (p) {
                toastStore.info(`${p.display} left the room`)
                participants.value.delete(payload.user_id)
                // Ensure UI updates immediately
                commitParticipants()
            }
        })

        // Remote ICE candidates
        signaling.on('remote_candidate', async (message) => {
            const payload = message.payload as {
                candidate: string
                sdp_mid?: string
                sdp_mline_index?: number
                feed_id?: string
            }
            if (payload.feed_id) {
                await subscriber.addIceCandidate(payload.feed_id, {
                    candidate: payload.candidate,
                    sdpMid: payload.sdp_mid,
                    sdpMLineIndex: payload.sdp_mline_index
                })
            } else {
                await publisher.addIceCandidate({
                    candidate: payload.candidate,
                    sdpMid: payload.sdp_mid,
                    sdpMLineIndex: payload.sdp_mline_index
                })
            }
        })

        // Errors
        signaling.on('error', (message) => {
            const payload = message.payload as { code: number; message: string }
            console.error('[RoomStore] Signaling error:', payload)
            toastStore.error(payload.message)
        })
    }

    /**
     * Start publishing local media
     */
    async function startPublishing(): Promise<void> {
        if (!isJoined.value) {
            throw new Error('Not joined to room')
        }

        if (startPublishingInProgress) {
            console.warn('[RoomStore] startPublishing already in progress, skipping duplicate call')
            return
        }

        startPublishingInProgress = true
        try {
            // Initialize WebRTC publisher and ensure ICE servers are set for subscriber
            publisher.initialize(iceServers.value)
            subscriber.setIceServers(iceServers.value)

            // Setup ICE candidate handler (idempotent registration on the same handler)
            publisher.onIceCandidate((candidate) => {
                signaling.send('trickle_ice', {
                    candidate: candidate.candidate,
                    sdp_mid: candidate.sdpMid,
                    sdp_mline_index: candidate.sdpMLineIndex,
                    target: 'publisher'
                })
            })

            // Capture local media
            const stream = await publisher.startCapture()
            localStream.value = stream

            // Defensive checks + retry: addTracks may throw if the PC or stream is not set for some reason
            try {
                console.log('[RoomStore] Trying to add local tracks. publisher.isInitialized=', publisher.isInitialized.value, 'publisher.localStream tracks=', publisher.localStream.value?.getTracks().map(t=>t.kind))
                publisher.addTracks()
            } catch (err) {
                console.warn('[RoomStore] addTracks failed, attempting recovery:', err)

                // If the peer connection was unexpectedly closed or not initialized, re-initialize and retry once
                if (!publisher.isInitialized.value) {
                    console.log('[RoomStore] Re-initializing publisher and retrying addTracks')
                    publisher.initialize(iceServers.value)
                }

                // Give a short tick to allow state to settle (helps in certain browser races)
                await new Promise(res => setTimeout(res, 50))

                // Retry addTracks once
                publisher.addTracks()
            }

            // Create and send offer
            const offer = await publisher.createOffer()

            const answer = await signaling.sendRequest<SignalingMessage<{ sdp: string }>>('publish_offer', {
                sdp: offer.sdp,
                kind: 'both'
            })

            // Set remote answer
            await publisher.setAnswer(answer.payload.sdp)

            // Update self participant
            const selfParticipant = participants.value.get(userId.value!)
            if (selfParticipant) {
                selfParticipant.is_publishing = true
                participants.value.set(userId.value!, selfParticipant)
                // Update UI immediately
                commitParticipants()
            }

            console.log('[RoomStore] Publishing started')

            // After starting publishing we need to make sure our subscriptions are in sync.
            // Use syncSubscriptions() to avoid doing multiple individual subscribe calls which can lead
            // to concurrent SDP negotiations and race conditions.
            await syncSubscriptions()
        } catch (error) {
            console.error('[RoomStore] Failed to start publishing:', error)
            toastStore.error('Failed to start camera')
            throw error
        } finally {
            startPublishingInProgress = false
        }
    }

    /**
     * Subscribe to a remote publisher
     */
    async function subscribeToPublisher(feedId: string, display: string, publisherUserId: string): Promise<void> {
        // Kept for compatibility, but delegate to the centralized syncSubscriptions function
        // so that we guarantee only a single subscriber session per user and avoid concurrent
        // subscriptions which lead to stale/incomplete SDPs.
        await syncSubscriptions()
    }

    /**
     * Toggle audio mute
     */
    function toggleMute(): boolean {
        const muted = publisher.toggleMute()

        const selfParticipant = participants.value.get(userId.value!)
        if (selfParticipant) {
            selfParticipant.is_muted = muted
            participants.value.set(userId.value!, selfParticipant)
        }

        return muted
    }

    /**
     * Toggle video
     */
    function toggleVideo(): boolean {
        const videoOff = publisher.toggleVideo()

        const selfParticipant = participants.value.get(userId.value!)
        if (selfParticipant) {
            selfParticipant.is_video_off = videoOff
            participants.value.set(userId.value!, selfParticipant)
        }

        return videoOff
    }

    /**
     * Leave the room
     */
    async function leaveRoom(): Promise<void> {
        try {
            if (isJoined.value && signaling.isConnected.value) {
                await signaling.sendRequest('leave', {})
            }

            if (token.value && roomId.value) {
                await api.leaveRoom(roomId.value, token.value)
            }
        } catch (error) {
            console.error('[RoomStore] Error during leave:', error)
        } finally {
            await cleanup()
            toastStore.info('You left the room')
        }
    }

    /**
     * Cleanup all state
     */
    async function cleanup(): Promise<void> {
        // Stop publishing
        publisher.stop()

        // Stop all subscriptions
        subscriber.cleanup()

        // Disconnect signaling
        signaling.disconnect()

        // Reset state
        roomId.value = null
        userId.value = null
        roomName.value = ''
        roomInfo.value = null
        token.value = null
        iceServers.value = []
        participants.value.clear()
        publishers.value.clear()
        remoteStreams.value.clear()
        // Ensure UI updates after clears
        commitParticipants()
        commitPublishers()
        commitRemoteStreams()
        localStream.value = null
        isJoined.value = false
        isJoining.value = false

        console.log('[RoomStore] Cleaned up')
    }

    /**
     * Get remote stream for a feed
     */
    function getRemoteStream(feedId: string): MediaStream | null {
        return remoteStreams.value.get(feedId) ?? null
    }

    async function getMediaStatus(): Promise<any> {
        if (!roomId.value) throw new Error('Not in a room')
        try {
            const status = await api.getMediaStatus(roomId.value)
            console.log('[RoomStore] Media status:', status)
            return status
        } catch (err) {
            console.error('[RoomStore] Failed to fetch media status:', err)
            throw err
        }
    }

    return {
        // State
        roomId: readonly(roomId),
        userId: readonly(userId),
        roomName: readonly(roomName),
        roomInfo: readonly(roomInfo),
        isJoining: readonly(isJoining),
        isJoined: readonly(isJoined),
        participants: readonly(participants),
        publishers: readonly(publishers),
        localStream: readonly(localStream),
        remoteStreams: readonly(remoteStreams),
        displayName,
        transcriptionEnabled,

        // Computed
        participantCount,
        publisherCount,
        isPublishing,
        isMuted,
        isVideoOff,

        // Signaling state
        isSignalingConnected: signaling.isConnected,

        // Methods
        createRoom,
        joinRoom,
        startPublishing,
        subscribeToPublisher,
        toggleMute,
        toggleVideo,
        // Screen sharing
        isScreenSharing: readonly(isScreenSharing),
        isScreenShareAudio: readonly(isScreenShareAudio),
        startScreenShare,
        stopScreenShare,
        leaveRoom,
        cleanup,
        getRemoteStream
    } 
})
