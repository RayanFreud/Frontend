<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const router = useRouter()
const api = useApi()

// State
const showCreateModal = ref(false)
const showJoinModal = ref(false)
const roomName = ref('')
const joinRoomId = ref('')
const displayName = ref('')
const isCreating = ref(false)
const isJoining = ref(false)

// Create room
async function handleCreateRoom() {
  if (!roomName.value.trim()) return
  
  isCreating.value = true
  try {
    const room = await api.createRoom({ name: roomName.value })
    showCreateModal.value = false
    router.push(`/room/${room.room_id}/lobby`)
  } catch (error) {
    console.error('Failed to create room:', error)
  } finally {
    isCreating.value = false
  }
}

// Join room
async function handleJoinRoom() {
  if (!joinRoomId.value.trim() || !displayName.value.trim()) return
  
  isJoining.value = true
  try {
    router.push({
      path: `/room/${joinRoomId.value}/lobby`,
      query: { name: displayName.value }
    })
  } catch (error) {
    console.error('Failed to join room:', error)
  } finally {
    isJoining.value = false
  }
}
</script>

<template>
  <div class="min-h-screen">
    <!-- Hero section -->
    <section class="relative overflow-hidden">
      <!-- Background gradient -->
      <div class="absolute inset-0 bg-gradient-to-br from-accent/20 via-bg-primary to-purple-900/20" />
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />
      
      <!-- Grid pattern overlay -->
      <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />

      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
        <div class="text-center">
          <!-- Badge -->
          <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/30 mb-8">
            <Icon name="heroicons:shield-check" class="w-4 h-4 text-accent" />
            <span class="text-sm font-medium text-accent">End-to-End Encrypted</span>
          </div>

          <!-- Heading -->
          <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-text-primary mb-6 tracking-tight">
            Secure Video Meetings
            <br />
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-accent to-purple-400">
              with AI Assistance
            </span>
          </h1>

          <!-- Subheading -->
          <p class="max-w-2xl mx-auto text-lg text-text-secondary mb-10">
            Privacy-first video conferencing platform. Your meetings are encrypted end-to-end.
            Get AI-powered summaries and action items only when you ask.
          </p>

          <!-- CTA buttons -->
          <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
            <BaseButton size="lg" @click="showCreateModal = true">
              <Icon name="heroicons:video-camera" class="w-5 h-5" />
              Create Meeting
            </BaseButton>
            <BaseButton variant="secondary" size="lg" @click="showJoinModal = true">
              <Icon name="heroicons:arrow-right-on-rectangle" class="w-5 h-5" />
              Join Meeting
            </BaseButton>
          </div>
        </div>
      </div>
    </section>

    <!-- Features section -->
    <section class="py-24 bg-bg-secondary/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold text-text-primary mb-4">
            Built for Privacy & Productivity
          </h2>
          <p class="text-text-secondary max-w-2xl mx-auto">
            Every feature designed with security and user control in mind.
          </p>
        </div>

        <div class="grid md:grid-cols-3 gap-8">
          <!-- Feature 1 -->
          <BaseCard padding="lg" class="text-center">
            <div class="w-14 h-14 mx-auto mb-6 rounded-2xl bg-accent/20 flex items-center justify-center">
              <Icon name="heroicons:lock-closed" class="w-7 h-7 text-accent" />
            </div>
            <h3 class="text-xl font-semibold text-text-primary mb-3">
              End-to-End Encryption
            </h3>
            <p class="text-text-secondary">
              Your audio and video are encrypted using DTLS-SRTP. We never have access to your meeting content.
            </p>
          </BaseCard>

          <!-- Feature 2 -->
          <BaseCard padding="lg" class="text-center">
            <div class="w-14 h-14 mx-auto mb-6 rounded-2xl bg-purple-500/20 flex items-center justify-center">
              <Icon name="heroicons:sparkles" class="w-7 h-7 text-purple-400" />
            </div>
            <h3 class="text-xl font-semibold text-text-primary mb-3">
              AI on Your Terms
            </h3>
            <p class="text-text-secondary">
              Our AI assistant only processes data when you explicitly ask. Get summaries and action items on demand.
            </p>
          </BaseCard>

          <!-- Feature 3 -->
          <BaseCard padding="lg" class="text-center">
            <div class="w-14 h-14 mx-auto mb-6 rounded-2xl bg-green-500/20 flex items-center justify-center">
              <Icon name="heroicons:clipboard-document-check" class="w-7 h-7 text-green-400" />
            </div>
            <h3 class="text-xl font-semibold text-text-primary mb-3">
              Structured Meetings
            </h3>
            <p class="text-text-secondary">
              Extract decisions, action items, and key points automatically. Never miss a follow-up again.
            </p>
          </BaseCard>
        </div>
      </div>
    </section>

    <!-- Create Room Modal -->
    <BaseModal v-model="showCreateModal" title="Create Meeting" size="sm">
      <div class="space-y-4">
        <BaseInput
          v-model="roomName"
          label="Meeting Name"
          placeholder="e.g., Q1 Planning"
        />
      </div>

      <template #footer>
        <BaseButton variant="ghost" @click="showCreateModal = false">
          Cancel
        </BaseButton>
        <BaseButton
          :loading="isCreating"
          :disabled="!roomName.trim()"
          @click="handleCreateRoom"
        >
          Create
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Join Room Modal -->
    <BaseModal v-model="showJoinModal" title="Join Meeting" size="sm">
      <div class="space-y-4">
        <BaseInput
          v-model="joinRoomId"
          label="Meeting ID"
          placeholder="Enter meeting ID or paste link"
        />
        <BaseInput
          v-model="displayName"
          label="Your Name"
          placeholder="How should we call you?"
        />
      </div>

      <template #footer>
        <BaseButton variant="ghost" @click="showJoinModal = false">
          Cancel
        </BaseButton>
        <BaseButton
          :loading="isJoining"
          :disabled="!joinRoomId.trim() || !displayName.trim()"
          @click="handleJoinRoom"
        >
          Join
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
