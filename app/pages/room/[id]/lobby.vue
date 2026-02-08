<script setup lang="ts">
/**
 * Lobby page (pre-join)
 *
 * ✅ Host (creator):
 *  - If the room is empty => allow join WITHOUT creator_key (bootstrap).
 *  - If the room is NOT empty => require creator_key (rejoin security).
 *
 * ✅ Guest:
 *  - Must have invite_token in URL + invite_code (typed or passed from /invite/:token).
 *
 * No demo_mode.
 */

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()

const roomStore = useRoomStore()
const api = useApi()
const toastStore = useToastStore()

const roomId = route.params.id as string

// UI state
const displayName = ref((route.query.name as string) || '')
const roomInfo = ref<any>(null)
const isLoading = ref(true)
const isJoining = ref(false)

// Guest flow inputs (from /invite/:token redirect)
const inviteToken = computed(() => String(route.query.token || '').trim())
const codeFromLink = computed(() => String(route.query.code || '').trim())
const inviteCode = ref(codeFromLink.value)

// Host flow (creator_key stored locally when meeting is created)
const creatorKey = ref('')

// Guest flow is determined ONLY by token presence
const isGuestFlow = computed(() => !!inviteToken.value)

// Room empty => host bootstrap allowed
const isRoomEmpty = computed(() => (roomInfo.value?.participants_count || 0) === 0)

// Button availability rules
const canJoin = computed(() => {
  if (!displayName.value.trim()) return false

  if (isGuestFlow.value) {
    // Guest needs token + code
    return !!inviteToken.value && !!inviteCode.value.trim()
  }

  // Host:
  // - if room empty => OK (bootstrap)
  // - else => creator_key required
  return isRoomEmpty.value || !!creatorKey.value.trim()
})

onMounted(async () => {
  try {
    roomInfo.value = await api.getRoom(roomId)
  } catch {
    toastStore.error('Meeting not found')
    router.push('/')
    return
  } finally {
    isLoading.value = false
  }

  // Load creator key if exists (host re-join)
  if (import.meta.client) {
    const key = `tg:creator_key:${roomId}`
    creatorKey.value = localStorage.getItem(key) || sessionStorage.getItem(key) || ''
  }
})

async function handleJoin() {
  const name = displayName.value.trim()
  if (!name) {
    toastStore.warning('Please enter your name')
    return
  }

  isJoining.value = true
  try {
    // Refresh room info quickly (avoid stale count)
    roomInfo.value = await api.getRoom(roomId)

    if (isGuestFlow.value) {
      // GUEST
      const token = inviteToken.value
      const code = inviteCode.value.trim()

      if (!token || !code) {
        toastStore.error('Invite token + access code required')
        return
      }

      await roomStore.joinRoom(roomId, name, {
        invite_token: token,
        invite_code: code,
      })
    } else {
      // HOST
      if (!isRoomEmpty.value) {
        // Room already has members => rejoin requires creator key
        const key = creatorKey.value.trim()
        if (!key) {
          toastStore.error(
            'This meeting is already running. Open it on the device that created it (creator key stored), or join using an invite link.'
          )
          return
        }

        await roomStore.joinRoom(roomId, name, { creator_key: key })
      } else {
        // Room empty => bootstrap join with no key
        await roomStore.joinRoom(roomId, name, {})
      }
    }

    router.push(`/room/${roomId}`)
  } catch (error: any) {
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
            Host access.
            <span v-if="isRoomEmpty">(Room is empty → you can start it now.)</span>
            <span v-else>(Room already running → creator key required on this device.)</span>
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

                <BaseInput
                  v-if="isGuestFlow"
                  v-model="inviteCode"
                  label="Access Code"
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

                  <div v-if="isGuestFlow" class="text-xs text-text-secondary break-all">
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
