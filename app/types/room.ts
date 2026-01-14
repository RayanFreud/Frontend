// Room and Participant types

export interface Room {
    room_id: string
    name: string
    created_at: string
    max_publishers: number
    status: 'active' | 'inactive'
    participants_count: number
    ttl_seconds: number
}

export interface Participant {
    user_id: string
    display: string
    feed_id?: string
    is_publishing: boolean
    is_muted: boolean
    is_video_off: boolean
    joined_at: string
}

export interface Publisher {
    feed_id: string
    display: string
    user_id: string
    joined_at: string
    stream?: MediaStream
}

export interface JoinResponse {
    room_id: string
    user_id: string
    ws_url: string
    token: string
    ice_servers: RTCIceServer[]
    expires_in: number
}

export interface CreateRoomRequest {
    name: string
    max_publishers?: number
    ttl_seconds?: number
}

export interface JoinRoomRequest {
    display: string
    access_code?: string
}

export interface HealthResponse {
    status: 'healthy' | 'unhealthy'
    redis: 'connected' | 'disconnected'
    janus: 'connected' | 'disconnected'
    timestamp: string
}

export interface ApiError {
    error: string
    code?: string
}
