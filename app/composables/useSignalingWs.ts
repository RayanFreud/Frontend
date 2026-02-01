// WebSocket Signaling Composable for TrueGather
import type {
  SignalingMessage,
  ServerMessage,
  ErrorPayload
} from '~/types'

type MessageHandler = (message: ServerMessage) => void

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

// Shared State (Singleton)
const ws = ref<WebSocket | null>(null)
const isConnected = ref(false)
const isConnecting = ref(false)
const connectionError = ref<string | null>(null)

// Internal shared state
const pendingRequests = new Map<string, PendingRequest>()
const messageHandlers = new Map<string, Set<MessageHandler>>()
const REQUEST_TIMEOUT = 30000

// Reconnection state
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5
const INITIAL_BACKOFF = 1000
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
let currentWsUrl: string | null = null

export function useSignalingWs() {

  /**
   * Generate unique request ID
   */
  function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Connect to WebSocket server
   */
  async function connect(wsUrl: string): Promise<void> {
    // Build candidate URLs to try when connecting (fallbacks for dev environments)
    const candidates = new Set<string>()

    const normalizedInitial = wsUrl
      .replace('ws://0.0.0.0', 'ws://localhost')
      .replace('wss://0.0.0.0', 'wss://localhost')

    candidates.add(normalizedInitial)
    candidates.add(normalizedInitial.replace('localhost', '127.0.0.1'))

    if (normalizedInitial.startsWith('ws://')) {
      candidates.add(normalizedInitial.replace('ws://', 'wss://'))
      candidates.add(normalizedInitial.replace('ws://localhost', 'wss://localhost'))
    }

    // Use page hostname if available (useful when testing via local network)
    try {
      const pageHost = window.location.hostname
      if (pageHost) {
        candidates.add(normalizedInitial.replace(/\/\/[^/:]+/, `//${pageHost}`))
      }
    } catch (e) {
      // ignore in non-browser contexts
    }

    // If already connected to one of the candidates, do nothing
    if (isConnected.value && currentWsUrl && candidates.has(currentWsUrl)) {
      console.log('[SignalingWS] Already connected to', currentWsUrl)
      return
    }

    if (isConnecting.value) {
      return
    }

    isConnecting.value = true
    connectionError.value = null

    // Try each candidate sequentially until one succeeds
    let lastErr: Error | null = null
    for (const url of candidates) {
      try {
        console.log('[SignalingWS] Attempting connect to:', url)

        // Close existing socket if any
        if (ws.value) {
          ws.value.close()
        }

        await new Promise<void>((resolve, reject) => {
          const socket = new WebSocket(url)
          let opened = false

          const onOpen = () => {
            opened = true
            ws.value = socket
            isConnected.value = true
            isConnecting.value = false
            reconnectAttempts = 0
            currentWsUrl = url
            socket.onmessage = (event) => handleMessage(event.data)
            socket.onclose = (event) => {
              console.log('[SignalingWS] Disconnected:', event.code, event.reason)
              isConnected.value = false
              isConnecting.value = false
              if (event.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS && currentWsUrl) {
                scheduleReconnect(currentWsUrl)
              }
            }
            socket.onerror = (error) => {
              const errMsg = `WebSocket connection failed to ${url}`
              connectionError.value = errMsg
              const e = (error as Event)
              const detail = (e && (e as any).message) ? (e as any).message : ''
              reject(new Error(`${errMsg} ${detail}`.trim()))
            }
            resolve()
          }

          const onError = (ev: Event) => {
            if (!opened) {
              reject(new Error(`WebSocket connect error to ${url}`))
            }
          }

          socket.addEventListener('open', onOpen)
          socket.addEventListener('error', onError)

          // Safety timeout for this attempt
          setTimeout(() => {
            if (!opened) {
              try { socket.close() } catch (_) {}
              reject(new Error(`Timeout connecting to ${url}`))
            }
          }, 5000)
        })

        // Successful connect
        return
      } catch (err) {
        console.warn('[SignalingWS] Connect failed for', url, err)
        lastErr = err as Error
        // try next candidate
      }
    }

    isConnecting.value = false
    throw lastErr || new Error('All connection attempts failed')
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  function scheduleReconnect(wsUrl: string) {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
    }

    const backoff = Math.min(INITIAL_BACKOFF * Math.pow(2, reconnectAttempts), 30000)
    reconnectAttempts++

    console.log(`[SignalingWS] Reconnecting in ${backoff}ms (attempt ${reconnectAttempts})`)

    reconnectTimeout = setTimeout(() => {
      connect(wsUrl)
    }, backoff)
  }

  /**
   * Handle incoming messages
   */
  function handleMessage(data: string) {
    try {
      const message = JSON.parse(data) as ServerMessage
      console.log('[SignalingWS] Received:', message.type, message)

      // Handle request/response correlation
      if (message.request_id && pendingRequests.has(message.request_id)) {
        const pending = pendingRequests.get(message.request_id)!
        clearTimeout(pending.timeout)
        pendingRequests.delete(message.request_id)

        if (message.type === 'error') {
          pending.reject(new Error((message.payload as ErrorPayload).message))
        } else {
          pending.resolve(message)
        }
        return
      }

      // Notify event handlers
      const handlers = messageHandlers.get(message.type)
      if (handlers) {
        handlers.forEach(handler => handler(message))
      }

      // Also notify wildcard handlers
      const wildcardHandlers = messageHandlers.get('*')
      if (wildcardHandlers) {
        wildcardHandlers.forEach(handler => handler(message))
      }
    } catch (error) {
      console.error('[SignalingWS] Failed to parse message:', error)
    }
  }

  /**
   * Send a message and wait for response
   */
  async function sendRequest<T>(type: string, payload: unknown): Promise<T> {
    const requestId = generateRequestId()

    if (!ws.value || !isConnected.value) {
      throw new Error('WebSocket not connected')
    }

    const message: SignalingMessage = {
      type,
      request_id: requestId,
      payload
    }

    console.log('[SignalingWS] Sending:', type, message)

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(requestId)
        reject(new Error(`Request ${type} timed out`))
      }, REQUEST_TIMEOUT)

      pendingRequests.set(requestId, { resolve: resolve as (value: unknown) => void, reject, timeout })

      ws.value!.send(JSON.stringify(message))
    })
  }

  /**
   * Send a message without waiting for response
   */
  function send(type: string, payload: unknown): void {
    if (!ws.value || !isConnected.value) {
      throw new Error('WebSocket not connected')
    }

    const message: SignalingMessage = {
      type,
      payload
    }

    console.log('[SignalingWS] Sending (fire-and-forget):', type, message)
    ws.value.send(JSON.stringify(message))
  }

  /**
   * Add event listener for specific message type
   */
  function on(type: string, handler: MessageHandler): void {
    if (!messageHandlers.has(type)) {
      messageHandlers.set(type, new Set())
    }
    messageHandlers.get(type)!.add(handler)
  }

  /**
   * Remove event listener
   */
  function off(type: string, handler: MessageHandler): void {
    const handlers = messageHandlers.get(type)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  function disconnect(): void {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }

    currentWsUrl = null

    if (ws.value) {
      ws.value.close(1000, 'Client disconnect')
      ws.value = null
    }

    isConnected.value = false

    // Reject all pending requests
    pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeout)
      pending.reject(new Error('WebSocket disconnected'))
    })
    pendingRequests.clear()
  }

  return {
    // State
    isConnected: readonly(isConnected),
    isConnecting: readonly(isConnecting),
    connectionError: readonly(connectionError),

    // Methods
    connect,
    disconnect,
    sendRequest,
    send,
    on,
    off
  }
}
