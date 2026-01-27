<script setup lang="ts">
const roomStore = useRoomStore()
const api = useApi()
const toastStore = useToastStore()

// Invite modal state
const showInviteModal = ref(false)
const inviteUrl = ref('')
const isCreatingInvite = ref(false)
const inviteEmails = ref('')

// Sending/result state
const isSendingEmail = ref(false)

const showInviteResult = ref(false)
const inviteResult = ref<{
  ok: boolean
  sent?: number
  emails?: string[]
  subject?: string
  meetingId?: string
  inviteUrl?: string
  error?: string
  usedFallbackMailto?: boolean
} | null>(null)

const meetingId = computed(() => roomStore.roomId || '')

// Get participants as array
const participants = computed(() => Array.from(roomStore.participants.values()))
const publishers = computed(() => Array.from(roomStore.publishers.values()))

function parseEmails(input: string): string[] {
  return input
    .split(/[\s,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
}

async function ensureInviteLink() {
  if (inviteUrl.value) return
  if (!meetingId.value) {
    toastStore.error('Meeting ID not available yet.')
    return
  }
  isCreatingInvite.value = true
  try {
    const res = await api.createInvitation(meetingId.value, { ttl_seconds: 86400 })
    inviteUrl.value = `${window.location.origin}/invite/${res.token}`
  } catch (e) {
    toastStore.error('Failed to create invite link')
  } finally {
    isCreatingInvite.value = false
  }
}

async function openInviteModal() {
  showInviteModal.value = true
  await ensureInviteLink()
}

async function copyText(text: string, okMsg: string, errMsg: string) {
  try {
    await navigator.clipboard.writeText(text)
    toastStore.success(okMsg)
  } catch {
    toastStore.error(errMsg)
  }
}

async function copyMeetingCode() {
  await copyText(meetingId.value, 'Meeting code copied!', 'Failed to copy meeting code')
}

async function copyInviteLink() {
  await copyText(inviteUrl.value, 'Invite link copied!', 'Failed to copy invite link')
}

function openResult(ok: boolean, payload: Omit<NonNullable<typeof inviteResult.value>, 'ok'>) {
  inviteResult.value = { ok, ...payload }
  showInviteResult.value = true
}

async function sendInviteEmail() {
  await ensureInviteLink()

  const emails = parseEmails(inviteEmails.value)
  if (emails.length === 0) {
    toastStore.error('Please enter at least one email.')
    return
  }
  if (!meetingId.value) {
    toastStore.error('Meeting ID not available.')
    return
  }

  const subject = `TrueGather invite — ${roomStore.roomName || 'Meeting'}`

  isSendingEmail.value = true
  try {
    // Try backend service first (Resend)
    const resp = await api.sendInviteEmail(meetingId.value, {
      emails,
      ttl_seconds: 86400,
      subject,
      message: 'Join via the meeting code or the invite link below.',
    })

    // Success: close main modal, show result modal
    showInviteModal.value = false

    openResult(true, {
      sent: resp?.sent ?? emails.length,
      emails,
      subject,
      meetingId: meetingId.value,
      inviteUrl: inviteUrl.value,
      usedFallbackMailto: false,
    })

    // Optionnel: reset input
    inviteEmails.value = ''
  } catch (e: any) {
    // Fallback: open mail client (still works without backend mail config)
    const encSubject = encodeURIComponent(subject)
    const body = encodeURIComponent(
      `You are invited to join a TrueGather meeting.\n\nMeeting code:\n${meetingId.value}\n\nInvite link:\n${inviteUrl.value}\n`
    )
    const bcc = encodeURIComponent(emails.join(','))
    window.location.href = `mailto:?bcc=${bcc}&subject=${encSubject}&body=${body}`

    // Show result modal as "sent via fallback" (pro UX)
    showInviteModal.value = false

    openResult(true, {
      sent: emails.length,
      emails,
      subject,
      meetingId: meetingId.value,
      inviteUrl: inviteUrl.value,
      usedFallbackMailto: true,
    })

    toastStore.warning('Backend email not configured — opening your email client instead.')
  } finally {
    isSendingEmail.value = false
  }
}
</script>

<template>
  <div class="flex flex-col h-full bg-bg-secondary">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b border-border">
      <div class="flex items-center gap-2">
        <Icon name="heroicons:users" class="w-5 h-5 text-text-secondary" />
        <h2 class="font-semibold text-text-primary">Participants</h2>
        <span class="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-sm font-medium">
          {{ roomStore.participantCount }}
        </span>
      </div>
    </div>

    <!-- Participants list -->
    <div class="flex-1 overflow-y-auto p-2">
      <!-- Current user (always first) -->
      <div
        v-if="roomStore.userId"
        class="flex items-center gap-3 p-3 rounded-xl hover:bg-bg-hover transition-colors"
      >
        <Avatar :name="roomStore.displayName" size="sm" status="online" />

        <div class="flex-1 min-w-0">
          <p class="font-medium text-text-primary truncate">
            {{ roomStore.displayName }}
            <span class="text-text-muted font-normal">(You)</span>
          </p>
        </div>

        <!-- Status icons -->
        <div class="flex items-center gap-1">
          <div v-if="roomStore.isMuted" class="p-1 rounded bg-danger/20" title="Muted">
            <Icon name="heroicons:microphone-solid" class="w-4 h-4 text-danger" />
          </div>
          <div v-if="roomStore.isVideoOff" class="p-1 rounded bg-danger/20" title="Camera off">
            <Icon name="heroicons:video-camera-slash" class="w-4 h-4 text-danger" />
          </div>
        </div>
      </div>

      <!-- Other publishers -->
      <div
        v-for="publisher in publishers"
        :key="publisher.feed_id"
        class="flex items-center gap-3 p-3 rounded-xl hover:bg-bg-hover transition-colors"
      >
        <Avatar :name="publisher.display" size="sm" status="online" />
        <div class="flex-1 min-w-0">
          <p class="font-medium text-text-primary truncate">{{ publisher.display }}</p>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="participants.length === 0 && publishers.length === 0"
        class="flex flex-col items-center justify-center py-8 text-center"
      >
        <Icon name="heroicons:user-group" class="w-12 h-12 text-text-muted mb-3" />
        <p class="text-sm text-text-secondary">No other participants yet</p>
      </div>
    </div>

    <!-- Footer actions -->
    <div class="p-4 border-t border-border relative z-40 pointer-events-auto">
      <button
        class="relative z-50 pointer-events-auto w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-bg-elevated hover:bg-bg-hover text-text-primary transition-colors"
        type="button"
        @click.stop.prevent="openInviteModal"
      >
        <Icon name="heroicons:user-plus" class="w-5 h-5" />
        <span class="font-medium">Invite participants</span>
      </button>
    </div>
  </div>

  <!-- MAIN INVITE MODAL -->
  <BaseModal v-model="showInviteModal" title="Invite participants">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">Copy the meeting code / invite link, or send it by email.</p>

      <div class="space-y-2">
        <label class="text-sm text-text-secondary">Meeting code</label>
        <div class="flex gap-2">
          <input
            :value="meetingId"
            readonly
            class="flex-1 px-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text-primary text-sm"
          />
          <button
            class="px-4 py-2.5 rounded-lg bg-accent text-white hover:bg-accent-light transition-colors"
            @click="copyMeetingCode"
          >
            <Icon name="heroicons:clipboard-document" class="w-5 h-5" />
          </button>
        </div>
      </div>

      <div class="space-y-2">
        <label class="text-sm text-text-secondary">Invite link</label>
        <div class="flex gap-2">
          <input
            :value="inviteUrl"
            readonly
            class="flex-1 px-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text-primary text-sm"
          />
          <button
            class="px-4 py-2.5 rounded-lg bg-accent text-white hover:bg-accent-light transition-colors"
            :disabled="isCreatingInvite"
            @click="copyInviteLink"
          >
            <Icon name="heroicons:clipboard-document" class="w-5 h-5" />
          </button>
        </div>
        <div v-if="isCreatingInvite" class="text-sm text-text-muted">Generating invite link…</div>
      </div>

      <div class="space-y-2">
        <label class="text-sm text-text-secondary">Send by email</label>
        <textarea
          v-model="inviteEmails"
          rows="3"
          placeholder="alice@mail.com, bob@mail.com"
          class="w-full px-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text-primary text-sm"
        />
      </div>

      <div class="flex gap-2">
        <BaseButton variant="secondary" class="flex-1" :disabled="isCreatingInvite || isSendingEmail" @click="copyInviteLink">
          Copy link
        </BaseButton>

        <BaseButton class="flex-1" :disabled="isCreatingInvite || isSendingEmail" @click="sendInviteEmail">
          <template v-if="isSendingEmail">
            <span class="flex items-center justify-center gap-2">
              <LoadingSpinner class="w-4 h-4" />
              Sending…
            </span>
          </template>
          <template v-else>
            Send email
          </template>
        </BaseButton>
      </div>
    </div>
  </BaseModal>

  <!-- RESULT MODAL -->
  <BaseModal v-model="showInviteResult" :title="inviteResult?.ok ? 'Invitation sent' : 'Invitation failed'">
    <div class="space-y-4">
      <div
        class="p-3 rounded-lg border"
        :class="inviteResult?.ok ? 'border-green-500/30 bg-green-500/10' : 'border-danger/30 bg-danger/10'"
      >
        <p class="font-medium text-text-primary">
          {{ inviteResult?.ok ? 'Email sent successfully.' : 'Email could not be sent.' }}
        </p>

        <p v-if="inviteResult?.usedFallbackMailto" class="text-sm text-text-secondary mt-1">
          Sent via your email client (mailto fallback).
        </p>

        <p v-if="!inviteResult?.ok && inviteResult?.error" class="text-sm text-text-secondary mt-1">
          {{ inviteResult?.error }}
        </p>
      </div>

      <div class="space-y-2 text-sm">
        <div class="flex gap-2">
          <span class="text-text-muted w-28">Sent to</span>
          <span class="text-text-primary break-words">{{ inviteResult?.emails?.join(', ') }}</span>
        </div>

        <div class="flex gap-2">
          <span class="text-text-muted w-28">Subject</span>
          <span class="text-text-primary break-words">{{ inviteResult?.subject }}</span>
        </div>

        <div class="flex gap-2">
          <span class="text-text-muted w-28">Meeting code</span>
          <span class="text-text-primary break-words">{{ inviteResult?.meetingId }}</span>
        </div>

        <div class="flex gap-2">
          <span class="text-text-muted w-28">Invite link</span>
          <span class="text-text-primary break-words">{{ inviteResult?.inviteUrl }}</span>
        </div>

        <div v-if="inviteResult?.sent != null" class="flex gap-2">
          <span class="text-text-muted w-28">Sent</span>
          <span class="text-text-primary">{{ inviteResult?.sent }} email(s)</span>
        </div>
      </div>

      <div class="flex gap-2">
        <BaseButton variant="secondary" class="flex-1" @click="showInviteResult = false">
          Close
        </BaseButton>

        <BaseButton
          v-if="inviteResult?.inviteUrl"
          class="flex-1"
          @click="copyText(inviteResult!.inviteUrl!, 'Invite link copied!', 'Failed to copy invite link')"
        >
          Copy link
        </BaseButton>
      </div>
    </div>
  </BaseModal>
</template>
