// AI Chat Composable
import type { AiMessage, AiSummary, AiAction, TranscriptionSegment } from '~/types'

export function useAiChat() {
    // State
    const messages = ref<AiMessage[]>([])
    const isLoading = ref(false)
    const isStreaming = ref(false)
    const currentSummary = ref<AiSummary | null>(null)
    const actions = ref<AiAction[]>([])
    const transcriptionEnabled = ref(false)
    const transcription = ref<TranscriptionSegment[]>([])
    const error = ref<string | null>(null)

    // Mock AI responses
    const mockResponses = {
        summary: `## Résumé de la réunion

### Points clés discutés
- Discussion sur la stratégie Q1 2026
- Revue des objectifs de croissance
- Planification des ressources

### Décisions prises
1. Augmentation du budget marketing de 15%
2. Recrutement de 3 développeurs supplémentaires
3. Lancement du nouveau produit prévu pour Mars 2026

### Prochaines étapes
- Finaliser le plan d'action d'ici vendredi
- Réunion de suivi la semaine prochaine`,

        actions: [
            {
                id: 'action_1',
                assignee: 'Alice',
                task: 'Finaliser le budget marketing Q1',
                deadline: '2026-01-20',
                status: 'pending' as const,
                created_at: new Date().toISOString()
            },
            {
                id: 'action_2',
                assignee: 'Bob',
                task: 'Rédiger les offres d\'emploi développeurs',
                deadline: '2026-01-18',
                status: 'pending' as const,
                created_at: new Date().toISOString()
            },
            {
                id: 'action_3',
                assignee: 'Charlie',
                task: 'Préparer la roadmap produit',
                deadline: '2026-01-25',
                status: 'pending' as const,
                created_at: new Date().toISOString()
            }
        ]
    }

    /**
     * Generate unique message ID
     */
    function generateId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    /**
     * Add a user message
     */
    function addUserMessage(content: string): AiMessage {
        const message: AiMessage = {
            id: generateId(),
            role: 'user',
            content,
            timestamp: new Date().toISOString()
        }
        messages.value.push(message)
        return message
    }

    /**
     * Add an assistant message
     */
    function addAssistantMessage(content: string, streaming = false): AiMessage {
        const message: AiMessage = {
            id: generateId(),
            role: 'assistant',
            content,
            timestamp: new Date().toISOString(),
            isStreaming: streaming
        }
        messages.value.push(message)
        return message
    }

    /**
     * Simulate streaming response
     */
    async function streamResponse(content: string): Promise<void> {
        isStreaming.value = true
        const message = addAssistantMessage('', true)

        const words = content.split(' ')
        for (let i = 0; i < words.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 50))
            message.content += (i > 0 ? ' ' : '') + words[i]

            // Update the message in the array to trigger reactivity
            const index = messages.value.findIndex(m => m.id === message.id)
            if (index !== -1) {
                messages.value[index] = { ...message }
            }
        }

        message.isStreaming = false
        const finalIndex = messages.value.findIndex(m => m.id === message.id)
        if (finalIndex !== -1) {
            messages.value[finalIndex] = { ...message }
        }

        isStreaming.value = false
    }

    /**
     * Request meeting summary
     */
    async function requestSummary(): Promise<AiSummary> {
        isLoading.value = true
        error.value = null

        try {
            addUserMessage('Génère un résumé de la réunion')

            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 500))

            // Stream the response
            await streamResponse(mockResponses.summary)

            // Create summary object
            const summary: AiSummary = {
                id: generateId(),
                decisions: [
                    'Augmentation du budget marketing de 15%',
                    'Recrutement de 3 développeurs',
                    'Lancement produit Mars 2026'
                ],
                actions: mockResponses.actions,
                risks: [
                    'Délais serrés pour le recrutement',
                    'Budget marketing dépendant des résultats Q4'
                ],
                key_points: [
                    'Stratégie Q1 2026',
                    'Objectifs de croissance',
                    'Planification des ressources'
                ],
                generated_at: new Date().toISOString()
            }

            currentSummary.value = summary
            actions.value = [...mockResponses.actions]

            return summary
        } catch (err) {
            error.value = (err as Error).message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Request action items extraction
     */
    async function requestActions(): Promise<AiAction[]> {
        isLoading.value = true
        error.value = null

        try {
            addUserMessage('Extrait les actions de la réunion')

            await new Promise(resolve => setTimeout(resolve, 500))

            const actionsList = mockResponses.actions.map(a =>
                `- **${a.assignee}**: ${a.task} (échéance: ${a.deadline})`
            ).join('\n')

            await streamResponse(`## Actions identifiées\n\n${actionsList}`)

            actions.value = [...mockResponses.actions]
            return actions.value
        } catch (err) {
            error.value = (err as Error).message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Ask for clarification
     */
    async function askClarification(question: string): Promise<string> {
        isLoading.value = true
        error.value = null

        try {
            addUserMessage(question)

            await new Promise(resolve => setTimeout(resolve, 300))

            // Generate contextual response
            const response = `Basé sur la discussion de la réunion, voici ma compréhension:

${question.toLowerCase().includes('budget')
                    ? 'Le budget discuté concerne principalement le marketing Q1, avec une augmentation proposée de 15% par rapport à Q4 2025.'
                    : question.toLowerCase().includes('date') || question.toLowerCase().includes('deadline')
                        ? 'Les principales échéances mentionnées sont: fin janvier pour le plan d\'action, et mars 2026 pour le lancement produit.'
                        : 'Je peux vous fournir plus de détails sur ce point. Pourriez-vous préciser votre question?'
                }`

            await streamResponse(response)

            return response
        } catch (err) {
            error.value = (err as Error).message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Toggle transcription
     */
    function toggleTranscription(): boolean {
        transcriptionEnabled.value = !transcriptionEnabled.value

        if (transcriptionEnabled.value) {
            // Simulate transcription segments
            simulateTranscription()
        }

        return transcriptionEnabled.value
    }

    /**
     * Simulate transcription (mock)
     */
    function simulateTranscription(): void {
        const mockSegments: TranscriptionSegment[] = [
            {
                id: 'seg_1',
                speaker: 'Alice',
                speaker_id: 'user_1',
                text: 'Bienvenue à tous pour cette réunion de planification Q1.',
                start_time: 0,
                end_time: 3.5,
                confidence: 0.95
            },
            {
                id: 'seg_2',
                speaker: 'Bob',
                speaker_id: 'user_2',
                text: 'Merci Alice. Commençons par le budget marketing.',
                start_time: 4,
                end_time: 7,
                confidence: 0.92
            },
            {
                id: 'seg_3',
                speaker: 'Charlie',
                speaker_id: 'user_3',
                text: 'Je propose une augmentation de 15% pour soutenir le lancement.',
                start_time: 8,
                end_time: 12,
                confidence: 0.89
            }
        ]

        transcription.value = mockSegments
    }

    /**
     * Update action status
     */
    function updateActionStatus(actionId: string, status: AiAction['status']): void {
        const index = actions.value.findIndex(a => a.id === actionId)
        if (index !== -1) {
            actions.value[index] = { ...actions.value[index], status }
        }
    }

    /**
     * Clear chat history
     */
    function clearHistory(): void {
        messages.value = []
        currentSummary.value = null
    }

    return {
        // State
        messages: readonly(messages),
        isLoading: readonly(isLoading),
        isStreaming: readonly(isStreaming),
        currentSummary: readonly(currentSummary),
        actions,
        transcriptionEnabled: readonly(transcriptionEnabled),
        transcription: readonly(transcription),
        error: readonly(error),

        // Methods
        requestSummary,
        requestActions,
        askClarification,
        toggleTranscription,
        updateActionStatus,
        clearHistory,
        addUserMessage,
        addAssistantMessage
    }
}
