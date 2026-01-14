// Room Store - Main state management for video room
import { defineStore } from 'pinia'
import type {
    Room,
    Participant,
    Publisher,
    JoinResponse,
    JoinedPayload,
    PublisherJoinedPayload,
    PublisherLeftPayload,
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

    // Settings
    const displayName = ref('')
    const transcriptionEnabled = ref(false)

    // Computed
    const participantCount = computed(() => participants.value.size)
    const publisherCount = computed(() => publishers.value.size)
    const isPublishing = computed(() => publisher.isPublishing.value)
    const isMuted = computed(() => publisher.isMuted.value)
    const isVideoOff = computed(() => publisher.isVideoOff.value)

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

            // Send join_room message
            const joinResult = await signaling.sendRequest<SignalingMessage<JoinedPayload>>('join_room', {
                room_id: id,
                display
            })

            // Process existing publishers (note: backend sends "publishers", not "existing_publishers")
            if (joinResult.payload.publishers) {
                for (const pub of joinResult.payload.publishers) {
                    publishers.value.set(String(pub.feed_id), {
                        feed_id: String(pub.feed_id),
                        display: pub.display,
                        user_id: '', // Backend doesn't send user_id in publishers list
                        joined_at: new Date().toISOString()
                    })
                }
            }

            // Add self to participants
            participants.value.set(userId.value, {
                user_id: userId.value,
                display,
                is_publishing: false,
                is_muted: false,
                is_video_off: false,
                joined_at: new Date().toISOString()
            })

            isJoined.value = true
            toastStore.success('Joined room successfully')
            console.log('[RoomStore] Fully joined room')
        } catch (error) {
            console.error('[RoomStore] Failed to join:', error)
            toastStore.error('Failed to join room')
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
        // Publisher joined
        signaling.on('publisher_joined', (message) => {
            const payload = message.payload as PublisherJoinedPayload
            console.log('[RoomStore] Publisher joined:', payload)

            publishers.value.set(String(payload.feed_id), {
                feed_id: String(payload.feed_id),
                display: payload.display,
                user_id: '', // Backend doesn't always send user_id
                joined_at: new Date().toISOString()
            })

            toastStore.info(`${payload.display} joined the room`)

            // Auto-subscribe to new publisher
            subscribeToPublisher(String(payload.feed_id), payload.display, '')
        })

        // Publisher left
        signaling.on('publisher_left', (message) => {
            const payload = message.payload as PublisherLeftPayload
            console.log('[RoomStore] Publisher left:', payload)

            const pub = publishers.value.get(payload.feed_id)
            if (pub) {
                toastStore.info(`${pub.display} left the room`)
                publishers.value.delete(payload.feed_id)
                subscriber.unsubscribe(payload.feed_id)
            }
        })

        // Remote ICE candidates
        signaling.on('remote_candidate', async (message) => {
            const payload = message.payload as any
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

        try {
            // Initialize WebRTC publisher
            publisher.initialize(iceServers.value)
            subscriber.setIceServers(iceServers.value)

            // Setup ICE candidate handler
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

            // Add tracks to peer connection
            publisher.addTracks()

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
            }

            console.log('[RoomStore] Publishing started')
        } catch (error) {
            console.error('[RoomStore] Failed to start publishing:', error)
            toastStore.error('Failed to start camera')
            throw error
        }
    }

    /**
     * Subscribe to a remote publisher
     */
    async function subscribeToPublisher(feedId: string, display: string, publisherUserId: string): Promise<void> {
        try {
            // Request subscription offer from server
            const offerResponse = await signaling.sendRequest<SignalingMessage<{ sdp: string; feed_ids: string[] }>>('subscribe', {
                feeds: [{ feed_id: feedId }]
            })

            // Setup ICE candidate handler for this subscription
            subscriber.onIceCandidate((fId, candidate) => {
                signaling.send('trickle_ice', {
                    candidate: candidate.candidate,
                    sdp_mid: candidate.sdpMid,
                    sdp_mline_index: candidate.sdpMLineIndex,
                    target: 'subscriber',
                    feed_id: fId
                })
            })

            // Subscribe and get answer
            const answerSdp = await subscriber.subscribe(
                feedId,
                offerResponse.payload.sdp,
                display,
                publisherUserId
            )

            // Send answer back to server
            await signaling.sendRequest('subscribe_answer', { sdp: answerSdp })

            console.log('[RoomStore] Subscribed to feed:', feedId)
        } catch (error) {
            console.error('[RoomStore] Failed to subscribe:', error)
        }
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
        localStream.value = null
        isJoined.value = false
        isJoining.value = false

        console.log('[RoomStore] Cleaned up')
    }

    /**
     * Get remote stream for a feed
     */
    function getRemoteStream(feedId: string): MediaStream | null {
        return subscriber.getRemoteStream(feedId)
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
        leaveRoom,
        cleanup,
        getRemoteStream
    }
})
