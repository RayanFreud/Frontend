<script setup lang="ts">
import { storeToRefs } from 'pinia'

type Props = {
  localStream: MediaStream | null
  localDisplayName: string
  isLocalMuted: boolean
  isLocalVideoOff: boolean
}

const props = defineProps<Props>()

const roomStore = useRoomStore()
const { userId, publishers, remoteStreams } = storeToRefs(roomStore)

/**
 * ✅ Remote tiles = tous les publishers sauf moi
 * Chaque publisher a un feed_id => stream = remoteStreams.get(feed_id)
 */
const remoteTiles = computed(() => {
  const me = userId.value
  const pubs = Array.from(publishers.value.values())

  return pubs
    .filter(p => p.user_id && p.user_id !== me)
    .map(p => ({
      feedId: String(p.feed_id),
      display: p.display,
      userId: p.user_id,
      stream: remoteStreams.value.get(String(p.feed_id)) ?? null
    }))
})

/**
 * Helper: attacher un MediaStream à un <video>
 */
function bindVideo(el: HTMLVideoElement | null, stream: MediaStream | null) {
  if (!el) return
  if (!stream) {
    // nettoyer la source
    // @ts-ignore
    el.srcObject = null
    return
  }
  // @ts-ignore
  if (el.srcObject !== stream) el.srcObject = stream
}
</script>

<template>
  <!-- ✅ Teams-like grid -->
  <div class="h-full w-full p-4">
    <div
      class="grid gap-4 h-full"
      style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));"
    >
      <!-- ✅ Local tile -->
      <div class="relative rounded-2xl overflow-hidden bg-bg-elevated border border-border min-h-[240px]">
        <video
          v-if="props.localStream && !props.isLocalVideoOff"
          ref="localVideo"
          class="h-full w-full object-cover"
          autoplay
          playsinline
          muted
          :onVnodeMounted="(vnode:any) => bindVideo(vnode.el, props.localStream)"
          :onVnodeUpdated="(vnode:any) => bindVideo(vnode.el, props.localStream)"
        />

        <!-- Placeholder si caméra off -->
        <div v-else class="h-full w-full flex items-center justify-center">
          <div class="flex flex-col items-center gap-3">
            <div class="w-24 h-24 rounded-full bg-accent/20 flex items-center justify-center text-3xl font-semibold text-accent">
              {{ props.localDisplayName?.slice(0,1)?.toUpperCase() || 'U' }}
            </div>
            <div class="text-text-secondary text-sm">
              {{ props.localDisplayName || 'You' }}
              <span class="text-text-muted">(You)</span>
            </div>
          </div>
        </div>

        <!-- Name overlay -->
        <div class="absolute bottom-3 left-3 flex items-center gap-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">
          <span>{{ props.localDisplayName || 'You' }} (You)</span>
          <span v-if="props.isLocalMuted" class="opacity-90">🎙️ muted</span>
          <span v-if="props.isLocalVideoOff" class="opacity-90">📷 off</span>
        </div>
      </div>

      <!-- ✅ Remote tiles -->
      <div
        v-for="t in remoteTiles"
        :key="t.feedId"
        class="relative rounded-2xl overflow-hidden bg-bg-elevated border border-border min-h-[240px]"
      >
        <video
          v-if="t.stream"
          class="h-full w-full object-cover"
          autoplay
          playsinline
          :onVnodeMounted="(vnode:any) => bindVideo(vnode.el, t.stream)"
          :onVnodeUpdated="(vnode:any) => bindVideo(vnode.el, t.stream)"
        />

        <!-- Placeholder tant que stream pas arrivé -->
        <div v-else class="h-full w-full flex items-center justify-center">
          <div class="flex flex-col items-center gap-3">
            <div class="w-24 h-24 rounded-full bg-bg-hover flex items-center justify-center text-3xl font-semibold text-text-primary">
              {{ t.display?.slice(0,1)?.toUpperCase() || 'P' }}
            </div>
            <div class="text-text-secondary text-sm">{{ t.display }}</div>
            <div class="text-text-muted text-xs">Connecting…</div>
          </div>
        </div>

        <!-- Name overlay -->
        <div class="absolute bottom-3 left-3 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">
          {{ t.display }}
        </div>
      </div>
    </div>
  </div>
</template>
