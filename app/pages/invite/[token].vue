<script setup lang="ts">
/**
 * Invite landing page: /invite/:token
 *
 * ✅ DO:
 *  - GET invitation info from backend
 *  - Ask user for access code
 *  - Redirect to room lobby with ?token=...&code=...
 *
 * ❌ DO NOT:
 *  - Call "useInvitation" here (it consumes the invite and makes it 'already used')
 */

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()

const api = useApi()
const toastStore = useToastStore()

const token = computed(() => String(route.params.token || '').trim())

// UI state
const isLoading = ref(true)
const invitation = ref<any>(null)
const inviteCode = ref('')
const isContinuing = ref(false)

const isValid = computed(() => !!invitation.value?.is_valid)
const roomId = computed(() => String(invitation.value?.room_id || '').trim())

// Button enabled only if invite is valid + code entered
const canContinue = computed(() => isValid.value && !!inviteCode.value.trim())

onMounted(async () => {
  if (!token.value) {
    toastStore.error('Missing invite token')
    router.push('/')
    return
  }

  try {
    // ✅ Only fetch info. NO consumption.
    invitation.value = await api.getInvitation(token.value)
  } catch (err: any) {
    toastStore.error(err?.data?.error || 'Invitation not found or expired')
    invitation.value = null
  } finally {
    isLoading.value = false
  }
})

async function handleContinue() {
  if (!canContinue.value) return

  isContinuing.value = true
  try {
    // ✅ Redirect to lobby with token + code
    // The real verification + consumption will happen in POST /rooms/:roomId/join
    router.push(`/room/${roomId.value}/lobby?token=${encodeURIComponent(token.value)}&code=${encodeURIComponent(inviteCode.value.trim())}`)
  } finally {
    isContinuing.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-xl">
      <div v-if="isLoading" class="flex justify-center">
        <LoadingSpinner size="lg" />
      </div>

      <template v-else>
        <div class="text-center mb-6">
          <h1 class="text-2xl font-bold text-text-primary">You're invited</h1>
          <p class="text-text-secondary">
            Join the meeting using your invite token and access code.
          </p>
        </div>

        <BaseCard padding="lg">
          <template v-if="invitation && isValid">
            <div class="space-y-4">
              <div class="p-4 rounded-xl bg-bg-elevated space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-text-secondary">Meeting</span>
                  <span class="text-text-primary font-medium">
                    {{ invitation.room_name }}
                  </span>
                </div>

                <div class="flex items-center justify-between text-sm">
                  <span class="text-text-secondary">Status</span>
                  <span class="text-text-primary font-medium">
                    Valid
                  </span>
                </div>

                <div class="text-xs text-text-secondary">
                  Token: {{ token }}
                </div>
              </div>

              <BaseInput
                v-model="inviteCode"
                label="Access Code"
                placeholder="Enter the code from your email"
                icon="heroicons:key"
              />

              <BaseButton
                class="w-full"
                size="lg"
                :loading="isContinuing"
                :disabled="!canContinue"
                @click="handleContinue"
              >
                Continue
              </BaseButton>

              <NuxtLink
                to="/"
                class="block text-center text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Back to home
              </NuxtLink>
            </div>
          </template>

          <template v-else>
            <div class="space-y-4">
              <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <p class="text-sm font-medium text-red-400">Invalid invitation</p>
                <p class="text-sm text-text-secondary">
                  This invite link is not valid anymore (expired or already used).
                </p>
              </div>

              <NuxtLink to="/" class="block">
                <BaseButton class="w-full" size="lg">
                  Back to home
                </BaseButton>
              </NuxtLink>
            </div>
          </template>
        </BaseCard>
      </template>
    </div>
  </div>
</template>
