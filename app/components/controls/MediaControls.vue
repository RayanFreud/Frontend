<script setup lang="ts">
const route = useRoute();
const roomStore = useRoomStore();
const aiStore = useAiStore();
const toastStore = useToastStore();
const api = useApi();

const emit = defineEmits<{
	leave: [];
}>();

// Local state
const showSettings = ref(false);
const showInviteModal = ref(false);
const inviteUrl = ref("");
const isCreatingInvite = ref(false);

const roomId = route.params.id as string;

async function handleToggleMute() {
	roomStore.toggleMute();
}

async function handleToggleVideo() {
	roomStore.toggleVideo();
}

async function handleScreenShare() {
	// Toggle screen sharing via room store
	try {
		if (roomStore.isScreenSharing) {
			await roomStore.stopScreenShare()
		} else {
			await roomStore.startScreenShare()
		}
	} catch (err) {
		// Errors are already surfaced in the store via toast
	}
}

function handleLeave() {
	emit("leave");
}

function handleOpenAi() {
	aiStore.togglePanel();
}

async function handleOpenInvite() {
	showInviteModal.value = true;

	if (!inviteUrl.value) {
		await createInviteLink();
	}
}

async function createInviteLink() {
	isCreatingInvite.value = true;
	try {
		const response = await api.createInvitation(roomId, {
			ttl_seconds: 86400, // 24 hours
		});
		// Use frontend URL with the token
		inviteUrl.value = `${window.location.origin}/invite/${response.token}`;
	} catch (error) {
		toastStore.error("Failed to create invite link");
	} finally {
		isCreatingInvite.value = false;
	}
}

async function copyInviteLink() {
	try {
		await navigator.clipboard.writeText(inviteUrl.value);
		toastStore.success("Invite link copied to clipboard!");
	} catch (error) {
		toastStore.error("Failed to copy link");
	}
}

async function regenerateInviteLink() {
	inviteUrl.value = "";
	await createInviteLink();
}
</script>

<template>
	<div class="fixed bottom-0 left-0 right-0 p-4 z-40">
		<div class="max-w-3xl mx-auto">
			<!-- Main controls bar -->
			<div class="flex items-center justify-center gap-2 p-3 rounded-2xl bg-bg-secondary/90 backdrop-blur-xl border border-border shadow-2xl">
				<!-- Mute toggle -->
				<button
					:class="[
						'relative p-3 rounded-xl transition-all duration-200',
						roomStore.isMuted ? 'bg-danger text-white hover:bg-danger-light' : 'bg-bg-elevated text-text-primary hover:bg-bg-hover',
					]"
					:title="roomStore.isMuted ? 'Unmute' : 'Mute'"
					@click="handleToggleMute"
				>
					<Icon :name="roomStore.isMuted ? 'heroicons:microphone-solid' : 'heroicons:microphone'" class="w-6 h-6" />
					<!-- Strikethrough line when muted -->
					<div v-if="roomStore.isMuted" class="absolute inset-0 flex items-center justify-center pointer-events-none">
						<div class="w-8 h-0.5 bg-white rotate-45" />
					</div>
				</button>

				<!-- Video toggle -->
				<button
					:class="[
						'relative p-3 rounded-xl transition-all duration-200',
						roomStore.isVideoOff ? 'bg-danger text-white hover:bg-danger-light' : 'bg-bg-elevated text-text-primary hover:bg-bg-hover',
					]"
					:title="roomStore.isVideoOff ? 'Turn on camera' : 'Turn off camera'"
					@click="handleToggleVideo"
				>
					<Icon :name="roomStore.isVideoOff ? 'heroicons:video-camera-slash' : 'heroicons:video-camera'" class="w-6 h-6" />
				</button>

				<!-- Divider -->
				<div class="w-px h-8 bg-border mx-1" />

				<!-- Screen share -->
				<button
                    class="relative"
                    :class="['p-3 rounded-xl transition-all duration-200', roomStore.isScreenSharing ? 'bg-accent text-white' : 'bg-bg-elevated text-text-primary hover:bg-bg-hover']"
                    :title="roomStore.isScreenSharing ? (roomStore.isScreenShareAudio ? 'Stop screen sharing (with audio)' : 'Stop screen sharing') : 'Share screen'"
                    @click="handleScreenShare"
				>
                    <Icon name="heroicons:computer-desktop" class="w-6 h-6" />
                    <span v-if="roomStore.isScreenSharing && roomStore.isScreenShareAudio" class="absolute top-0 right-0 w-3 h-3 rounded-full bg-accent border border-white" aria-hidden="true"></span>
                </button>

				<!-- AI Assistant -->
				<button
					:class="['p-3 rounded-xl transition-all duration-200', aiStore.isPanelOpen ? 'bg-accent text-white' : 'bg-bg-elevated text-text-primary hover:bg-bg-hover']"
					title="AI Assistant"
					@click="handleOpenAi"
				>
					<Icon name="heroicons:sparkles" class="w-6 h-6" />
				</button>

				<!-- Invite -->
				<button class="p-3 rounded-xl bg-bg-elevated text-text-primary hover:bg-bg-hover transition-all duration-200" title="Invite participants" @click="handleOpenInvite">
					<Icon name="heroicons:user-plus" class="w-6 h-6" />
				</button>

				<!-- Settings -->
				<button class="p-3 rounded-xl bg-bg-elevated text-text-primary hover:bg-bg-hover transition-all duration-200" title="Settings" @click="showSettings = true">
					<Icon name="heroicons:cog-6-tooth" class="w-6 h-6" />
				</button>

				<!-- Divider -->
				<div class="w-px h-8 bg-border mx-1" />

				<!-- Leave button -->
				<button
					class="px-5 py-3 rounded-xl bg-danger text-white hover:bg-danger-light transition-all duration-200 flex items-center gap-2"
					title="Leave meeting"
					@click="handleLeave"
				>
					<Icon name="heroicons:phone-x-mark" class="w-5 h-5" />
					<span class="font-medium hidden sm:inline">Leave</span>
				</button>
			</div>
		</div>
	</div>

	<!-- Invite Modal -->
	<BaseModal v-model="showInviteModal" title="Invite Participants">
		<div class="space-y-4">
			<p class="text-text-secondary">Share this link to invite others to join the meeting.</p>

			<!-- Loading state -->
			<div v-if="isCreatingInvite" class="flex justify-center py-4">
				<LoadingSpinner />
			</div>

			<!-- Invite link -->
			<template v-else>
				<div class="flex gap-2">
					<input :value="inviteUrl" readonly class="flex-1 px-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text-primary text-sm" />
					<button class="px-4 py-2.5 rounded-lg bg-accent text-white hover:bg-accent-light transition-colors" @click="copyInviteLink">
						<Icon name="heroicons:clipboard-document" class="w-5 h-5" />
					</button>
				</div>

				<div class="flex items-center gap-2 text-sm text-text-muted">
					<Icon name="heroicons:clock" class="w-4 h-4" />
					<span>This link expires in 24 hours</span>
				</div>

				<div class="flex gap-2">
					<BaseButton variant="secondary" class="flex-1" @click="regenerateInviteLink">
						<Icon name="heroicons:arrow-path" class="w-4 h-4" />
						New Link
					</BaseButton>
					<BaseButton class="flex-1" @click="copyInviteLink">
						<Icon name="heroicons:clipboard-document" class="w-4 h-4" />
						Copy Link
					</BaseButton>
				</div>
			</template>
		</div>
	</BaseModal>
</template>
