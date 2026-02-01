<script setup lang="ts">
const roomStore = useRoomStore()
const aiStore = useAiStore()

// Panel visibility
const showParticipants = ref(true)
</script>

<template>
  <div class="h-screen bg-bg-primary flex flex-col overflow-hidden">
    <!-- Room header -->
    <header
      class="flex items-center justify-between px-4 py-3 bg-bg-secondary/80 backdrop-blur-xl border-b border-border z-30">
      <!-- Room info -->
      <div class="flex items-center gap-3">
        <NuxtLink to="/"
          class="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
          <Icon name="heroicons:arrow-left" class="w-5 h-5" />
        </NuxtLink>

        <div>
          <h1 class="font-semibold text-text-primary">
            {{ roomStore.roomName || 'Meeting Room' }}
          </h1>
          <p class="text-xs text-text-muted">
            {{ roomStore.participantCount }} participant{{ roomStore.participantCount !== 1 ? 's' : '' }}
          </p>
        </div>
      </div>

      <!-- Header actions -->
      <div class="flex items-center gap-2">
        <!-- Toggle participants panel -->
        <button :class="[
          'p-2 rounded-lg transition-colors',
          showParticipants
            ? 'bg-accent/20 text-accent'
            : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
        ]" title="Toggle participants" @click="showParticipants = !showParticipants">
          <Icon name="heroicons:users" class="w-5 h-5" />
        </button>

        <!-- Toggle AI panel -->
        <button :class="[
          'p-2 rounded-lg transition-colors',
          aiStore.isPanelOpen
            ? 'bg-accent/20 text-accent'
            : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
        ]" title="Toggle AI assistant" @click="aiStore.togglePanel()">
          <Icon name="heroicons:sparkles" class="w-5 h-5" />
        </button>

        <!-- Connection status -->
        <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg-elevated">
          <div :class="[
            'w-2 h-2 rounded-full',
            roomStore.isSignalingConnected ? 'bg-success' : 'bg-danger'
          ]" />
          <span class="text-xs text-text-secondary">
            {{ roomStore.isSignalingConnected ? 'Connected' : 'Disconnected' }}
          </span>
        </div>
      </div>
    </header>

    <!-- Main content area -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Video grid area -->
      <div class="flex-1 relative">
        <slot />
      </div>

      <!-- Side panels -->
      <Transition enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="translate-x-full opacity-0" enter-to-class="translate-x-0 opacity-100"
        leave-active-class="transition-all duration-200 ease-in" leave-from-class="translate-x-0 opacity-100"
        leave-to-class="translate-x-full opacity-0">
        <aside v-if="showParticipants || aiStore.isPanelOpen" class="w-80 border-l border-border flex flex-col">
          <!-- Participants panel -->
          <div v-if="showParticipants && !aiStore.isPanelOpen" class="flex-1">
            <ParticipantsPanel />
          </div>

          <!-- AI panel (takes over when open) -->
          <div v-if="aiStore.isPanelOpen" class="flex-1">
            <ChatPanel />
          </div>
        </aside>
      </Transition>
    </div>

    <!-- Toast container -->
    <ToastContainer />
    <DebugPanel />
  </div>
</template>
