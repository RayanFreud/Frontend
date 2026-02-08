<script setup lang="ts">
definePageMeta({
  layout: 'room',
  ssr: false
})

import { onBeforeRouteLeave } from 'vue-router'
import { storeToRefs } from 'pinia'

// ✅ alias : on garde ton tag <VideoGrid /> sans casser ton code
import RoomGrid from '~/components/RoomGrid.vue'
const VideoGrid = RoomGrid

const route = useRoute()
const router = useRouter()
const roomStore = useRoomStore()

// ✅ refs
const { isJoined, isPublishing, localStream, displayName, isMuted, isVideoOff, participants, publishers, userId } =
  storeToRefs(roomStore)

const roomId = route.params.id as string

// ✅ participants array
const participantsArr = computed(() => Array.from(participants.value.values()))

// ✅ remote participants = tout sauf self
const remoteParticipants = computed(() => {
  const me = userId.value
  return participantsArr.value.filter(p => p.user_id !== me)
})

// ✅ publishers array (pour mapper user_id -> feed_id)
const publishersArr = computed(() => Array.from(publishers.value.values()))

onMounted(async () => {
  if (!isJoined.value) {
    router.push(`/room/${roomId}/lobby`)
    return
  }

  try {
    if (!isPublishing.value) {
      await roomStore.startPublishing()
    }
  } catch (error) {
    console.error('Failed to start publishing:', error)
  }
})

async function handleLeave() {
  await roomStore.leaveRoom()
  router.push('/')
}

onBeforeRouteLeave(async () => {
  if (isJoined.value) {
    try {
      await roomStore.leaveRoom()
    } catch (e) {
      console.warn('[RoomPage] leaveRoom failed during navigation:', e)
    }
  }
})
</script>

<template>
  <ClientOnly>
    <div class="h-full flex flex-col">
      <div class="flex-1 overflow-hidden pb-24">
        <VideoGrid
          :local-stream="localStream"
          :local-display-name="displayName"
          :is-local-muted="isMuted"
          :is-local-video-off="isVideoOff"
          :remote-participants="remoteParticipants"
          :publishers="publishersArr"
          :get-remote-stream="roomStore.getRemoteStream"
        />
      </div>

      <MediaControls @leave="handleLeave" />
    </div>
  </ClientOnly>
</template>
