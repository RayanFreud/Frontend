<script setup lang="ts">
const emit = defineEmits<{
  ready: [stream: MediaStream]
}>()

const mediaDevices = useMediaDevices()
const previewStream = ref<MediaStream | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const isLoading = ref(true)
const hasError = ref(false)

// Request permissions and start preview
onMounted(async () => {
  const hasPermissions = await mediaDevices.requestPermissions()

  if (hasPermissions) {
    await startPreview()
  } else {
    hasError.value = true
  }

  isLoading.value = false
})

// Stop preview on unmount
onUnmounted(() => {
  stopPreview()
})

// Watch for videoRef to be available and attach the stream
watch(videoRef, (el) => {
  if (el && previewStream.value) {
    el.srcObject = previewStream.value
  }
})

async function startPreview() {
  try {
    previewStream.value = await mediaDevices.getPreviewStream()

    // Use nextTick to ensure DOM is updated before attaching stream
    await nextTick()

    if (videoRef.value && previewStream.value) {
      videoRef.value.srcObject = previewStream.value
    }

    emit('ready', previewStream.value!)
  } catch (error) {
    console.error('[LocalPreview] Failed to start preview:', error)
    hasError.value = true
  }
}

function stopPreview() {
  if (previewStream.value) {
    previewStream.value.getTracks().forEach(track => track.stop())
    previewStream.value = null
  }
}

// Restart preview when device selection changes
watch(
  [
    () => mediaDevices.selectedCamera.value,
    () => mediaDevices.selectedMicrophone.value
  ],
  async () => {
    stopPreview()
    await startPreview()
  }
)
</script>

<template>
  <div class="relative rounded-2xl overflow-hidden bg-bg-elevated aspect-video">
    <!-- Loading state -->
    <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>

    <!-- Error state -->
    <div v-else-if="hasError" class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
      <Icon name="heroicons:video-camera-slash" class="w-16 h-16 text-text-muted mb-4" />
      <h3 class="text-lg font-medium text-text-primary mb-2">
        Camera access denied
      </h3>
      <p class="text-sm text-text-secondary mb-4">
        Please allow camera and microphone access to join the meeting.
      </p>
      <BaseButton variant="secondary" @click="mediaDevices.requestPermissions()">
        Try again
      </BaseButton>
    </div>

    <!-- Video preview -->
    <video v-else ref="videoRef" class="w-full h-full object-cover scale-x-[-1]" autoplay playsinline muted />

    <!-- Device selectors overlay -->
    <div v-if="!isLoading && !hasError" class="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
      <!-- Camera selector -->
      <select v-model="mediaDevices.selectedCamera.value"
        class="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-black/60 backdrop-blur-sm text-sm text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-accent">
        <option v-for="camera in mediaDevices.cameras.value" :key="camera.deviceId" :value="camera.deviceId">
          {{ camera.label }}
        </option>
      </select>

      <!-- Microphone selector -->
      <select v-model="mediaDevices.selectedMicrophone.value"
        class="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-black/60 backdrop-blur-sm text-sm text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-accent">
        <option v-for="mic in mediaDevices.microphones.value" :key="mic.deviceId" :value="mic.deviceId">
          {{ mic.label }}
        </option>
      </select>
    </div>
  </div>
</template>
