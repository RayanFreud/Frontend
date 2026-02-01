<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const router = useRouter()
const api = useApi()
const toastStore = useToastStore()

// State
const roomName = ref('')
const maxParticipants = ref(10)
const enableTranscription = ref(false)
const isCreating = ref(false)

async function handleCreate() {
  if (!roomName.value.trim()) {
    toastStore.warning('Please enter a meeting name')
    return
  }

  isCreating.value = true
  
  try {
    const room = await api.createRoom({
      name: roomName.value,
      max_publishers: maxParticipants.value
    })
    
    toastStore.success('Meeting created successfully')
    router.push(`/room/${room.room_id}/lobby`)
  } catch (error) {
    toastStore.error('Failed to create meeting')
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <div class="max-w-xl mx-auto px-4 py-12">
    <div class="mb-8">
      <NuxtLink
        to="/"
        class="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-4"
      >
        <Icon name="heroicons:arrow-left" class="w-4 h-4" />
        Back to home
      </NuxtLink>
      
      <h1 class="text-2xl font-bold text-text-primary">Create Meeting</h1>
      <p class="text-text-secondary">Set up your secure video conference</p>
    </div>

    <BaseCard padding="lg">
      <form class="space-y-6" @submit.prevent="handleCreate">
        <!-- Meeting name -->
        <BaseInput
          v-model="roomName"
          label="Meeting Name"
          placeholder="e.g., Q1 Planning Session"
          icon="heroicons:pencil"
        />

        <!-- Max participants -->
        <div>
          <label class="block text-sm font-medium text-text-secondary mb-1.5">
            Maximum Participants
          </label>
          <select
            v-model="maxParticipants"
            class="w-full px-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option :value="5">Up to 5 participants</option>
            <option :value="10">Up to 10 participants</option>
            <option :value="25">Up to 25 participants</option>
            <option :value="50">Up to 50 participants</option>
          </select>
        </div>

        <!-- Transcription toggle -->
        <div class="flex items-center justify-between p-4 rounded-xl bg-bg-elevated">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Icon name="heroicons:document-text" class="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p class="font-medium text-text-primary">Enable Transcription</p>
              <p class="text-sm text-text-secondary">AI will transcribe the meeting</p>
            </div>
          </div>
          <button
            type="button"
            :class="[
              'relative w-12 h-6 rounded-full transition-colors',
              enableTranscription ? 'bg-accent' : 'bg-bg-hover'
            ]"
            @click="enableTranscription = !enableTranscription"
          >
            <span
              :class="[
                'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
                enableTranscription ? 'translate-x-6' : 'translate-x-1'
              ]"
            />
          </button>
        </div>

        <!-- Privacy notice -->
        <div class="flex items-start gap-3 p-4 rounded-xl bg-accent/10 border border-accent/30">
          <Icon name="heroicons:shield-check" class="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div>
            <p class="text-sm font-medium text-accent">End-to-End Encrypted</p>
            <p class="text-sm text-text-secondary">
              Your meeting is encrypted. We never have access to your audio or video content.
            </p>
          </div>
        </div>

        <!-- Submit button -->
        <BaseButton
          class="w-full"
          size="lg"
          :loading="isCreating"
          type="submit"
        >
          <Icon name="heroicons:video-camera" class="w-5 h-5" />
          Create Meeting
        </BaseButton>
      </form>
    </BaseCard>
  </div>
</template>
