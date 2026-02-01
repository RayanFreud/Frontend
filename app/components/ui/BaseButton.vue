<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  icon?: string
  iconPosition?: 'left' | 'right'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  iconPosition: 'left'
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const variantClasses = {
  primary: 'bg-accent hover:bg-accent-light text-white shadow-glow/30 hover:shadow-glow',
  secondary: 'bg-bg-elevated hover:bg-bg-hover text-text-primary border border-border',
  ghost: 'bg-transparent hover:bg-white/5 text-text-secondary hover:text-text-primary',
  danger: 'bg-danger hover:bg-danger-light text-white'
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-base gap-2',
  lg: 'px-6 py-3 text-lg gap-2.5'
}

const buttonClasses = computed(() => [
  'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200',
  'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 focus:ring-offset-bg-primary',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
  variantClasses[props.variant],
  sizeClasses[props.size]
])

function handleClick(event: MouseEvent) {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<template>
  <button
    :class="buttonClasses"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <!-- Loading spinner -->
    <svg
      v-if="loading"
      class="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>

    <!-- Left icon -->
    <Icon
      v-else-if="icon && iconPosition === 'left'"
      :name="icon"
      class="shrink-0"
    />

    <!-- Slot content -->
    <span v-if="$slots.default">
      <slot />
    </span>

    <!-- Right icon -->
    <Icon
      v-if="icon && iconPosition === 'right' && !loading"
      :name="icon"
      class="shrink-0"
    />
  </button>
</template>
