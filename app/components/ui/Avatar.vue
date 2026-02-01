<script setup lang="ts">
interface Props {
  name?: string
  src?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  status?: 'online' | 'offline' | 'away' | 'busy' | null
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  status: null
})

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl'
}

const statusSizeClasses = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-4 h-4'
}

const statusColorClasses = {
  online: 'bg-success',
  offline: 'bg-text-muted',
  away: 'bg-warning',
  busy: 'bg-danger'
}

// Generate initials from name
const initials = computed(() => {
  if (!props.name) return '?'
  return props.name
    .split(' ')
    .map(word => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
})

// Generate consistent color from name
const bgColor = computed(() => {
  if (!props.name) return 'bg-bg-elevated'
  
  const colors = [
    'bg-indigo-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-blue-500',
    'bg-cyan-500',
    'bg-teal-500',
    'bg-green-500',
    'bg-orange-500'
  ]
  
  let hash = 0
  for (let i = 0; i < props.name.length; i++) {
    hash = props.name.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  return colors[Math.abs(hash) % colors.length]
})
</script>

<template>
  <div class="relative inline-block">
    <!-- Image avatar -->
    <img
      v-if="src"
      :src="src"
      :alt="name"
      :class="[
        'rounded-full object-cover',
        sizeClasses[size]
      ]"
    >
    
    <!-- Initials avatar -->
    <div
      v-else
      :class="[
        'rounded-full flex items-center justify-center font-medium text-white',
        sizeClasses[size],
        bgColor
      ]"
    >
      {{ initials }}
    </div>

    <!-- Status indicator -->
    <span
      v-if="status"
      :class="[
        'absolute bottom-0 right-0 rounded-full border-2 border-bg-secondary',
        statusSizeClasses[size],
        statusColorClasses[status]
      ]"
    />
  </div>
</template>
