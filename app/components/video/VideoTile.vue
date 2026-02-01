<script setup lang="ts">
interface Props {
  stream?: MediaStream | null
  displayName: string
  isMuted?: boolean
  isVideoOff?: boolean
  isLocal?: boolean
  isActive?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  isMuted: false,
  isVideoOff: false,
  isLocal: false,
  isActive: false,
  size: 'md'
})

const videoRef = ref<HTMLVideoElement | null>(null)
const settingsStore = useSettingsStore()

// Attach stream to video element
watch(
  () => props.stream,
  (stream) => {
    if (videoRef.value && stream) {
      videoRef.value.srcObject = stream
    }
  },
  { immediate: true }
)

// Video element classes
const roomStore = useRoomStore()

const videoClasses = computed(() => [
  'w-full h-full object-cover',
  // Mirror local camera preview only if setting is enabled AND we are not screen sharing
  props.isLocal && settingsStore.settings.mirrorLocalVideo && !roomStore.isScreenSharing ? 'scale-x-[-1]' : ''
])

// Container size classes
const sizeClasses = {
  sm: 'min-h-[120px]',
  md: 'min-h-[180px]',
  lg: 'min-h-[240px]'
}
</script>

<template>
  <div
    :class="[
      'relative rounded-xl overflow-hidden bg-bg-elevated',
      'transition-all duration-300',
      isActive ? 'ring-2 ring-accent shadow-glow' : 'ring-1 ring-border',
      sizeClasses[size]
    ]"
  >
    <!-- Video element -->
    <video
      v-show="stream && !isVideoOff"
      ref="videoRef"
      :class="videoClasses"
      autoplay
      playsinline
      :muted="isLocal"
    />

    <!-- Video off placeholder -->
    <div
      v-if="!stream || isVideoOff"
      class="absolute inset-0 flex items-center justify-center bg-bg-elevated"
    >
      <Avatar :name="displayName" size="xl" />
    </div>

    <!-- Gradient overlay for readability -->
    <div class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

    <!-- Name badge -->
    <div class="absolute bottom-2 left-2 right-2 flex items-center justify-between">
      <div class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-sm">
        <span class="text-sm font-medium text-white truncate max-w-[120px]">
          {{ displayName }}
        </span>
        <span v-if="isLocal" class="text-xs text-text-secondary">(You)</span>
      </div>

      <!-- Status indicators -->
      <div class="flex items-center gap-1">
        <!-- Muted indicator -->
        <div
          v-if="isMuted"
          class="p-1.5 rounded-lg bg-danger/80 backdrop-blur-sm"
          title="Muted"
        >
          <Icon name="heroicons:microphone-solid" class="w-3.5 h-3.5 text-white line-through" />
        </div>

        <!-- Video off indicator -->
        <div
          v-if="isVideoOff"
          class="p-1.5 rounded-lg bg-danger/80 backdrop-blur-sm"
          title="Camera off"
        >
          <Icon name="heroicons:video-camera-slash" class="w-3.5 h-3.5 text-white" />
        </div>
      </div>
    </div>

    <!-- Active speaker indicator -->
    <div
      v-if="isActive"
      class="absolute top-2 right-2"
    >
      <div class="flex items-center gap-1 px-2 py-1 rounded-full bg-accent/80 backdrop-blur-sm">
        <div class="w-2 h-2 rounded-full bg-white animate-pulse" />
        <span class="text-xs font-medium text-white">Speaking</span>
      </div>
    </div>
  </div>
</template>
