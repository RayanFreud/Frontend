<script setup lang="ts">
interface Props {
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
  glow?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  padding: 'md',
  hover: false,
  glow: false
})

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-8'
}

const cardClasses = computed(() => [
  'bg-bg-secondary/80 backdrop-blur-xl rounded-xl border border-border',
  paddingClasses[props.padding],
  props.hover ? 'hover:bg-bg-elevated transition-colors duration-200 cursor-pointer' : '',
  props.glow ? 'shadow-glow/20' : ''
])
</script>

<template>
  <div :class="cardClasses">
    <!-- Header slot -->
    <div v-if="$slots.header" class="mb-4">
      <slot name="header" />
    </div>

    <!-- Default slot -->
    <slot />

    <!-- Footer slot -->
    <div v-if="$slots.footer" class="mt-4 pt-4 border-t border-border">
      <slot name="footer" />
    </div>
  </div>
</template>
