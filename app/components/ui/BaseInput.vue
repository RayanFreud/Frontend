<script setup lang="ts">
interface Props {
  modelValue?: string | number
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url'
  placeholder?: string
  label?: string
  error?: string
  hint?: string
  disabled?: boolean
  readonly?: boolean
  icon?: string
  iconPosition?: 'left' | 'right'
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  iconPosition: 'left'
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const inputId = `input_${Math.random().toString(36).substr(2, 9)}`

const inputValue = computed({
  get: () => props.modelValue ?? '',
  set: (value) => emit('update:modelValue', value)
})

const hasIcon = computed(() => !!props.icon)

const inputClasses = computed(() => [
  'w-full bg-bg-elevated border rounded-lg px-4 py-2.5 text-text-primary placeholder-text-muted',
  'transition-all duration-200',
  'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  props.error
    ? 'border-danger focus:ring-danger/50 focus:border-danger'
    : 'border-border hover:border-border-light',
  hasIcon.value && props.iconPosition === 'left' ? 'pl-10' : '',
  hasIcon.value && props.iconPosition === 'right' ? 'pr-10' : ''
])
</script>

<template>
  <div class="w-full">
    <!-- Label -->
    <label
      v-if="label"
      :for="inputId"
      class="block text-sm font-medium text-text-secondary mb-1.5"
    >
      {{ label }}
    </label>

    <!-- Input wrapper -->
    <div class="relative">
      <!-- Left icon -->
      <div
        v-if="icon && iconPosition === 'left'"
        class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
      >
        <Icon :name="icon" class="w-5 h-5" />
      </div>

      <!-- Input -->
      <input
        :id="inputId"
        v-model="inputValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :class="inputClasses"
      >

      <!-- Right icon -->
      <div
        v-if="icon && iconPosition === 'right'"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
      >
        <Icon :name="icon" class="w-5 h-5" />
      </div>
    </div>

    <!-- Error message -->
    <p v-if="error" class="mt-1.5 text-sm text-danger">
      {{ error }}
    </p>

    <!-- Hint -->
    <p v-else-if="hint" class="mt-1.5 text-sm text-text-muted">
      {{ hint }}
    </p>
  </div>
</template>
