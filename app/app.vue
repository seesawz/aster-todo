<script setup lang="ts">
const {
  tasks, filtered, viewTitle, view, search,
  toastVisible, toastText, undoRemove, clearDone, initTasks,
} = useTasks()
const { initTheme } = useTheme()

// 初始化：主题 + 数据加载（本地缓存先行，Supabase 异步接管）
onMounted(() => {
  initTheme()
  initTasks()
})

// 快捷键：N 聚焦新任务输入框，/ 聚焦搜索
const taskInput = ref<{ focus: () => void } | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return
  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault()
    taskInput.value?.focus()
  } else if (e.key === '/') {
    e.preventDefault()
    searchInput.value?.focus()
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

// 顶部日期与问候
const dateLine = computed(() => {
  const now = new Date()
  const h = now.getHours()
  const hi = h < 6 ? '夜深了' : h < 12 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好'
  const date = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(now)
  return `${date} · ${hi}`
})

const VIEW_TITLES: Record<string, string> = { today: '今天', starred: '重要', all: '全部任务', done: '已完成' }

const emptyCopy = computed(() => {
  if (search.value) return { title: '没有找到相关任务', sub: `换个关键词试试，当前搜索：“${search.value}”` }
  if (view.value === 'today') return { title: '今天没有安排', sub: '享受无事的轻盈，或在上方添加新任务' }
  if (view.value === 'starred') return { title: '还没有重要任务', sub: '把鼠标移到任务上，点 ⭐ 星标收藏' }
  if (view.value === 'done') return { title: '还没有已完成的任务', sub: '完成任务后会出现在这里' }
  return tasks.value.length === 0
    ? { title: '还没有任务', sub: '在上方输入框添加你的第一个任务吧' }
    : { title: '全部完成！', sub: '所有任务都已处理，好好休息 ☕' }
})
</script>

<template>
  <div class="app">
    <TheSidebar />

    <main class="main">
      <div class="main-inner">
        <header class="header">
          <div class="header-text">
            <p class="eyebrow"><span class="dot" aria-hidden="true" /><span>{{ dateLine }}</span></p>
            <h1>{{ viewTitle }}</h1>
          </div>
          <div class="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.4-4.4" />
            </svg>
            <input
              ref="searchInput"
              v-model="search"
              type="text"
              placeholder="搜索任务，按 / 聚焦"
              autocomplete="off"
            >
          </div>
        </header>

        <TaskComposer ref="taskInput" />

        <template v-if="filtered.length > 0">
          <div class="list-head">
            <span>{{ search ? '搜索结果' : VIEW_TITLES[view] }} · {{ filtered.length }}</span>
            <button v-if="view === 'done' && !search" class="link-btn" @click="clearDone">清除已完成</button>
          </div>
          <TaskList :tasks="filtered" />
        </template>

        <div v-else class="empty">
          <span class="empty-logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M12 2.5v5.5M12 16v5.5M2.5 12H8M16 12h5.5M5.3 5.3l3.9 3.9M14.8 14.8l3.9 3.9M18.7 5.3l-3.9 3.9M9.2 14.8l-3.9 3.9" />
            </svg>
          </span>
          <p class="empty-title">{{ emptyCopy.title }}</p>
          <p class="empty-sub">{{ emptyCopy.sub }}</p>
        </div>

      </div>
    </main>

    <!-- 撤销 Toast -->
    <div v-if="toastVisible" class="toast">
      <span id="toastText">{{ toastText }}</span>
      <button class="toast-undo" type="button" @click="undoRemove">撤销</button>
    </div>
  </div>
</template>
