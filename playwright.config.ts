import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:4173/aster-todo/', headless: true },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/aster-todo/',
    env: { NUXT_PUBLIC_SUPABASE_URL: 'https://auth-test.supabase.co', NUXT_PUBLIC_SUPABASE_KEY: 'sb_publishable_test' },
    reuseExistingServer: false,
  },
})
