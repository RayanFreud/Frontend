// AI Store - AI chat and transcription state
import { defineStore } from 'pinia'
import type { AiMessage, AiSummary, AiAction, TranscriptionSegment } from '~/types'

export const useAiStore = defineStore('ai', () => {
    // Use the AI chat composable
    const aiChat = useAiChat()

    // Panel visibility
    const isPanelOpen = ref(false)
    const activeTab = ref<'chat' | 'summary' | 'actions' | 'transcription'>('chat')

    /**
     * Toggle AI panel visibility
     */
    function togglePanel(): void {
        isPanelOpen.value = !isPanelOpen.value
    }

    /**
     * Open panel with specific tab
     */
    function openPanel(tab: 'chat' | 'summary' | 'actions' | 'transcription' = 'chat'): void {
        isPanelOpen.value = true
        activeTab.value = tab
    }

    /**
     * Close panel
     */
    function closePanel(): void {
        isPanelOpen.value = false
    }

    /**
     * Request summary and open summary tab
     */
    async function generateSummary(): Promise<AiSummary> {
        openPanel('summary')
        return await aiChat.requestSummary()
    }

    /**
     * Request actions and open actions tab
     */
    async function extractActions(): Promise<AiAction[]> {
        openPanel('actions')
        return await aiChat.requestActions()
    }

    /**
     * Send a chat message
     */
    async function sendMessage(content: string): Promise<void> {
        await aiChat.askClarification(content)
    }

    return {
        // Panel state
        isPanelOpen,
        activeTab,

        // AI state from composable
        messages: aiChat.messages,
        isLoading: aiChat.isLoading,
        isStreaming: aiChat.isStreaming,
        currentSummary: aiChat.currentSummary,
        actions: aiChat.actions,
        transcriptionEnabled: aiChat.transcriptionEnabled,
        transcription: aiChat.transcription,
        error: aiChat.error,

        // Panel methods
        togglePanel,
        openPanel,
        closePanel,

        // AI methods
        generateSummary,
        extractActions,
        sendMessage,
        toggleTranscription: aiChat.toggleTranscription,
        updateActionStatus: aiChat.updateActionStatus,
        clearHistory: aiChat.clearHistory
    }
})
