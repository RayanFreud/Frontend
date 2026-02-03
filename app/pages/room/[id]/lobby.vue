<script setup lang="ts">
/**
 * Lobby page (pre-join)
 * - Host flow: creator_key (stocké localement sur le device du créateur)
 * - Guest flow: invite_token + invite_code (le token vient du lien, le code est tapé)
 */
definePageMeta({ layout: 'default' })

// Nuxt deps
const route = useRoute()
const router = useRouter()

// Stores / composables
const roomStore = useRoomStore()
const api = useApi()
const toastStore = useToastStore()

// Room id depuis l’URL /room/:id/lobby
const roomId = route.params.id as string

// UI state
const displayName = ref((route.query.name as string) || '')
const roomInfo = ref<any>(null)
const isLoading = ref(true)
const isJoining = ref(false)

// Guest flow: token dans l’URL ?token=...
const inviteToken = computed(() => String(route.query.token || '').trim())

// Optionnel: si tu mets ?code=... dans le lien, on pré-remplit.
// (Mais ton mail n’envoie normalement PAS le code dans l’URL)
const codeFromLink = computed(() => String(route.query.code || '').trim())

// creator_key stocké localement sur la machine du créateur (host)
const creatorKey = ref('')

// Code saisi par l’invité (ou pré-rempli depuis l’URL)
const inviteCode = ref(codeFromLink.value)

// Si token présent => invité
const isGuestFlow = computed(() => !!inviteToken.value)

// Validation front: on n’autorise Join que si les champs nécessaires sont présents
const canJoin = computed(() => {
  if (!displayName.value.trim()) return false
  if (isGuestFlow.value) return !!inviteToken.value && !!inviteCode.value.trim()
  return !!creatorKey.value
})

onMounted(async () => {
  try {
    // Charge les infos room (nom, participants_count, etc.)
    roomInfo.value = await api.getRoom(roomId)
  } catch (e) {
    toastStore.error('Meeting not found')
    router.push('/')
    return
  } finally {
    isLoading.value = false
  }

  // Host flow: si creator_key existe sur CE device, on le récupère
  if (process.client) {
    creatorKey.value = localStorage.getItem(`tg:creator_key:${roomId}`) || ''
  }
})

async function handleJoin() {
  // Validation display name
  if (!displayName.value.trim()) {
    toastStore.warning('Please enter your name')
    return
  }

  isJoining.value = true
  try {
    // Guest flow: invite_token + invite_code
    if (isGuestFlow.value) {
      if (!inviteToken.value || !inviteCode.value.trim()) {
        toastStore.error('Invite token + code required')
        return
      }

      // IMPORTANT: on passe bien invite_token + invite_code (PAS access_code)
      await roomStore.joinRoom(roomId, displayName.value.trim(), {
        invite_token: inviteToken.value,
        invite_code: inviteCode.value.trim(),
      })
    } else {
      // Host flow: creator_key
      if (!creatorKey.value) {
        toastStore.error('Creator access missing on this device')
        return
      }

      await roomStore.joinRoom(roomId, displayName.value.trim(), {
        creator_key: creatorKey.value,
      })
    }

    // Join OK => redirection vers la room
    router.push(`/room/${roomId}`)
  } catch (error: any) {
    // Affiche le message backend (ex: Invalid invitation code)
    toastStore.error(error?.data?.error || 'Failed to join meeting')
  } finally {
    isJoining.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-3xl">
      <div v-if="isLoading" class="flex justify-center">
        <LoadingSpinner size="lg" />
      </div>

      <template v-else>
        <div class="text-center mb-8">
          <h1 class="text-2xl font-bold text-text-primary mb-2">
            {{ roomInfo?.name || 'Meeting Room' }}
          </h1>
          <p class="text-text-secondary">Check your camera and microphone before joining</p>

          <p v-if="isGuestFlow" class="mt-2 text-sm text-text-secondary">
            Guest access detected (token + code).
          </p>
          <p v-else class="mt-2 text-sm text-text-secondary">
            Host access detected (creator key on this device).
          </p>
        </div>

        <BaseCard padding="lg">
          <div class="grid md:grid-cols-2 gap-6">
            <div>
              <LocalPreview />
            </div>

            <div class="flex flex-col justify-center">
              <div class="space-y-4">
                <BaseInput
                  v-model="displayName"
                  label="Your Name"
                  placeholder="Enter your display name"
                  icon="heroicons:user"
                />

                <!-- Guest: code input -->
                <BaseInput
                  v-if="isGuestFlow"
                  v-model="inviteCode"
                  label="Invitation Code"
                  placeholder="e.g. 761-221"
                  icon="heroicons:key"
                />

                <div class="p-4 rounded-xl bg-bg-elevated space-y-2">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-text-secondary">Meeting</span>
                    <span class="text-text-primary font-medium">{{ roomInfo?.name }}</span>
                  </div>

                  <div class="flex items-center justify-between text-sm">
                    <span class="text-text-secondary">Participants</span>
                    <span class="text-text-primary font-medium">
                      {{ roomInfo?.participants_count || 0 }} joined
                    </span>
                  </div>

                  <!-- Debug light: afficher token si invité -->
                  <div v-if="isGuestFlow" class="text-xs text-text-secondary">
                    Token: {{ inviteToken }}
                  </div>
                </div>

                <BaseButton
                  class="w-full"
                  size="lg"
                  :loading="isJoining"
                  :disabled="!canJoin"
                  @click="handleJoin"
                >
                  <Icon name="heroicons:video-camera" class="w-5 h-5" />
                  Join Meeting
                </BaseButton>

                <NuxtLink
                  to="/"
                  class="block text-center text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel and return home
                </NuxtLink>
              </div>
            </div>
          </div>
        </BaseCard>
      </template>
    </div>
  </div>
</template>
