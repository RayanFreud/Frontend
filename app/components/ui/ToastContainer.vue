<script setup lang="ts">
const toastStore = useToastStore()
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none"
    >
      <TransitionGroup
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-x-full"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 translate-x-0"
        leave-to-class="opacity-0 translate-x-full"
      >
        <div
          v-for="toast in toastStore.toasts"
          :key="toast.id"
          class="pointer-events-auto"
        >
          <ToastNotification
            :toast="toast"
            @dismiss="toastStore.dismiss(toast.id)"
          />
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
