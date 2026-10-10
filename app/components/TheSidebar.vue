<script setup lang="ts">
const { counts, progress, view, setView, tasks, mode, syncError } = useTasks()
const { toggleTheme } = useTheme()

const emit = defineEmits<{ (e: 'new-task'): void }>()

// 视图图标（静态字符串，v-html 安全）
const NAV_ICONS: Record<string, string> = {
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17M8.5 15.5l2.4 2.4 4.6-4.8"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13.5l9 5 9-5"/>',
  'check-circle': '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.5l2.4 2.4 4.6-5"/>',
}

const NAV_ITEMS: { key: 'today' | 'starred' | 'all' | 'done', label: string, icon: string }[] = [
  { key: 'today', label: '今天', icon: 'calendar' },
  { key: 'starred', label: '重要', icon: 'star' },
  { key: 'all', label: '全部', icon: 'layers' },
  { key: 'done', label: '已完成', icon: 'check-circle' },
]

const MODE_LABEL = {
  local: '本地模式',
  cloud: 'Supabase 已连接',
  error: '同步失败 · 本地缓存',
} as const

const MODE_NOTE = {
  local: '数据仅保存在本地浏览器',
  cloud: '数据已云同步至 Supabase',
  error: '云端暂不可达，改动已存本地',
} as const

// 数据导出（JSON 备份）
function exportData() {
  const blob = new Blob(
    [JSON.stringify({ exportedAt: new Date().toISOString(), todos: tasks.value }, null, 2)],
    { type: 'application/json' },
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `claude-todo-${todayStr()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <span class="logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
          <path d="M12 2.5v5.5M12 16v5.5M2.5 12H8M16 12h5.5M5.3 5.3l3.9 3.9M14.8 14.8l3.9 3.9M18.7 5.3l-3.9 3.9M9.2 14.8l-3.9 3.9" />
        </svg>
      </span>
      <span class="brand-name">Claude Todo</span>
      <button class="icon-btn" title="切换深浅色主题" aria-label="切换深浅色主题" @click="toggleTheme">
        <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" />
        </svg>
        <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
        </svg>
      </button>
    </div>

    <button class="new-task-btn" title="快捷键 N" @click="emit('new-task')">
      <span class="plus" aria-hidden="true">＋</span> 新任务
    </button>

    <nav class="nav" aria-label="视图切换">
      <button
        v-for="item in NAV_ITEMS"
        :key="item.key"
        class="nav-item"
        :class="{ active: view === item.key }"
        @click="setView(item.key)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" v-html="NAV_ICONS[item.icon]" />
        {{ item.label }}
        <span class="badge">{{ counts[item.key] }}</span>
      </button>
    </nav>

    <div class="sidebar-footer">
      <div class="progress">
        <div class="progress-label">
          <span>今日进度</span>
          <span class="mono">{{ progress.done }} / {{ progress.total }}</span>
        </div>
        <div class="progress-track"><div class="progress-fill" :style="{ width: progress.pct + '%' }" /></div>
      </div>

      <div class="conn-badge" :class="mode" :title="syncError || ''">
        <span class="led" />{{ MODE_LABEL[mode] }}
      </div>

      <button class="export-btn" title="导出全部数据为 JSON 备份" @click="exportData">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15" />
        </svg>
        导出数据
      </button>
      <p class="sidebar-note">{{ MODE_NOTE[mode] }}</p>
    </div>
  </aside>
</template>
