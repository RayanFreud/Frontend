// Re-export all types
export * from './room'
export * from './signaling'
export * from './ai'

// Frontend/app/types/index.ts

export type RoomStatus = 'active' | 'inactive'

export type Room = {
  room_id: string
  name: string
  created_at: string
  max_publishers: number
  ttl_seconds?: number
  status?: RoomStatus
  participants_count?: number
}

export type HealthResponse = {
  status: string
  redis: boolean
  uptime_seconds?: number
}

export type CreateRoomRequest = {
  name: string
  max_publishers?: number
  ttl_seconds?: number
}

/**
 * JoinRoomRequest - Option B
 * - Guest must send BOTH invite_token + invite_code
 * - Host sends creator_key (stored locally on host device)
 */
export type JoinRoomRequest = {
  display: string

  // Guest flow (required together)
  invite_token?: string
  invite_code?: string

  // Host flow (creator)
  creator_key?: string
}

export type JoinResponse = {
  room_id: string
  user_id: string
  ws_url: string
  token: string
  ice_servers: RTCIceServer[]
  expires_in: number
  participants?: Array<{
    user_id: string
    display: string
    joined_at: string | number
  }>
}

export type CreateInvitationRequest = {
  ttl_seconds?: number
  max_uses?: number | null
}

/**
 * CreateInvitationResponse
 * This endpoint does NOT return invite code.
 * The code is sent via email endpoint.
 */
export type CreateInvitationResponse = {
  token: string
  room_id: string
  expires_at: string
  max_uses?: number | null
  invite_url: string
}

export type InvitationInfo = {
  token: string
  room_id: string
  room_name: string
  expires_at: string
  is_valid: boolean
}

export type RoomInvitation = {
  token: string
  room_id: string
  created_by: string
  created_at: string
  expires_at: string
  max_uses?: number | null
  uses: number
  email?: string | null

  // backend only; not used by frontend normally
  code_hash?: string
}

export type InviteEmailRequest = {
  emails: string[]
  ttl_seconds?: number
  max_uses?: number | null
  subject?: string
  message?: string
}

export type InviteEmailResponse = {
  sent: number
  token: string
  invite_url: string
  room_id: string
}
