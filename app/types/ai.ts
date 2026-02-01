// AI Chat and Transcription Types

export interface AiMessage {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: string
    isStreaming?: boolean
}

export interface AiAction {
    id: string
    assignee: string
    task: string
    deadline?: string
    status: 'pending' | 'in_progress' | 'done'
    created_at: string
}

export interface AiSummary {
    id: string
    decisions: string[]
    actions: AiAction[]
    risks: string[]
    key_points: string[]
    generated_at: string
}

export interface TranscriptionSegment {
    id: string
    speaker: string
    speaker_id: string
    text: string
    start_time: number
    end_time: number
    confidence: number
}

export interface AiRequestPayload {
    type: 'summary' | 'actions' | 'clarification' | 'translation'
    context?: string
    target_language?: string
}

export interface AiResponsePayload {
    request_id: string
    type: 'summary' | 'actions' | 'clarification' | 'translation'
    content: string | AiSummary | AiAction[]
    generated_at: string
}

export interface AiChatState {
    messages: AiMessage[]
    isLoading: boolean
    currentSummary: AiSummary | null
    actions: AiAction[]
    transcriptionEnabled: boolean
    transcription: TranscriptionSegment[]
}
