import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { computed, ref } from 'vue'

const user = ref<User | null>(null)
const ready = ref(false)
const guest = ref(false)
const GUEST_KEY = 'aster.guest'
const busy = ref(false)
const authError = ref<string | null>(null)
let client: SupabaseClient | null = null
let initialization: Promise<void> | null = null

export function useAuth() {
  const config = useRuntimeConfig()
  const configured = !!(config.public.supabaseUrl && config.public.supabaseKey)
  const isGuestMode = computed(() => !user.value && (guest.value || !configured))

  function chooseGuest(value: boolean) {
    guest.value = value
    authError.value = null
    try {
      if (value) localStorage.setItem(GUEST_KEY, '1')
      else localStorage.removeItem(GUEST_KEY)
    } catch { /* current-tab choice still works without preference storage */ }
  }
  function continueAsGuest() { chooseGuest(true) }
  function showLogin() { chooseGuest(false) }

  function getClient() {
    if (!configured) return null
    client ??= createClient(config.public.supabaseUrl, config.public.supabaseKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    })
    return client
  }

  function initAuth() {
    initialization ??= (async () => {
      try {
        try { guest.value = localStorage.getItem(GUEST_KEY) === '1' } catch { /* ignore */ }
        window.addEventListener('storage', event => {
          if (event.key === GUEST_KEY) guest.value = event.newValue === '1'
        })
        const c = getClient()
        if (!c) return
        // Keep the callback synchronous: SDK auth calls must run outside its lock.
        c.auth.onAuthStateChange((_event, session) => {
          if (session?.user) chooseGuest(false)
          user.value = session?.user ?? null
        })
        const { error: initializationError } = await c.auth.initialize()
        if (initializationError) throw initializationError
        const { data, error } = await c.auth.getSession()
        if (error) throw error
        if (data.session?.user) chooseGuest(false)
        user.value = data.session?.user ?? null
      } catch {
        authError.value = '登录状态恢复失败，请重新登录。'
      } finally {
        const url = new URL(window.location.href)
        if (url.searchParams.has('error') || new URLSearchParams(url.hash.slice(1)).has('error')) {
          authError.value = '授权未完成，请重新选择登录方式。'
        }
        // Remove callback codes and errors after the SDK has consumed them.
        for (const key of ['code', 'error', 'error_code', 'error_description']) url.searchParams.delete(key)
        if (new URLSearchParams(url.hash.slice(1)).has('error')) url.hash = ''
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
        ready.value = true
      }
    })()
    return initialization
  }

  async function signIn(provider: 'github') {
    if (busy.value) return
    busy.value = true
    authError.value = null
    try {
      const c = getClient()
      if (!c) throw new Error('请先配置 Supabase 连接信息。')
      const redirectTo = new URL(config.app.baseURL, window.location.origin).href
      const { error } = await c.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      })
      if (error) throw error
    } catch {
      authError.value = '无法发起登录，请检查网络及 Supabase 登录提供商配置。'
    } finally {
      busy.value = false
    }
  }

  async function signOut() {
    if (busy.value) return
    busy.value = true
    authError.value = null
    try {
      const { error } = await getClient()!.auth.signOut({ scope: 'local' })
      if (error) throw error
      user.value = null
    } catch {
      authError.value = '退出失败，请检查网络后重试。'
    } finally {
      busy.value = false
    }
  }

  const displayName = computed(() => user.value?.user_metadata?.full_name || user.value?.user_metadata?.user_name || user.value?.email || '访客')
  return { user, ready, busy, authError, configured, isGuestMode, continueAsGuest, showLogin, displayName, getClient, initAuth, signIn, signOut }
}
