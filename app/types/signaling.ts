// WebSocket Signaling Protocol Types

// Base message wrapper
export interface SignalingMessage<T = unknown> {
    type: string
    request_id?: string
    payload: T
}

// ========================
// Client → Server Messages
// ========================

export interface JoinRoomPayload {
    room_id: string
    display: string
}

export interface PublishOfferPayload {
    sdp: string
    kind: 'video' | 'audio' | 'both'
}

export interface TrickleIcePayload {
    candidate: string
    sdp_mid?: string
    sdp_mline_index?: number
    target?: 'publisher' | 'subscriber'
    feed_id?: string
}

export interface SubscribePayload {
    feeds: Array<{ feed_id: string; mid?: string }>
}

export interface UnsubscribePayload {
    feed_ids: string[]
}

export interface SubscribeAnswerPayload {
    sdp: string
}

export type ClientMessageType =
    | 'join_room'
    | 'publish_offer'
    | 'trickle_ice'
    | 'subscribe'
    | 'unsubscribe'
    | 'subscribe_answer'
    | 'leave'
    | 'ping'

// ========================
// Server → Client Messages
// ========================

export interface JoinedPayload {
    room_id: string
    user_id: string
    publishers: Array<{
        feed_id: string
        display: string
    }>
}

export interface PublisherJoinedPayload {
    feed_id: string
    display: string
    room_id: string
}

export interface PublisherLeftPayload {
    feed_id: string
    room_id: string
}

export interface PublishAnswerPayload {
    sdp: string
}

export interface SubscribeOfferPayload {
    sdp: string
    feed_ids: string[]
}

export interface RemoteCandidatePayload {
    candidate: string
    sdp_mid?: string
    sdp_mline_index?: number
    feed_id?: string
}

export interface ErrorPayload {
    code: number
    message: string
}

export type ServerMessageType =
    | 'joined'
    | 'publisher_joined'
    | 'publisher_left'
    | 'publish_answer'
    | 'subscribe_offer'
    | 'remote_candidate'
    | 'error'
    | 'pong'

// Union types for message handling
export type ClientMessage =
    | SignalingMessage<JoinRoomPayload> & { type: 'join_room' }
    | SignalingMessage<PublishOfferPayload> & { type: 'publish_offer' }
    | SignalingMessage<TrickleIcePayload> & { type: 'trickle_ice' }
    | SignalingMessage<SubscribePayload> & { type: 'subscribe' }
    | SignalingMessage<UnsubscribePayload> & { type: 'unsubscribe' }
    | SignalingMessage<SubscribeAnswerPayload> & { type: 'subscribe_answer' }
    | SignalingMessage<Record<string, never>> & { type: 'leave' }
    | SignalingMessage<Record<string, never>> & { type: 'ping' }

export type ServerMessage =
    | SignalingMessage<JoinedPayload> & { type: 'joined' }
    | SignalingMessage<PublisherJoinedPayload> & { type: 'publisher_joined' }
    | SignalingMessage<PublisherLeftPayload> & { type: 'publisher_left' }
    | SignalingMessage<PublishAnswerPayload> & { type: 'publish_answer' }
    | SignalingMessage<SubscribeOfferPayload> & { type: 'subscribe_offer' }
    | SignalingMessage<RemoteCandidatePayload> & { type: 'remote_candidate' }
    | SignalingMessage<ErrorPayload> & { type: 'error' }
    | SignalingMessage<Record<string, never>> & { type: 'pong' }
