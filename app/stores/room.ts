// Room Store - Main state management for video room
import { defineStore } from 'pinia'
import type { JoinRoomRequest } from '~/types'
import type {
  Room,
  Participant,
  Publisher,
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
  const _cameraStream = ref<MediaStream | null>(null)
  const isScreenShareAudio = ref(false)

  // --- helpers pour le host key ---
  function creatorKeyStorageKey(roomId: string): string {
    return `tg:creator_key:${roomId}`
  }

  function getStoredCreatorKey(roomId: string): string {
    if (!import.meta.client) return ''
    const fromLocal = localStorage.getItem(creatorKeyStorageKey(roomId)) || ''
    if (fromLocal.trim()) return fromLocal
    const fromSession = sessionStorage.getItem(creatorKeyStorageKey(roomId)) || ''
    return fromSession
  }

  function storeCreatorKey(roomId: string, key: string): void {
    if (!import.meta.client) return
    const cleaned = (key || '').trim()
    if (!cleaned) return
    localStorage.setItem(creatorKeyStorageKey(roomId), cleaned)
    sessionStorage.setItem(creatorKeyStorageKey(roomId), cleaned)
  }

  // Computed
  const participantCount = computed(() => participants.value.size)
  const publisherCount = computed(() => publishers.value.size)
  const isPublishing = computed(() => publisher.isPublishing.value)
  const isMuted = computed(() => publisher.isMuted.value)
  const isVideoOff = computed(() => publisher.isVideoOff.value)

  // Prevent concurrent startPublishing attempts
  let startPublishingInProgress = false

  // Subscription synchronization state
  let subscriptionSyncInProgress = false
  let subscriptionSyncPending = false

  // ✅ NEW: éviter de bind plusieurs fois les handlers WS (source classique de doublons)
  let handlersBound = false

  async function syncSubscriptions(): Promise<void> {
    if (subscriptionSyncInProgress) {
      subscriptionSyncPending = true
      return
    }
    if (!isJoined.value || !signaling.isConnected.value) return

    subscriptionSyncInProgress = true
    subscriptionSyncPending = false

    try {
      const allFeeds = Array.from(publishers.value.values())
        .filter(p => p.user_id !== userId.value)
        .map(p => ({ feed_id: p.feed_id }))

      if (allFeeds.length === 0) {
        subscriber.cleanup()
        remoteStreams.value.clear()
        commitRemoteStreams()
        return
      }

      const offerResponse = await signaling.sendRequest<SignalingMessage<{ sdp: string; feed_ids: string[] }>>(
        'subscribe',
        { feeds: allFeeds }
      )

      const feedIds = allFeeds.map(f => f.feed_id)
      const displays = feedIds.map(id => publishers.value.get(id)?.display ?? '')
      const userIds = feedIds.map(id => publishers.value.get(id)?.user_id ?? '')

      const answerSdp = await subscriber.subscribeMultiple(feedIds, offerResponse.payload.sdp, displays, userIds)
      signaling.send('subscribe_answer', { sdp: answerSdp })
    } catch (err) {
      console.error('[RoomStore] Failed to synchronize subscriptions:', err)
    } finally {
      subscriptionSyncInProgress = false
      if (subscriptionSyncPending) {
        subscriptionSyncPending = false
        await syncSubscriptions()
      }
    }
  }

  /**
   * Create a new room
   * IMPORTANT: creator_key must be persisted on the host device
   */
  async function createRoom(name: string, maxPublishers = 10): Promise<Room> {
    try {
      const room = await api.createRoom({ name, max_publishers: maxPublishers })

      // ✅ IMPORTANT: store creator_key for host (host-only secret)
      if (import.meta.client) {
        const creatorKey = (room as any).creator_key as string | undefined
        if (creatorKey && creatorKey.trim()) {
          storeCreatorKey(room.room_id, creatorKey)
        } else {
          console.warn('[RoomStore] creator_key missing in createRoom response:', room)
        }
      }

      return room
    } catch (error) {
      toastStore.error('Failed to create room')
      throw error
    }
  }

  /**
   * Join an existing room
   * - Host: creator_key
   * - Guest: invite_token + invite_code
   *
   * ✅ FIX: anti double join (cause classique de participants en double)
   */
  async function joinRoom(
    id: string,
    display: string,
    auth: Partial<Omit<JoinRoomRequest, 'display'>> = {}
  ): Promise<void> {
    // ✅ Si on est déjà joined à cette room : on ne re-join pas
    if (isJoined.value && roomId.value === id) {
      console.warn('[RoomStore] Already joined this room — skipping join')
      return
    }

    // ✅ Si un join est déjà en cours : ne pas relancer
    if (isJoining.value) {
      console.warn('[RoomStore] Join already in progress')
      return
    }

    // ✅ Si joined à une autre room : force cleanup avant
    if (isJoined.value && roomId.value && roomId.value !== id) {
      console.warn('[RoomStore] Joined another room — cleaning up before join')
      await cleanup()
    }

    isJoining.value = true
    displayName.value = display

    try {
      roomInfo.value = await api.getRoom(id)
      roomId.value = id
      roomName.value = roomInfo.value.name

      const joinResponse = await api.joinRoom(id, {
        display,
        ...auth,
      })

      userId.value = joinResponse.user_id
      token.value = joinResponse.token
      iceServers.value = joinResponse.ice_servers

      // ✅ connecter WS avant de traiter les events
      await signaling.connect(joinResponse.ws_url)

      // ✅ handlers 1 seule fois par session
      setupSignalingHandlers()

      // Ensure subscriber knows ICE servers even if we don't publish
      subscriber.setIceServers(iceServers.value)

      // Send join_room message
      await signaling.sendRequest('join_room', { room_id: id, display })

      // ✅ INIT participants from REST join response (dédupe par user_id)
      participants.value.clear()
      if (joinResponse.participants?.length) {
        for (const p of joinResponse.participants) {
          participants.value.set(p.user_id, {
            user_id: p.user_id,
            display: p.display,
            is_publishing: false,
            is_muted: false,
            is_video_off: false,
            joined_at: String(p.joined_at),
          })
        }
      }

      // ✅ GARANTIR que "self" est présent (sinon UI chelou)
      participants.value.set(joinResponse.user_id, {
        user_id: joinResponse.user_id,
        display,
        is_publishing: false,
        is_muted: false,
        is_video_off: false,
        joined_at: new Date().toISOString(),
      })
      commitParticipants()

      isJoined.value = true
    } catch (error: any) {
      console.error('[RoomStore] Join failed:', error)
      toastStore.error(error?.data?.error || 'Failed to join meeting')
      throw error
    } finally {
      isJoining.value = false
    }
  }

  /**
   * Setup signaling event handlers
   * ✅ FIX: upsert / ignore duplicates
   */
  function setupSignalingHandlers(): void {
    // ✅ IMPORTANT: évite de rebind les mêmes handlers 10 fois
    if (handlersBound) return
    handlersBound = true

    subscriber.onRemoteStream((feedId: string, stream: MediaStream) => {
      remoteStreams.value.set(feedId, stream)
      commitRemoteStreams()
    })

    subscriber.onIceCandidate((fId, candidate) => {
      signaling.send('trickle_ice', {
        candidate: candidate.candidate,
        sdp_mid: candidate.sdpMid,
        sdp_mline_index: candidate.sdpMLineIndex,
        target: 'subscriber',
        feed_id: fId
      })
    })

    signaling.on('publisher_joined', (message) => {
      const payload = message.payload as PublisherJoinedPayload

      // ✅ upsert publisher (key = feed_id)
      publishers.value.set(String(payload.feed_id), {
        feed_id: String(payload.feed_id),
        display: payload.display,
        user_id: payload.user_id || '',
        joined_at: new Date().toISOString()
      })

      // ✅ upsert participant par user_id
      if (payload.user_id) {
        const existing = participants.value.get(payload.user_id)
        participants.value.set(payload.user_id, {
          user_id: payload.user_id,
          display: payload.display,
          is_publishing: true,
          is_muted: existing?.is_muted ?? false,
          is_video_off: existing?.is_video_off ?? false,
          joined_at: existing?.joined_at ?? new Date().toISOString()
        })
      }

      commitPublishers()
      commitParticipants()
      void syncSubscriptions()
    })

    signaling.on('publisher_left', (message) => {
      const payload = message.payload as PublisherLeftPayload
      const pub = publishers.value.get(payload.feed_id)
      if (!pub) return

      publishers.value.delete(payload.feed_id)
      remoteStreams.value.delete(payload.feed_id)
      subscriber.unsubscribe(payload.feed_id)

      commitPublishers()
      commitRemoteStreams()

      void syncSubscriptions()

      if (pub.user_id) {
        const p = participants.value.get(pub.user_id)
        if (p) {
          participants.value.set(pub.user_id, { ...p, is_publishing: false })
          commitParticipants()
        }
      }
    })

    signaling.on('member_joined', (message) => {
      const payload = message.payload as MemberJoinedPayload
      if (participants.value.has(payload.user_id)) return

      participants.value.set(payload.user_id, {
        user_id: payload.user_id,
        display: payload.display,
        is_publishing: false,
        is_muted: false,
        is_video_off: false,
        joined_at: new Date().toISOString()
      })
      commitParticipants()
    })

    signaling.on('member_left', (message) => {
      const payload = message.payload as MemberLeftPayload
      if (!participants.value.has(payload.user_id)) return
      participants.value.delete(payload.user_id)
      commitParticipants()
    })

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

    signaling.on('error', (message) => {
      const payload = message.payload as { code: number; message: string }
      console.error('[RoomStore] Signaling error:', payload)
      toastStore.error(payload.message)
    })
  }

  /**
   * Start publishing local media
   * ✅ garde-fou double startPublishing
   */
  async function startPublishing(): Promise<void> {
    if (!isJoined.value) throw new Error('Not joined to room')

    if (publisher.isPublishing.value) {
      console.warn('[RoomStore] Already publishing — skipping')
      return
    }

    if (startPublishingInProgress) {
      console.warn('[RoomStore] startPublishing already in progress, skipping duplicate call')
      return
    }

    startPublishingInProgress = true
    try {
      publisher.initialize(iceServers.value)
      subscriber.setIceServers(iceServers.value)

      publisher.onIceCandidate((candidate) => {
        signaling.send('trickle_ice', {
          candidate: candidate.candidate,
          sdp_mid: candidate.sdpMid,
          sdp_mline_index: candidate.sdpMLineIndex,
          target: 'publisher'
        })
      })

      const stream = await publisher.startCapture()
      localStream.value = stream

      publisher.addTracks()

      const offer = await publisher.createOffer()
      const answer = await signaling.sendRequest<SignalingMessage<{ sdp: string }>>('publish_offer', {
        sdp: offer.sdp,
        kind: 'both'
      })

      await publisher.setAnswer(answer.payload.sdp)

      // ✅ self participant publishing = true
      if (userId.value) {
        const selfP = participants.value.get(userId.value)
        if (selfP) {
          participants.value.set(userId.value, { ...selfP, is_publishing: true })
          commitParticipants()
        }
      }

      await syncSubscriptions()
    } catch (error) {
      console.error('[RoomStore] Failed to start publishing:', error)
      toastStore.error('Failed to start camera')
      throw error
    } finally {
      startPublishingInProgress = false
    }
  }

  async function subscribeToPublisher(_feedId: string, _display: string, _publisherUserId: string): Promise<void> {
    await syncSubscriptions()
  }

  function toggleMute(): boolean {
    const muted = publisher.toggleMute()
    if (userId.value) {
      const selfP = participants.value.get(userId.value)
      if (selfP) {
        participants.value.set(userId.value, { ...selfP, is_muted: muted })
        commitParticipants()
      }
    }
    return muted
  }

  function toggleVideo(): boolean {
    const videoOff = publisher.toggleVideo()
    if (userId.value) {
      const selfP = participants.value.get(userId.value)
      if (selfP) {
        participants.value.set(userId.value, { ...selfP, is_video_off: videoOff })
        commitParticipants()
      }
    }
    return videoOff
  }

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

  async function cleanup(): Promise<void> {
    publisher.stop()
    subscriber.cleanup()
    signaling.disconnect()

    // ✅ reset handlersBound pour une future session propre
    handlersBound = false

    roomId.value = null
    userId.value = null
    roomName.value = ''
    roomInfo.value = null
    token.value = null
    iceServers.value = []

    participants.value.clear()
    publishers.value.clear()
    remoteStreams.value.clear()

    commitParticipants()
    commitPublishers()
    commitRemoteStreams()

    localStream.value = null
    isJoined.value = false
    isJoining.value = false
  }

  function getRemoteStream(feedId: string): MediaStream | null {
    return remoteStreams.value.get(feedId) ?? null
  }

  async function getMediaStatus(): Promise<any> {
    if (!roomId.value) throw new Error('Not in a room')
    const status = await api.getMediaStatus(roomId.value)
    return status
  }

  // ---- Screen share functions unchanged ----
  async function startScreenShare(): Promise<void> {
    if (isScreenSharing.value) return
    if (!publisher.isPublishing.value) {
      toastStore.error('Start your camera before sharing your screen')
      return
    }

    try {
      const media = useMediaDevices()
      if (!media.isScreenShareSupported()) throw new Error('Screen sharing not supported in this browser')

      const stream = await media.getScreenShareStream()
      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = stream.getAudioTracks()[0] ?? null
      if (!videoTrack) throw new Error('No screen track available')

      _cameraStream.value = localStream.value
      await publisher.replaceTrack(videoTrack)

      if (audioTrack) {
        try {
          const res = await publisher.replaceTrack(audioTrack)
          isScreenShareAudio.value = !!res.replacedExisting
        } catch {
          isScreenShareAudio.value = false
        }
      } else {
        isScreenShareAudio.value = false
      }

      _screenStream.value = stream
      localStream.value = stream
      isScreenSharing.value = true

      videoTrack.onended = async () => {
        await stopScreenShare()
      }

      toastStore.info('Screen sharing started')
    } catch (err) {
      console.error('[RoomStore] Failed to start screen share:', err)
      toastStore.error('Failed to start screen share')
      throw err
    }
  }

  async function stopScreenShare(): Promise<void> {
    if (!isScreenSharing.value) return

    try {
      if (_screenStream.value) {
        _screenStream.value.getTracks().forEach(t => t.stop())
        _screenStream.value = null
      }

      const camStream = _cameraStream.value
      if (camStream) {
        const camVideo = camStream.getVideoTracks()[0]
        const camAudio = camStream.getAudioTracks()[0]
        if (camVideo) await publisher.replaceTrack(camVideo)
        if (camAudio) await publisher.replaceTrack(camAudio)
        localStream.value = camStream
        _cameraStream.value = null
      } else {
        localStream.value = null
      }

      isScreenSharing.value = false
      isScreenShareAudio.value = false
      toastStore.info('Screen sharing stopped')
    } catch (err) {
      console.error('[RoomStore] Failed to stop screen share:', err)
      toastStore.error('Failed to stop screen share')
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
    getRemoteStream,
    getMediaStatus,

    // Host key helpers
    getStoredCreatorKey,
    storeCreatorKey,
  }
})
