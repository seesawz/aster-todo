// 深浅色主题：默认跟随系统，手动切换后记忆偏好
const THEME_KEY = 'aster.theme'
const LEGACY_THEME_KEY = 'claude-todo.theme' // 旧版 key，读取时兼容迁移

export function useTheme() {
  const theme = useState<'light' | 'dark' | null>('theme', () => null)

  function apply(value: 'light' | 'dark' | null) {
    theme.value = value
    if (import.meta.client) {
      if (value) document.documentElement.dataset.theme = value
      else delete document.documentElement.dataset.theme
      try { localStorage.setItem(THEME_KEY, JSON.stringify(value)) } catch { /* 隐私模式 */ }
    }
  }

  function initTheme() {
    if (!import.meta.client) return
    let saved: 'light' | 'dark' | null = null
    try { saved = JSON.parse(localStorage.getItem(THEME_KEY) ?? localStorage.getItem(LEGACY_THEME_KEY)) } catch { /* ignore */ }
    if (saved === 'light' || saved === 'dark') {
      theme.value = saved
      document.documentElement.dataset.theme = saved
    }
  }

  function toggleTheme() {
    if (!import.meta.client) return
    const cur = theme.value
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    apply(cur === 'dark' ? 'light' : 'dark')
  }

  return { theme, initTheme, toggleTheme }
}
