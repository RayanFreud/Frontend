<script setup lang="ts">
interface Props {
  modelValue: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closable?: boolean
  closeOnOverlay?: boolean
  closeOnEsc?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  closable: true,
  closeOnOverlay: true,
  closeOnEsc: true
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
}

function close() {
  if (props.closable) {
    isOpen.value = false
  }
}

function handleOverlayClick() {
  if (props.closeOnOverlay) {
    close()
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.closeOnEsc) {
    close()
  }
}

// Handle escape key
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// Lock body scroll when modal is open
watch(isOpen, (open) => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = open ? 'hidden' : ''
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Overlay -->
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="handleOverlayClick"
        />

        <!-- Modal content -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="isOpen"
            :class="[
              'relative w-full bg-bg-secondary rounded-2xl shadow-2xl border border-border',
              'animate-scale-in',
              sizeClasses[size]
            ]"
          >
            <!-- Header -->
            <div
              v-if="title || closable"
              class="flex items-center justify-between p-5 border-b border-border"
            >
              <h2 v-if="title" class="text-xl font-semibold text-text-primary">
                {{ title }}
              </h2>
              <button
                v-if="closable"
                class="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                @click="close"
              >
                <Icon name="heroicons:x-mark" class="w-5 h-5" />
              </button>
            </div>

            <!-- Body -->
            <div class="p-5">
              <slot />
            </div>

            <!-- Footer -->
            <div
              v-if="$slots.footer"
              class="flex items-center justify-end gap-3 p-5 border-t border-border"
            >
              <slot name="footer" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
