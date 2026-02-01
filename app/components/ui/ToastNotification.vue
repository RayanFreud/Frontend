<script setup lang="ts">
import type { Toast } from '~/stores/toast'

const props = defineProps<{
  toast: Toast
}>()

const emit = defineEmits<{
  dismiss: []
}>()

const iconMap = {
  success: 'heroicons:check-circle',
  error: 'heroicons:x-circle',
  warning: 'heroicons:exclamation-triangle',
  info: 'heroicons:information-circle'
}

const colorClasses = {
  success: 'bg-success/10 border-success/30 text-success',
  error: 'bg-danger/10 border-danger/30 text-danger',
  warning: 'bg-warning/10 border-warning/30 text-warning',
  info: 'bg-accent/10 border-accent/30 text-accent'
}

const iconColorClasses = {
  success: 'text-success',
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-accent'
}
</script>

<template>
  <div
    :class="[
      'flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl',
      'animate-slide-up shadow-lg',
      colorClasses[toast.type]
    ]"
  >
    <!-- Icon -->
    <Icon
      :name="iconMap[toast.type]"
      :class="['w-5 h-5 shrink-0 mt-0.5', iconColorClasses[toast.type]]"
    />

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <p v-if="toast.title" class="font-medium text-text-primary">
        {{ toast.title }}
      </p>
      <p class="text-sm text-text-secondary">
        {{ toast.message }}
      </p>
    </div>

    <!-- Dismiss button -->
    <button
      v-if="toast.dismissible"
      class="shrink-0 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors"
      @click="emit('dismiss')"
    >
      <Icon name="heroicons:x-mark" class="w-4 h-4" />
    </button>
  </div>
</template>
