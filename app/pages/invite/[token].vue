<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const api = useApi()
const toastStore = useToastStore()

const token = route.params.token as string

const invitationInfo = ref<any>(null)
const isLoading = ref(true)
const isError = ref(false)
const errorMessage = ref('')

const inviteCode = ref('')

onMounted(async () => {
  try {
    invitationInfo.value = await api.getInvitation(token)
    if (!invitationInfo.value.is_valid) {
      isError.value = true
      errorMessage.value = 'This invitation link has expired or reached its maximum uses.'
    }
  } catch (error: any) {
    isError.value = true
    errorMessage.value = error?.data?.error || 'This invitation link is invalid or has expired.'
  } finally {
    isLoading.value = false
  }
})

function formatExpiryDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

async function handleContinue() {
  if (!invitationInfo.value || !invitationInfo.value.is_valid) return

  const code = inviteCode.value.trim()
  if (!code) {
    toastStore.error('Invite code is required')
    return
  }

  router.push(
    `/room/${invitationInfo.value.room_id}/lobby?token=${encodeURIComponent(token)}&code=${encodeURIComponent(code)}`
  )
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div v-if="isLoading" class="flex justify-center">
        <LoadingSpinner size="lg" />
      </div>

      <template v-else-if="isError">
        <BaseCard padding="lg" class="text-center">
          <h1 class="text-xl font-bold mb-2">Invalid Invitation</h1>
          <p class="text-text-secondary mb-6">{{ errorMessage }}</p>
          <BaseButton class="w-full" @click="router.push('/')">Go Home</BaseButton>
        </BaseCard>
      </template>

      <template v-else-if="invitationInfo">
        <BaseCard padding="lg">
          <div class="text-center mb-6">
            <h1 class="text-xl font-bold mb-2">You're Invited!</h1>
            <p class="text-text-secondary">Enter the invite code from the email</p>
          </div>

          <div class="p-4 rounded-xl bg-bg-elevated space-y-3 mb-6">
            <div class="flex items-center justify-between">
              <span class="text-text-secondary">Meeting</span>
              <span class="text-text-primary font-medium">{{ invitationInfo.room_name }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-text-secondary">Expires</span>
              <span class="text-text-primary text-sm">{{ formatExpiryDate(invitationInfo.expires_at) }}</span>
            </div>
          </div>

          <BaseInput
            v-model="inviteCode"
            label="Invite Code"
            placeholder="e.g. 123-456"
          />

          <BaseButton class="w-full mt-4" size="lg" @click="handleContinue">
            Continue
          </BaseButton>
        </BaseCard>
      </template>
    </div>
  </div>
</template>
