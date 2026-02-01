<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <div class="min-h-screen bg-bg-primary">
    <!-- Header -->
    <header class="fixed top-0 left-0 right-0 z-50 bg-bg-secondary/80 backdrop-blur-xl border-b border-border">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <NuxtLink to="/" class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center">
              <Icon name="heroicons:video-camera" class="w-5 h-5 text-white" />
            </div>
            <span class="text-xl font-bold text-text-primary">TrueGather</span>
          </NuxtLink>

          <!-- Navigation -->
          <nav class="hidden md:flex items-center gap-6">
            <NuxtLink
              to="/"
              :class="[
                'text-sm font-medium transition-colors',
                route.path === '/' ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
              ]"
            >
              Home
            </NuxtLink>
            <NuxtLink
              to="/dashboard"
              :class="[
                'text-sm font-medium transition-colors',
                route.path === '/dashboard' ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
              ]"
            >
              Dashboard
            </NuxtLink>
          </nav>

          <!-- Actions -->
          <div class="flex items-center gap-3">
            <NuxtLink to="/create">
              <BaseButton size="sm">
                <Icon name="heroicons:plus" class="w-4 h-4" />
                New Meeting
              </BaseButton>
            </NuxtLink>
          </div>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="pt-16">
      <slot />
    </main>

    <!-- Toast container -->
    <ToastContainer />
  </div>
</template>
