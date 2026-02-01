<script setup lang="ts">
const aiStore = useAiStore()

const messageInput = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

// Auto-scroll to bottom when new messages arrive
watch(
  () => aiStore.messages.length,
  () => {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    })
  }
)

async function handleSendMessage() {
  if (!messageInput.value.trim() || aiStore.isLoading) return
  
  const message = messageInput.value
  messageInput.value = ''
  
  await aiStore.sendMessage(message)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSendMessage()
  }
}
</script>

<template>
  <div class="flex flex-col h-full bg-bg-secondary">
    <!-- Header with tabs -->
    <div class="border-b border-border">
      <div class="flex items-center justify-between p-4 pb-0">
        <div class="flex items-center gap-2">
          <Icon name="heroicons:sparkles" class="w-5 h-5 text-accent" />
          <h2 class="font-semibold text-text-primary">AI Assistant</h2>
        </div>
        <button
          class="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          @click="aiStore.closePanel()"
        >
          <Icon name="heroicons:x-mark" class="w-5 h-5" />
        </button>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 px-4 pt-3">
        <button
          v-for="tab in ['chat', 'summary', 'actions'] as const"
          :key="tab"
          :class="[
            'px-3 py-2 text-sm font-medium rounded-t-lg transition-colors',
            aiStore.activeTab === tab
              ? 'bg-bg-elevated text-text-primary border-b-2 border-accent'
              : 'text-text-secondary hover:text-text-primary'
          ]"
          @click="aiStore.activeTab = tab"
        >
          {{ tab === 'chat' ? 'Chat' : tab === 'summary' ? 'Summary' : 'Actions' }}
        </button>
      </div>
    </div>

    <!-- Chat tab -->
    <template v-if="aiStore.activeTab === 'chat'">
      <!-- Messages -->
      <div
        ref="messagesContainer"
        class="flex-1 overflow-y-auto p-4 space-y-4"
      >
        <!-- Empty state -->
        <div
          v-if="aiStore.messages.length === 0"
          class="flex flex-col items-center justify-center h-full text-center py-8"
        >
          <div class="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mb-4">
            <Icon name="heroicons:sparkles" class="w-8 h-8 text-accent" />
          </div>
          <h3 class="font-medium text-text-primary mb-2">AI Assistant</h3>
          <p class="text-sm text-text-secondary max-w-[200px]">
            Ask questions about the meeting or request a summary.
          </p>
        </div>

        <!-- Messages list -->
        <div
          v-for="message in aiStore.messages"
          :key="message.id"
          :class="[
            'flex gap-3',
            message.role === 'user' ? 'justify-end' : 'justify-start'
          ]"
        >
          <!-- Avatar for assistant -->
          <div
            v-if="message.role === 'assistant'"
            class="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0"
          >
            <Icon name="heroicons:sparkles" class="w-4 h-4 text-accent" />
          </div>

          <!-- Message bubble -->
          <div
            :class="[
              'max-w-[80%] px-4 py-2.5 rounded-2xl',
              message.role === 'user'
                ? 'bg-accent text-white rounded-br-md'
                : 'bg-bg-elevated text-text-primary rounded-bl-md'
            ]"
          >
            <p class="text-sm whitespace-pre-wrap">{{ message.content }}</p>
            
            <!-- Streaming indicator -->
            <span
              v-if="message.isStreaming"
              class="inline-block w-2 h-4 bg-accent animate-pulse ml-1"
            />
          </div>
        </div>

        <!-- Loading indicator -->
        <div v-if="aiStore.isLoading && !aiStore.isStreaming" class="flex gap-3">
          <div class="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
            <LoadingSpinner size="sm" />
          </div>
          <div class="px-4 py-2.5 rounded-2xl bg-bg-elevated rounded-bl-md">
            <span class="text-sm text-text-secondary">Thinking...</span>
          </div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="px-4 py-2 flex gap-2 flex-wrap">
        <button
          class="px-3 py-1.5 text-xs font-medium rounded-full bg-bg-elevated text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          :disabled="aiStore.isLoading"
          @click="aiStore.generateSummary()"
        >
          📝 Summary
        </button>
        <button
          class="px-3 py-1.5 text-xs font-medium rounded-full bg-bg-elevated text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          :disabled="aiStore.isLoading"
          @click="aiStore.extractActions()"
        >
          ✅ Actions
        </button>
      </div>

      <!-- Input -->
      <div class="p-4 border-t border-border">
        <div class="flex gap-2">
          <input
            v-model="messageInput"
            type="text"
            placeholder="Ask anything about the meeting..."
            class="flex-1 px-4 py-2.5 rounded-xl bg-bg-elevated border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
            :disabled="aiStore.isLoading"
            @keydown="handleKeydown"
          >
          <button
            class="p-2.5 rounded-xl bg-accent text-white hover:bg-accent-light transition-colors disabled:opacity-50"
            :disabled="!messageInput.trim() || aiStore.isLoading"
            @click="handleSendMessage"
          >
            <Icon name="heroicons:paper-airplane" class="w-5 h-5" />
          </button>
        </div>
      </div>
    </template>

    <!-- Summary tab -->
    <template v-else-if="aiStore.activeTab === 'summary'">
      <div class="flex-1 overflow-y-auto p-4">
        <div v-if="aiStore.currentSummary" class="space-y-4">
          <!-- Key points -->
          <div>
            <h3 class="text-sm font-medium text-text-secondary mb-2">Key Points</h3>
            <ul class="space-y-1">
              <li
                v-for="(point, i) in aiStore.currentSummary.key_points"
                :key="i"
                class="flex items-start gap-2 text-sm text-text-primary"
              >
                <span class="text-accent">•</span>
                {{ point }}
              </li>
            </ul>
          </div>

          <!-- Decisions -->
          <div>
            <h3 class="text-sm font-medium text-text-secondary mb-2">Decisions</h3>
            <ul class="space-y-1">
              <li
                v-for="(decision, i) in aiStore.currentSummary.decisions"
                :key="i"
                class="flex items-start gap-2 text-sm text-text-primary"
              >
                <Icon name="heroicons:check-circle" class="w-4 h-4 text-success shrink-0 mt-0.5" />
                {{ decision }}
              </li>
            </ul>
          </div>

          <!-- Risks -->
          <div v-if="aiStore.currentSummary.risks.length > 0">
            <h3 class="text-sm font-medium text-text-secondary mb-2">Risks</h3>
            <ul class="space-y-1">
              <li
                v-for="(risk, i) in aiStore.currentSummary.risks"
                :key="i"
                class="flex items-start gap-2 text-sm text-text-primary"
              >
                <Icon name="heroicons:exclamation-triangle" class="w-4 h-4 text-warning shrink-0 mt-0.5" />
                {{ risk }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else class="flex flex-col items-center justify-center h-full text-center">
          <Icon name="heroicons:document-text" class="w-12 h-12 text-text-muted mb-3" />
          <p class="text-sm text-text-secondary mb-4">No summary generated yet</p>
          <BaseButton
            size="sm"
            :loading="aiStore.isLoading"
            @click="aiStore.generateSummary()"
          >
            Generate Summary
          </BaseButton>
        </div>
      </div>
    </template>

    <!-- Actions tab -->
    <template v-else-if="aiStore.activeTab === 'actions'">
      <div class="flex-1 overflow-y-auto p-4">
        <div v-if="aiStore.actions.length > 0" class="space-y-2">
          <div
            v-for="action in aiStore.actions"
            :key="action.id"
            class="p-3 rounded-xl bg-bg-elevated border border-border"
          >
            <div class="flex items-start gap-3">
              <button
                :class="[
                  'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                  action.status === 'done'
                    ? 'bg-success border-success'
                    : 'border-border hover:border-accent'
                ]"
                @click="aiStore.updateActionStatus(action.id, action.status === 'done' ? 'pending' : 'done')"
              >
                <Icon
                  v-if="action.status === 'done'"
                  name="heroicons:check"
                  class="w-3 h-3 text-white"
                />
              </button>
              
              <div class="flex-1 min-w-0">
                <p
                  :class="[
                    'text-sm',
                    action.status === 'done' ? 'text-text-muted line-through' : 'text-text-primary'
                  ]"
                >
                  {{ action.task }}
                </p>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-xs text-accent">{{ action.assignee }}</span>
                  <span v-if="action.deadline" class="text-xs text-text-muted">
                    Due: {{ action.deadline }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else class="flex flex-col items-center justify-center h-full text-center">
          <Icon name="heroicons:clipboard-document-list" class="w-12 h-12 text-text-muted mb-3" />
          <p class="text-sm text-text-secondary mb-4">No action items yet</p>
          <BaseButton
            size="sm"
            :loading="aiStore.isLoading"
            @click="aiStore.extractActions()"
          >
            Extract Actions
          </BaseButton>
        </div>
      </div>
    </template>
  </div>
</template>
