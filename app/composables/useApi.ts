// API composable for TrueGather backend integration
import type {
  Room,
  JoinResponse,
  HealthResponse,
  CreateRoomRequest,
  JoinRoomRequest,
  CreateInvitationRequest,
  CreateInvitationResponse,
  InvitationInfo,
  RoomInvitation,
  InviteEmailRequest,
  InviteEmailResponse,
} from '~/types'

export function useApi() {
  const config = useRuntimeConfig()
  const baseUrl = config.public.apiBaseUrl

  /**
   * Create a new room
   * Backend returns creator_key (host-only, returned once)
   */
  async function createRoom(data: CreateRoomRequest): Promise<Room & { creator_key?: string }> {
    const response = await $fetch<{
      room_id: string
      name: string
      created_at: string
      max_publishers: number
      ttl_seconds: number
      creator_key: string
    }>(`${baseUrl}/rooms`, {
      method: 'POST',
      body: data,
    })

    return {
      room_id: response.room_id,
      name: response.name,
      created_at: response.created_at,
      max_publishers: response.max_publishers,
      status: 'active',
      participants_count: 0,
      ttl_seconds: response.ttl_seconds,
      creator_key: response.creator_key,
    }
  }

  /**
   * Get room details
   */
  async function getRoom(roomId: string): Promise<Room> {
    return await $fetch<Room>(`${baseUrl}/rooms/${roomId}`)
  }

  /**
   * List recent rooms
   */
  async function listRooms(limit = 20): Promise<Room[]> {
    return await $fetch<Room[]>(`${baseUrl}/rooms`, {
      method: 'GET',
      query: { limit },
    })
  }

  /**
   * Join a room
   */
  type JoinRoomApiResponse = {
      room_id: string
      user_id: string
      ws_url: string
      token: string
      ice_servers: Array<{
        urls: string[]
        username?: string
        credential?: string
      }>
      expires_in: number
      participants?: Array<{
        user_id: string
        display: string
        joined_at: string | number
      }>
    }
    async function joinRoom(roomId: string, data: JoinRoomRequest): Promise<JoinResponse> {
        const response = await $fetch<JoinRoomApiResponse>(`${baseUrl}/rooms/${roomId}/join`, {
          method: 'POST',
          body: data,
        })

    // Map ice_servers to RTCIceServer format
    const iceServers: RTCIceServer[] = response.ice_servers.map((server) => ({
      urls: server.urls,
      username: server.username,
      credential: server.credential,
    }))

    return {
      room_id: response.room_id,
      user_id: response.user_id,
      ws_url: response.ws_url,
      token: response.token,
      ice_servers: iceServers,
      expires_in: response.expires_in,
      participants: response.participants,
    }
  }

  /**
   * Leave a room
   */
  async function leaveRoom(roomId: string, _token: string): Promise<void> {
    await $fetch(`${baseUrl}/rooms/${roomId}/leave`, {
      method: 'POST',
    })
  }

  /**
   * Get server health
   * Health endpoint is at root, not under /api/v1
   */
  async function getHealth(): Promise<HealthResponse> {
    const healthUrl = baseUrl.replace('/api/v1', '')
    return await $fetch<HealthResponse>(`${healthUrl}/health`)
  }

  /**
   * Create an invitation token
   * NOTE: This endpoint does NOT return the code (security).
   * The code is sent via invite-email endpoint.
   */
  async function createInvitation(
    roomId: string,
    data: CreateInvitationRequest = {}
  ): Promise<CreateInvitationResponse> {
    return await $fetch<CreateInvitationResponse>(`${baseUrl}/rooms/${roomId}/invite`, {
      method: 'POST',
      body: data,
    })
  }

  /**
   * Send invitation emails for a room (server-side)
   * Requires backend mail config (MAIL_FROM + RESEND_API_KEY)
   */
  async function sendInviteEmail(roomId: string, data: InviteEmailRequest): Promise<InviteEmailResponse> {
    return await $fetch<InviteEmailResponse>(`${baseUrl}/rooms/${roomId}/invite-email`, {
      method: 'POST',
      body: data,
    })
  }

  /**
   * Get invitation info by token
   */
  async function getInvitation(token: string): Promise<InvitationInfo> {
    return await $fetch<InvitationInfo>(`${baseUrl}/rooms/invite/${token}`)
  }

  /**
   * Use an invitation (increment use count)
   */
  async function useInvitation(token: string): Promise<InvitationInfo> {
    return await $fetch<InvitationInfo>(`${baseUrl}/rooms/invite/${token}/use`, {
      method: 'POST',
    })
  }

    /**
     * List all invitations for a room
     */
    async function listInvitations(roomId: string): Promise<RoomInvitation[]> {
        return await $fetch<RoomInvitation[]>(`${baseUrl}/rooms/${roomId}/invites`)
    }

    /**
     * Get room media status (publishers & subscribers) for debugging
     */
    async function getMediaStatus(roomId: string): Promise<any> {
        return await $fetch<any>(`${baseUrl}/rooms/${roomId}/media_status`)
    }    

  return {
    baseUrl,
    createRoom,
    getRoom,
    listRooms,
    joinRoom,
    leaveRoom,
    getHealth,
    createInvitation,
    sendInviteEmail,
    getInvitation,
    useInvitation,
    listInvitations,
    getMediaStatus
  }
}
