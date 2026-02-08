<script setup lang="ts">
const emit = defineEmits<{
  ready: [stream: MediaStream]
}>()

const mediaDevices = useMediaDevices()
const previewStream = ref<MediaStream | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)

const isLoading = ref(true)
const hasError = ref(false)

/**
 * Start preview (camera + mic)
 */
async function startPreview() {
  try {
    previewStream.value = await mediaDevices.getPreviewStream()
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

/**
 * Retry permissions + restart preview
 */
async function retry() {
  isLoading.value = true
  hasError.value = false

  const ok = await mediaDevices.requestPermissions()
  if (ok) {
    await startPreview()
  } else {
    hasError.value = true
  }

  isLoading.value = false
}

onMounted(async () => {
  // We try once at mount; if user blocks, they can retry.
  await retry()
})

onUnmounted(() => {
  stopPreview()
})

watch(videoRef, (el) => {
  if (el && previewStream.value) {
    el.srcObject = previewStream.value
  }
})

// Restart preview when device selection changes (only if we already have a stream)
watch(
  [
    () => mediaDevices.selectedCamera.value,
    () => mediaDevices.selectedMicrophone.value
  ],
  async () => {
    if (hasError.value) return
    stopPreview()
    await startPreview()
  }
)
</script>

<template>
  <div class="relative rounded-2xl overflow-hidden bg-bg-elevated aspect-video">
    <!-- Loading -->
    <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>

    <!-- Error -->
    <div v-else-if="hasError" class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
      <Icon name="heroicons:video-camera-slash" class="w-16 h-16 text-text-muted mb-4" />
      <h3 class="text-lg font-medium text-text-primary mb-2">
        Camera / mic not available
      </h3>
      <p class="text-sm text-text-secondary mb-4">
        You can still join the meeting, but enable permissions if you want video/audio preview.
      </p>
      <BaseButton variant="secondary" @click="retry">
        Try again
      </BaseButton>
    </div>

    <!-- Preview -->
    <video
      v-else
      ref="videoRef"
      class="w-full h-full object-cover scale-x-[-1]"
      autoplay
      playsinline
      muted
    />

    <!-- Selectors -->
    <div v-if="!isLoading && !hasError" class="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
      <select
        v-model="mediaDevices.selectedCamera.value"
        class="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-black/60 backdrop-blur-sm text-sm text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option v-for="camera in mediaDevices.cameras.value" :key="camera.deviceId" :value="camera.deviceId">
          {{ camera.label }}
        </option>
      </select>

      <select
        v-model="mediaDevices.selectedMicrophone.value"
        class="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-black/60 backdrop-blur-sm text-sm text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option v-for="mic in mediaDevices.microphones.value" :key="mic.deviceId" :value="mic.deviceId">
          {{ mic.label }}
        </option>
      </select>
    </div>
  </div>
</template>
