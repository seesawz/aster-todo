// ============================================================
// 数据层：任务状态、视图过滤、增删改查
// 同步策略：配置了 Supabase → 云端为主 + localStorage 缓存；
//          未配置 / 云端失败 → 自动降级本地模式
// ============================================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Priority, Task } from '~/utils/parse'

export type ViewName = 'today' | 'starred' | 'all' | 'done'
export type ConnMode = 'local' | 'cloud' | 'error'

const STORAGE_KEY = 'claude-todo.tasks'
const OWNER_KEY = 'claude-todo.owner'

// ---------- 模块级单例状态（所有组件共享） ----------
const tasks = ref<Task[]>([])
const view = ref<ViewName>('today')
const search = ref('')
const mode = ref<ConnMode>('local')   // 当前数据模式
const syncError = ref<string | null>(null)
const toastVisible = ref(false)
const toastText = ref('')
let undoState: { task: Task, index: number } | null = null
let undoTimer: ReturnType<typeof setTimeout> | null = null

let client: SupabaseClient | null = null
let ownerId = ''

function cloudConfigured(): boolean {
  const cfg = useRuntimeConfig()
  return !!(cfg.public.supabaseUrl && cfg.public.supabaseKey)
}

/** 无登录方案：每个浏览器生成随机 owner，配合 RLS 只能看到自己的数据 */
function ensureOwnerId(): string {
  let id = ''
  try { id = localStorage.getItem(OWNER_KEY) || '' } catch { /* ignore */ }
  if (!id) {
    id = crypto.randomUUID()
    try { localStorage.setItem(OWNER_KEY, id) } catch { /* ignore */ }
  }
  return id
}

// ---------- 数据库行 ↔ Task 映射 ----------
interface DbTask {
  id: string
  owner: string
  text: string
  done: boolean
  priority: number
  due: string | null
  starred: boolean
  tags: string[] | null
  created_at: string
  completed_at: string | null
}

function fromDb(row: DbTask): Task {
  return {
    id: row.id,
    text: row.text ?? '',
    done: !!row.done,
    priority: ([1, 2, 3].includes(row.priority) ? row.priority : 0) as Priority,
    due: row.due ?? null,
    starred: !!row.starred,
    tags: row.tags ?? [],
    createdAt: new Date(row.created_at).getTime() || Date.now(),
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
  }
}

function toDb(t: Task): DbTask {
  return {
    id: t.id,
    owner: ownerId,
    text: t.text,
    done: t.done,
    priority: t.priority,
    due: t.due,
    starred: t.starred,
    tags: t.tags,
    created_at: new Date(t.createdAt).toISOString(),
    completed_at: t.completedAt ? new Date(t.completedAt).toISOString() : null,
  }
}

// ---------- 本地持久化 ----------
function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const data = raw ? JSON.parse(raw) : []
    if (Array.isArray(data)) tasks.value = data.map(normalize)
  } catch { /* ignore */ }
}

function saveLocal() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.value)) } catch { /* ignore */ }
}

function normalize(t: Partial<Task>): Task {
  return {
    id: t.id || crypto.randomUUID(),
    text: String(t.text || ''),
    done: !!t.done,
    priority: ([1, 2, 3].includes(t.priority as number) ? t.priority : 0) as Priority,
    due: typeof t.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : null,
    starred: !!t.starred,
    tags: Array.isArray(t.tags) ? t.tags.map(String) : [],
    createdAt: t.createdAt || Date.now(),
    completedAt: t.completedAt ?? null,
  }
}

// ---------- 初始化（在 onMounted 中调用） ----------
async function initTasks() {
  loadLocal()
  if (!cloudConfigured()) {
    mode.value = 'local'
    return
  }
  const cfg = useRuntimeConfig()
  ownerId = ensureOwnerId()
  client = createClient(cfg.public.supabaseUrl, cfg.public.supabaseKey, {
    global: { headers: { 'x-owner-id': ownerId } },
  })
  try {
    const { data, error } = await client.from('tasks').select('*').order('created_at', { ascending: false })
    if (error) throw error
    // 云端数据覆盖本地缓存（云端为主）
    tasks.value = (data as DbTask[]).map(fromDb)
    mode.value = 'cloud'
    syncError.value = null
    saveLocal()
  } catch (e) {
    // 云端失败 → 本地缓存兜底
    mode.value = 'error'
    syncError.value = e instanceof Error ? e.message : String(e)
    console.warn('[claude-todo] Supabase 连接失败，使用本地模式：', syncError.value)
  }
}

// ---------- 云端写操作（乐观更新，失败不阻塞 UI） ----------
async function cloudWrite(fn: (c: SupabaseClient) => Promise<unknown>) {
  if (!client || mode.value === 'error') return
  try {
    const { error } = await fn(client) as { error: { message: string } | null }
    if (error) throw new Error(error.message)
    if (mode.value === 'error') mode.value = 'cloud'
    syncError.value = null
  } catch (e) {
    mode.value = 'error'
    syncError.value = e instanceof Error ? e.message : String(e)
    console.warn('[claude-todo] 同步失败，已保留在本地：', syncError.value)
  }
}

// ---------- 视图过滤与排序 ----------
const PRI_WEIGHT: Record<number, number> = { 1: 0, 2: 1, 3: 2, 0: 3 }

const isActive = (t: Task) => !t.done
const isActiveToday = (t: Task) => !t.done && !!t.due && diffDays(t.due) <= 0

const filtered = computed<Task[]>(() => {
  if (search.value) {
    const q = search.value.toLowerCase()
    return tasks.value.filter(
      t => t.text.toLowerCase().includes(q) || t.tags.some(tag => tag.toLowerCase().includes(q)),
    )
  }
  switch (view.value) {
    case 'today':
      return tasks.value
        .filter(isActiveToday)
        .sort((a, b) =>
          diffDays(a.due!) - diffDays(b.due!)
          || PRI_WEIGHT[a.priority] - PRI_WEIGHT[b.priority]
          || a.createdAt - b.createdAt)
    case 'starred':
      return tasks.value.filter(t => isActive(t) && t.starred)
    case 'all':
      return tasks.value.filter(isActive)
    case 'done':
      return tasks.value
        .filter(t => t.done)
        .sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt))
  }
  return []
})

const counts = computed(() => ({
  today: tasks.value.filter(isActiveToday).length,
  starred: tasks.value.filter(t => isActive(t) && t.starred).length,
  all: tasks.value.filter(isActive).length,
  done: tasks.value.filter(t => t.done).length,
}))

const progress = computed(() => {
  const done = tasks.value.filter(t => t.done).length
  return { done, total: tasks.value.length, pct: tasks.value.length ? Math.round((done / tasks.value.length) * 100) : 0 }
})

const VIEW_TITLES: Record<ViewName, string> = { today: '今天', starred: '重要', all: '全部任务', done: '已完成' }
const viewTitle = computed(() => (search.value ? `搜索“${search.value}”` : VIEW_TITLES[view.value]))

function setView(v: ViewName) {
  view.value = v
  search.value = ''
}

// ---------- 操作 ----------
function addTask(raw: string): boolean {
  const p = parseInput(raw)
  if (!p.text && p.tags.length === 0) return false
  const t = normalize({ ...p, createdAt: Date.now() })
  tasks.value.unshift(t)
  saveLocal()
  cloudWrite(c => c.from('tasks').insert(toDb(t)))
  return true
}

function toggleDone(id: string) {
  const t = tasks.value.find(t => t.id === id)
  if (!t) return
  t.done = !t.done
  t.completedAt = t.done ? Date.now() : null
  saveLocal()
  cloudWrite(c => c.from('tasks').update({ done: t.done, completed_at: t.completedAt ? new Date(t.completedAt).toISOString() : null }).eq('id', id))
}

function toggleStar(id: string) {
  const t = tasks.value.find(t => t.id === id)
  if (!t) return
  t.starred = !t.starred
  saveLocal()
  cloudWrite(c => c.from('tasks').update({ starred: t.starred }).eq('id', id))
}

function saveEdit(id: string, text: string) {
  const t = tasks.value.find(t => t.id === id)
  if (!t) return
  t.text = text
  saveLocal()
  cloudWrite(c => c.from('tasks').update({ text }).eq('id', id))
}

function removeTask(id: string) {
  const index = tasks.value.findIndex(t => t.id === id)
  if (index < 0) return
  const [task] = tasks.value.splice(index, 1)
  saveLocal()
  cloudWrite(c => c.from('tasks').delete().eq('id', id))

  // 撤销 Toast
  undoState = { task, index }
  toastText.value = `已删除「${task.text || '（无文本）'}」`
  toastVisible.value = true
  if (undoTimer) clearTimeout(undoTimer)
  undoTimer = setTimeout(hideToast, 5000)
}

function undoRemove() {
  if (!undoState) return
  const { task, index } = undoState
  tasks.value.splice(Math.min(index, tasks.value.length), 0, task)
  saveLocal()
  cloudWrite(c => c.from('tasks').insert(toDb(task)))
  hideToast()
}

function hideToast() {
  toastVisible.value = false
  undoState = null
}

function clearDone() {
  const removedIds = tasks.value.filter(t => t.done).map(t => t.id)
  if (!removedIds.length) return
  tasks.value = tasks.value.filter(t => !t.done)
  saveLocal()
  cloudWrite(c => c.from('tasks').delete().in('id', removedIds))
}

function reorder(dragId: string, targetId: string, before: boolean) {
  const from = tasks.value.findIndex(t => t.id === dragId)
  if (from < 0) return
  const [item] = tasks.value.splice(from, 1)
  let to = tasks.value.findIndex(t => t.id === targetId)
  if (to < 0) tasks.value.push(item)
  else {
    if (!before) to += 1
    tasks.value.splice(to, 0, item)
  }
  saveLocal()
  // 简单策略：顺序仅存本地（云端保留服务器排序），刷新后以云端顺序为准
}

export function useTasks() {
  return {
    // 状态
    tasks, view, search, mode, syncError, filtered, counts, progress, viewTitle,
    toastVisible, toastText,
    // 动作
    initTasks, setView, addTask, toggleDone, toggleStar, saveEdit,
    removeTask, undoRemove, hideToast, clearDone, reorder,
  }
}
