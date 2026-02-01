<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const route = useRoute()
const router = useRouter()
const roomStore = useRoomStore()
const api = useApi()
const toastStore = useToastStore()

// State
const roomId = route.params.id as string
const displayName = ref((route.query.name as string) || '')
const roomInfo = ref<any>(null)
const isLoading = ref(true)
const isJoining = ref(false)
const previewReady = ref(false)

// Load room info
onMounted(async () => {
  try {
    roomInfo.value = await api.getRoom(roomId)
  } catch (error) {
    toastStore.error('Meeting not found')
    router.push('/')
  } finally {
    isLoading.value = false
  }
})

function handlePreviewReady() {
  previewReady.value = true
}

async function handleJoin() {
  if (!displayName.value.trim()) {
    toastStore.warning('Please enter your name')
    return
  }

  isJoining.value = true
  
  try {
    await roomStore.joinRoom(roomId, displayName.value)
    router.push(`/room/${roomId}`)
  } catch (error) {
    toastStore.error('Failed to join meeting')
  } finally {
    isJoining.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-3xl">
      <!-- Loading state -->
      <div v-if="isLoading" class="flex justify-center">
        <LoadingSpinner size="lg" />
      </div>

      <template v-else>
        <!-- Header -->
        <div class="text-center mb-8">
          <h1 class="text-2xl font-bold text-text-primary mb-2">
            {{ roomInfo?.name || 'Meeting Room' }}
          </h1>
          <p class="text-text-secondary">
            Check your camera and microphone before joining
          </p>
        </div>

        <BaseCard padding="lg">
          <div class="grid md:grid-cols-2 gap-6">
            <!-- Video preview -->
            <div>
              <LocalPreview @ready="handlePreviewReady" />
            </div>

            <!-- Join form -->
            <div class="flex flex-col justify-center">
              <div class="space-y-4">
                <BaseInput
                  v-model="displayName"
                  label="Your Name"
                  placeholder="Enter your display name"
                  icon="heroicons:user"
                />

                <!-- Room info -->
                <div class="p-4 rounded-xl bg-bg-elevated space-y-2">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-text-secondary">Meeting</span>
                    <span class="text-text-primary font-medium">{{ roomInfo?.name }}</span>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-text-secondary">Participants</span>
                    <span class="text-text-primary font-medium">{{ roomInfo?.participants_count || 0 }} joined</span>
                  </div>
                </div>

                <!-- Join button -->
                <BaseButton
                  class="w-full"
                  size="lg"
                  :loading="isJoining"
                  :disabled="!displayName.trim()"
                  @click="handleJoin"
                >
                  <Icon name="heroicons:video-camera" class="w-5 h-5" />
                  Join Meeting
                </BaseButton>

                <!-- Back link -->
                <NuxtLink
                  to="/"
                  class="block text-center text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel and return home
                </NuxtLink>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- Tips -->
        <div class="mt-6 flex items-center justify-center gap-6 text-sm text-text-muted">
          <div class="flex items-center gap-2">
            <Icon name="heroicons:microphone" class="w-4 h-4" />
            Check your microphone
          </div>
          <div class="flex items-center gap-2">
            <Icon name="heroicons:video-camera" class="w-4 h-4" />
            Check your camera
          </div>
          <div class="flex items-center gap-2">
            <Icon name="heroicons:speaker-wave" class="w-4 h-4" />
            Test your audio
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
