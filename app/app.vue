<script setup lang="ts">
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'motion-v'

const reducedMotion = useReducedMotion()
const {
  filtered, projectId, viewTitle, search, completedCount,
  toastVisible, toastText, undoRemove, clearDone, initTasks,
} = useTasks()
const { initTheme } = useTheme()

// 初始化：主题 + 数据加载（本地缓存先行，Supabase 异步接管）
onMounted(() => {
  initTheme()
  initTasks()
})

// 快捷键：N 聚焦新任务输入框，Ctrl+F 呼出搜索，Esc 关闭搜索
const taskInput = ref<{ focus: () => void } | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const searchVisible = ref(false)

function closeSearch() {
  searchVisible.value = false
  search.value = ''
}

async function onKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    searchVisible.value = true
    await nextTick()
    searchInput.value?.focus()
    searchInput.value?.select()
    return
  }
  if (e.key === 'Escape' && searchVisible.value) {
    e.preventDefault()
    closeSearch()
    return
  }
  const target = e.target as HTMLElement
  const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return
  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault()
    taskInput.value?.focus()
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

const emptyCopy = computed(() => search.value
  ? { title: '没有找到相关任务', sub: `换个关键词试试，当前搜索：“${search.value}”` }
  : { title: '这个项目还没有任务', sub: '在下方输入框添加你的第一个任务吧' },
)
</script>

<template>
  <MotionConfig reduced-motion="user" :skip-animations="reducedMotion" :transition="{ duration: 0.2, ease: 'easeOut' }">
    <div class="app">
      <TheSidebar @new-task="taskInput?.focus()" />

      <main class="main">
        <motion.div class="main-inner" :initial="{ opacity: 0, y: 8 }" :animate="{ opacity: 1, y: 0 }">
          <header class="header">
            <div class="header-text">
              <motion.h1 class="page-title" :key="projectId" :initial="{ opacity: 0, y: 4 }" :animate="{ opacity: 1, y: 0 }">{{ viewTitle }}</motion.h1>
            </div>
            <AnimatePresence>
              <motion.div v-if="searchVisible" key="search" class="search-box" :initial="{ opacity: 0, y: -4 }" :animate="{ opacity: 1, y: 0 }" :exit="{ opacity: 0, y: -4 }">
                <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                  <circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.4-4.4" />
                </svg>
                <input
                  class="search-input"
                ref="searchInput"
                  v-model="search"
                  type="text"
                  placeholder="搜索任务"
                  aria-label="搜索任务"
                  autocomplete="off"
                >
                <button type="button" class="search-close" aria-label="关闭搜索" title="关闭搜索（Esc）" @click="closeSearch">×</button>
              </motion.div>
            </AnimatePresence>
          </header>

          <div v-if="filtered.length > 0" class="list-head">
            <span>{{ search ? '搜索结果' : '任务' }} · {{ filtered.length }}</span>
            <button v-if="completedCount > 0 && !search" class="task-clear" @click="clearDone">清除已完成</button>
          </div>
          <TaskList ref="taskInput" :tasks="filtered">
            <template #empty>
              <div class="task-empty">
                <motion.span class="task-empty-logo" :initial="{ scale: 0.9, rotate: -12 }" :animate="{ scale: 1, rotate: 0 }" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M12 2.5v5.5M12 16v5.5M2.5 12H8M16 12h5.5M5.3 5.3l3.9 3.9M14.8 14.8l3.9 3.9M18.7 5.3l-3.9 3.9M9.2 14.8l-3.9 3.9" />
                  </svg>
                </motion.span>
                <p class="task-empty-title">{{ emptyCopy.title }}</p>
                <p class="task-empty-sub">{{ emptyCopy.sub }}</p>
              </div>
            </template>
          </TaskList>
        </motion.div>
      </main>

      <!-- 撤销 Toast -->
      <AnimatePresence>
        <motion.div v-if="toastVisible" key="toast" class="toast" :initial="{ opacity: 0, y: 12 }" :animate="{ opacity: 1, y: 0 }" :exit="{ opacity: 0, y: 8 }">
          <span class="truncate">{{ toastText }}</span>
          <button class="toast-undo" type="button" @click="undoRemove">撤销</button>
        </motion.div>
      </AnimatePresence>
    </div>
  </MotionConfig>
</template>
