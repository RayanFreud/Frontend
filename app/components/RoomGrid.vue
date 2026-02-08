<script setup lang="ts">
import type { Participant, Publisher } from '~/types'

const props = defineProps<{
  localStream: MediaStream | null
  localDisplayName: string
  remoteParticipants: Participant[]

  // ✅ NEW (optionnel) : permet de binder les streams distants sans casser ton API actuelle
  // - publishers: pour matcher participant.user_id -> publisher.feed_id
  // - getRemoteStream: pour récupérer le stream déjà stocké dans le store (feed_id -> MediaStream)
  publishers?: Publisher[]
  getRemoteStream?: (feedId: string) => MediaStream | null
}>()

/**
 * ✅ Helper: pour un participant, retrouver son feed_id via publishers
 * (c’est la clé pour mapper participant -> stream)
 */
function getFeedIdForParticipant(p: Participant): string | null {
  if (!props.publishers) return null
  const pub = props.publishers.find((x) => x.user_id === p.user_id)
  return pub?.feed_id ? String(pub.feed_id) : null
}
</script>

<template>
  <div class="h-full w-full p-4">
    <div
      class="grid gap-4 h-full"
      :class="[
        remoteParticipants.length === 0 ? 'grid-cols-1' :
        remoteParticipants.length === 1 ? 'grid-cols-2' :
        remoteParticipants.length <= 3 ? 'grid-cols-2' : 'grid-cols-3'
      ]"
    >
      <!-- LOCAL TILE -->
      <div class="relative rounded-2xl overflow-hidden bg-bg-elevated border border-border min-h-[240px]">
        <video
          v-if="localStream"
          class="w-full h-full object-cover"
          autoplay
          playsinline
          muted
          :ref="(el:any) => { if (el && localStream) el.srcObject = localStream }"
        />
        <div v-else class="w-full h-full flex items-center justify-center text-text-secondary">
          <div class="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-xl font-semibold">
            {{ (localDisplayName || 'You').slice(0, 1).toUpperCase() }}
          </div>
        </div>

        <div class="absolute left-3 bottom-3 px-3 py-1 rounded-lg bg-black/40 text-white text-sm">
          {{ localDisplayName || 'You' }} <span class="opacity-80">(You)</span>
        </div>
      </div>

      <!-- REMOTE TILES -->
      <div
        v-for="p in remoteParticipants"
        :key="p.user_id"
        class="relative rounded-2xl overflow-hidden bg-bg-elevated border border-border min-h-[240px]"
      >
        <!-- ✅ NEW: remote video si on a stream -->
        <video
          v-if="getRemoteStream && publishers && getRemoteStream(getFeedIdForParticipant(p) || '')"
          class="w-full h-full object-cover"
          autoplay
          playsinline
          :ref="(el:any) => {
            const feedId = getFeedIdForParticipant(p)
            const stream = (feedId && getRemoteStream) ? getRemoteStream(feedId) : null
            if (el && stream) el.srcObject = stream
          }"
        />

        <!-- Sinon on garde ton placeholder -->
        <div
          v-else
          class="w-full h-full flex flex-col items-center justify-center text-text-secondary"
        >
          <div class="w-14 h-14 rounded-full bg-bg-hover flex items-center justify-center text-lg font-semibold">
            {{ (p.display || '?').slice(0, 1).toUpperCase() }}
          </div>
          <div class="mt-3 text-sm opacity-80">Connected</div>

          <!-- ✅ Petit hint utile -->
          <div class="mt-1 text-xs opacity-60">
            {{ publishers ? 'Waiting for media…' : 'Video stream not bound yet' }}
          </div>
        </div>

        <div class="absolute left-3 bottom-3 px-3 py-1 rounded-lg bg-black/40 text-white text-sm">
          {{ p.display }}
        </div>
      </div>
    </div>
  </div>
</template>
