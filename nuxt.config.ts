import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['./app/assets/css/main.css'],

  vite: {
    plugins: [
      tailwindcss(),
    ],
  },

  modules: [
    '@nuxt/a11y',
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/hints',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxt/test-utils',
    '@pinia/nuxt'
  ],

  // Component auto-import configuration
  components: [
    {
      path: '~/components/ui',
      pathPrefix: false
    },
    {
      path: '~/components/video',
      pathPrefix: false
    },
    {
      path: '~/components/controls',
      pathPrefix: false
    },
    {
      path: '~/components/panels',
      pathPrefix: false
    },
    {
      path: '~/components/modals',
      pathPrefix: false
    },
    {
      path: '~/components/layout',
      pathPrefix: false
    }
  ],

  // Runtime config for API URLs
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:8080/api/v1',
      wsBaseUrl: process.env.WS_BASE_URL || 'ws://localhost:8080/ws'
    }
  },

  // Pinia configuration
  pinia: {
    storesDirs: ['./stores/**']
  },

  // App configuration
  app: {
    head: {
      title: 'TrueGather - Secure Video Collaboration',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Secure video conferencing platform with end-to-end encryption and AI-powered meeting assistance' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ]
    }
  },

  // SSR configuration - disable for WebRTC
  ssr: false
})