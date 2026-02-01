<script setup lang="ts">
interface Props {
	localStream?: MediaStream | null;
	localDisplayName: string;
	isLocalMuted?: boolean;
	isLocalVideoOff?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	isLocalMuted: false,
	isLocalVideoOff: false,
});

const roomStore = useRoomStore();

// Compute grid layout based on participant count
const gridClasses = computed(() => {
	const count = roomStore.publishers.size + (props.localStream ? 1 : 0);

	if (count === 1) {
		return "grid-cols-1";
	} else if (count === 2) {
		return "grid-cols-2";
	} else if (count <= 4) {
		return "grid-cols-2 grid-rows-2";
	} else if (count <= 6) {
		return "grid-cols-3 grid-rows-2";
	} else if (count <= 9) {
		return "grid-cols-3 grid-rows-3";
	} else {
		return "grid-cols-4 grid-rows-3";
	}
});

// Tile size based on count
const tileSize = computed(() => {
	const count = roomStore.publishers.size + (props.localStream ? 1 : 0);
	if (count <= 2) return "lg";
	if (count <= 6) return "md";
	return "sm";
});

// Get publishers as array for iteration
const publishers = computed(() => Array.from(roomStore.publishers.values()));

// Get reactive remote streams map
const remoteStreams = computed(() => roomStore.remoteStreams);
</script>

<template>
	<div :class="['grid gap-3 p-4 w-full h-full overflow-hidden', gridClasses]">
		<!-- Local video tile (always first) -->
		<VideoTile
			v-if="localStream || true"
			:stream="localStream"
			:display-name="localDisplayName"
			:is-muted="isLocalMuted"
			:is-video-off="isLocalVideoOff"
			:is-local="true"
			:size="tileSize"
		/>

		<!-- Remote video tiles -->
		<VideoTile v-for="publisher in publishers" :key="publisher.feed_id" :stream="remoteStreams.get(publisher.feed_id)" :display-name="publisher.display" :size="tileSize" />

		<!-- Empty state -->
		<div v-if="publishers.length === 0 && !localStream" class="col-span-full flex flex-col items-center justify-center text-center p-8">
			<Icon name="heroicons:users" class="w-16 h-16 text-text-muted mb-4" />
			<h3 class="text-lg font-medium text-text-primary mb-2">Waiting for participants</h3>
			<p class="text-text-secondary max-w-md">Share the room link to invite others to join the meeting.</p>
		</div>
	</div>
</template>
