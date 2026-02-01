<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const router = useRouter()
const api = useApi()

// State
const recentRooms = ref<any[]>([])
const isLoading = ref(true)

// Load recent rooms
onMounted(async () => {
  try {
    recentRooms.value = await api.listRooms()
  } catch (error) {
    console.error('Failed to load rooms:', error)
  } finally {
    isLoading.value = false
  }
})

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p class="text-text-secondary">Manage your meetings and view history</p>
      </div>
      
      <NuxtLink to="/create">
        <BaseButton>
          <Icon name="heroicons:plus" class="w-5 h-5" />
          New Meeting
        </BaseButton>
      </NuxtLink>
    </div>

    <!-- Quick actions -->
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      <BaseCard hover class="flex items-center gap-4" @click="router.push('/create')">
        <div class="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
          <Icon name="heroicons:plus" class="w-6 h-6 text-accent" />
        </div>
        <div>
          <h3 class="font-medium text-text-primary">Create Meeting</h3>
          <p class="text-sm text-text-secondary">Start a new video call</p>
        </div>
      </BaseCard>

      <BaseCard hover class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <Icon name="heroicons:calendar" class="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h3 class="font-medium text-text-primary">Schedule Meeting</h3>
          <p class="text-sm text-text-secondary">Plan for later</p>
        </div>
      </BaseCard>

      <BaseCard hover class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
          <Icon name="heroicons:arrow-right-on-rectangle" class="w-6 h-6 text-green-400" />
        </div>
        <div>
          <h3 class="font-medium text-text-primary">Join Meeting</h3>
          <p class="text-sm text-text-secondary">Enter meeting ID</p>
        </div>
      </BaseCard>
    </div>

    <!-- Recent meetings -->
    <div>
      <h2 class="text-lg font-semibold text-text-primary mb-4">Recent Meetings</h2>

      <!-- Loading state -->
      <div v-if="isLoading" class="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>

      <!-- Empty state -->
      <BaseCard v-else-if="recentRooms.length === 0" class="text-center py-12">
        <Icon name="heroicons:video-camera" class="w-12 h-12 text-text-muted mx-auto mb-4" />
        <h3 class="text-lg font-medium text-text-primary mb-2">No meetings yet</h3>
        <p class="text-text-secondary mb-6">Create your first meeting to get started</p>
        <NuxtLink to="/create">
          <BaseButton>Create Meeting</BaseButton>
        </NuxtLink>
      </BaseCard>

      <!-- Meetings list -->
      <div v-else class="space-y-3">
        <BaseCard
          v-for="room in recentRooms"
          :key="room.room_id"
          hover
          class="flex items-center justify-between"
        >
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <Icon name="heroicons:video-camera" class="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 class="font-medium text-text-primary">{{ room.name }}</h3>
              <p class="text-sm text-text-secondary">
                {{ formatDate(room.created_at) }} · {{ room.participants_count }} participants
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span
              :class="[
                'px-2 py-1 rounded-full text-xs font-medium',
                room.status === 'active'
                  ? 'bg-success/20 text-success'
                  : 'bg-text-muted/20 text-text-muted'
              ]"
            >
              {{ room.status === 'active' ? 'Active' : 'Ended' }}
            </span>
            <NuxtLink :to="`/room/${room.room_id}/lobby`">
              <BaseButton size="sm" variant="secondary">
                Join
              </BaseButton>
            </NuxtLink>
          </div>
        </BaseCard>
      </div>
    </div>
  </div>
</template>
