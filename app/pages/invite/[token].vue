<script setup lang="ts">
definePageMeta({
	layout: "default",
});

const route = useRoute();
const router = useRouter();
const api = useApi();
const toastStore = useToastStore();

// State
const token = route.params.token as string;
const invitationInfo = ref<{
	token: string;
	room_id: string;
	room_name: string;
	expires_at: string;
	is_valid: boolean;
} | null>(null);
const isLoading = ref(true);
const isError = ref(false);
const errorMessage = ref("");

// Load invitation info
onMounted(async () => {
	try {
		invitationInfo.value = await api.getInvitation(token);

		if (!invitationInfo.value.is_valid) {
			isError.value = true;
			errorMessage.value = "This invitation link has expired or reached its maximum uses.";
		}
	} catch (error: any) {
		isError.value = true;
		errorMessage.value = error?.data?.error || "This invitation link is invalid or has expired.";
	} finally {
		isLoading.value = false;
	}
});

async function handleJoin() {
	if (!invitationInfo.value) return;

	try {
		// Use the invitation
		await api.useInvitation(token);

		// Redirect to the room lobby
		router.push(`/room/${invitationInfo.value.room_id}/lobby`);
	} catch (error: any) {
		toastStore.error(error?.data?.error || "Failed to use invitation");
	}
}

function formatExpiryDate(dateStr: string) {
	const date = new Date(dateStr);
	return date.toLocaleString();
}
</script>

<template>
	<div class="min-h-screen flex items-center justify-center p-4">
		<div class="w-full max-w-md">
			<!-- Loading state -->
			<div v-if="isLoading" class="flex justify-center">
				<LoadingSpinner size="lg" />
			</div>

			<!-- Error state -->
			<template v-else-if="isError">
				<BaseCard padding="lg" class="text-center">
					<div class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
						<Icon name="heroicons:x-circle" class="w-8 h-8 text-red-400" />
					</div>
					<h1 class="text-xl font-bold text-text-primary mb-2">Invalid Invitation</h1>
					<p class="text-text-secondary mb-6">
						{{ errorMessage }}
					</p>
					<BaseButton class="w-full" @click="router.push('/')">
						<Icon name="heroicons:home" class="w-5 h-5" />
						Go Home
					</BaseButton>
				</BaseCard>
			</template>

			<!-- Valid invitation -->
			<template v-else-if="invitationInfo">
				<BaseCard padding="lg">
					<div class="text-center mb-6">
						<div class="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center">
							<Icon name="heroicons:envelope-open" class="w-8 h-8 text-accent" />
						</div>
						<h1 class="text-xl font-bold text-text-primary mb-2">You're Invited!</h1>
						<p class="text-text-secondary">You've been invited to join a meeting</p>
					</div>

					<!-- Meeting info -->
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

					<!-- Join button -->
					<BaseButton class="w-full" size="lg" @click="handleJoin">
						<Icon name="heroicons:video-camera" class="w-5 h-5" />
						Join Meeting
					</BaseButton>

					<!-- Back link -->
					<NuxtLink to="/" class="block text-center text-sm text-text-secondary hover:text-text-primary transition-colors mt-4"> Cancel and return home </NuxtLink>
				</BaseCard>
			</template>
		</div>
	</div>
</template>
