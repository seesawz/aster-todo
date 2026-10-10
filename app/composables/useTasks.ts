// ============================================================
// 数据层：任务状态、视图过滤、增删改查
// 同步策略：配置了 Supabase → 云端为主 + localStorage 缓存；
//          未配置 / 云端失败 → 自动降级本地模式
// ============================================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Priority, Task } from '~/utils/parse'
import { isProjectIcon, type ProjectIconName } from '../utils/projectIcons.ts'

export interface Project { id: string, name: string, icon: ProjectIconName }
export type ConnMode = 'local' | 'cloud' | 'error'

const STORAGE_KEY = 'claude-todo.tasks'
const OWNER_KEY = 'claude-todo.owner'
const PROJECTS_KEY = 'claude-todo.projects'
const INBOX: Project = { id: 'inbox', name: '收件箱', icon: 'folder' }

// ---------- 模块级单例状态（所有组件共享） ----------
const tasks = ref<Task[]>([])
const projects = ref<Project[]>([{ ...INBOX }])
const projectId = ref(INBOX.id)
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
  project_id: string
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
    projectId: row.project_id || INBOX.id,
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
    project_id: t.projectId,
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
    const savedProjects = localStorage.getItem(PROJECTS_KEY)
    if (savedProjects) projects.value = JSON.parse(savedProjects).map(normalizeProject)
    ensureInbox()
  } catch { /* ignore */ }
}

function saveLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.value))
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects.value))
  } catch { /* ignore */ }
}

function normalize(t: Partial<Task>): Task {
  return {
    id: t.id || crypto.randomUUID(),
    projectId: t.projectId || INBOX.id,
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
    const [taskResult, projectResult] = await Promise.all([
      client.from('tasks').select('*').order('created_at', { ascending: false }),
      client.from('projects').select('id, name, icon').order('created_at'),
    ])
    if (taskResult.error) throw taskResult.error
    if (projectResult.error) throw projectResult.error
    // 云端数据覆盖本地缓存（云端为主）
    tasks.value = (taskResult.data as DbTask[]).map(fromDb)
    projects.value = (projectResult.data as Project[]).map(normalizeProject)
    ensureInbox()
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

// ---------- 项目与任务列表 ----------
function normalizeProject(project: Project): Project {
  return { ...project, icon: isProjectIcon(project.icon) ? project.icon : 'folder' }
}

function ensureInbox() {
  if (!projects.value.some(p => p.id === INBOX.id)) projects.value.unshift({ ...INBOX })
}

const currentProject = computed(() => projects.value.find(p => p.id === projectId.value)!)
const projectTasks = computed(() => tasks.value.filter(t => t.projectId === projectId.value))
const filtered = computed<Task[]>(() => {
  const q = search.value.trim().toLowerCase()
  return projectTasks.value.filter(t => !q || t.text.toLowerCase().includes(q)
    || t.tags.some(tag => tag.toLowerCase().includes(q)))
})
const counts = computed(() => Object.fromEntries(projects.value.map(p => [
  p.id, tasks.value.filter(t => t.projectId === p.id && !t.done).length,
])))
const completedCount = computed(() => projectTasks.value.filter(t => t.done).length)
const viewTitle = computed(() => currentProject.value.name)

function setProject(id: string) {
  projectId.value = id
  search.value = ''
}

function addProject(name: string, icon: ProjectIconName = 'folder'): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  const project = { id: crypto.randomUUID(), name: trimmed, icon }
  projects.value.push(project)
  setProject(project.id)
  saveLocal()
  cloudWrite(c => c.from('projects').insert({ ...project, owner: ownerId }))
  return true
}

function renameProject(id: string, name: string, icon?: ProjectIconName): boolean {
  const project = projects.value.find(p => p.id === id)
  const trimmed = name.trim()
  if (!project || !trimmed) return false
  project.name = trimmed
  if (icon) project.icon = icon
  saveLocal()
  cloudWrite(c => c.from('projects').upsert({ ...project, owner: ownerId }))
  return true
}

function moveTask(id: string, targetProjectId: string) {
  const task = tasks.value.find(t => t.id === id)
  if (!task || !projects.value.some(p => p.id === targetProjectId)) return
  task.projectId = targetProjectId
  saveLocal()
  cloudWrite(c => c.from('tasks').update({ project_id: targetProjectId }).eq('id', id))
}

// ---------- 操作 ----------
function addTask(raw: string): boolean {
  const p = parseInput(raw)
  if (!p.text && p.tags.length === 0) return false
  const t = normalize({ ...p, projectId: projectId.value, createdAt: Date.now() })
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
  const removedIds = projectTasks.value.filter(t => t.done).map(t => t.id)
  if (!removedIds.length) return
  tasks.value = tasks.value.filter(t => !removedIds.includes(t.id))
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
    tasks, projects, projectId, currentProject, search, filtered, counts, completedCount, viewTitle,
    toastVisible, toastText,
    // 动作
    initTasks, setProject, addProject, renameProject, moveTask, addTask, toggleDone, toggleStar, saveEdit,
    removeTask, undoRemove, hideToast, clearDone, reorder,
  }
}
