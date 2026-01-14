<script setup lang="ts">
const roomStore = useRoomStore()
const signaling = useSignalingWs()

const isOpen = ref(false)
const messages = ref<any[]>([])

onMounted(() => {
    signaling.on('*', (msg) => {
        messages.value.unshift({
            time: new Date().toLocaleTimeString(),
            type: msg.type,
            payload: msg.payload
        })
        if (messages.value.length > 20) messages.value.pop()
    })
})
</script>

<template>
    <div class="fixed bottom-4 left-4 z-50">
        <button @click="isOpen = !isOpen" class="bg-gray-800 text-white px-3 py-1 rounded-t text-xs font-mono">
            Debug {{ isOpen ? '▼' : '▲' }}
        </button>

        <div v-if="isOpen"
            class="bg-gray-900/90 text-green-400 p-4 rounded-tr-lg rounded-br-lg w-96 h-96 overflow-auto font-mono text-xs shadow-xl backdrop-blur">
            <div class="mb-4 space-y-1 border-b border-gray-700 pb-2">
                <div>Room ID: {{ roomStore.roomId }}</div>
                <div>User ID: {{ roomStore.userId }}</div>
                <div>WS Connected: {{ signaling.isConnected }}</div>
                <div>Participants: {{ roomStore.participantCount }}</div>
                <div>Publishers: {{ roomStore.publisherCount }}</div>
                <div>Is Publishing: {{ roomStore.isPublishing }}</div>
            </div>

            <div class="space-y-2">
                <div v-for="(msg, i) in messages" :key="i" class="border-b border-gray-800 pb-1">
                    <span class="text-gray-500">[{{ msg.time }}]</span>
                    <span class="text-blue-400 font-bold"> {{ msg.type }}</span>
                    <pre class="whitespace-pre-wrap text-gray-400 mt-1 max-h-20 overflow-y-auto">{{ msg.payload }}</pre>
                </div>
            </div>
        </div>
    </div>
</template>
