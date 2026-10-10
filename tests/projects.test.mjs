import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { ref, computed } from 'vue'
import { parseInput } from '../app/utils/parse.ts'

const storage = new Map()
Object.assign(globalThis, {
  ref, computed, parseInput,
  useRuntimeConfig: () => ({ public: { supabaseUrl: '', supabaseKey: '' } }),
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
})
const { useTasks } = await import('../app/composables/useTasks.ts')
const state = useTasks()

beforeEach(() => {
  storage.clear()
  state.tasks.value = []
  state.projects.value = [{ id: 'inbox', name: '收件箱', icon: 'folder' }]
  state.setProject('inbox')
})

test('旧任务归入收件箱，保留完成状态和记录日期', async () => {
  storage.set('aster.tasks', JSON.stringify([
    { id: 'old', text: '旧任务', due: '2020-01-01', done: true },
  ]))
  await state.initTasks()
  assert.equal(state.tasks.value[0].projectId, 'inbox')
  assert.equal(state.filtered.value[0].due, '2020-01-01')
  assert.equal(state.filtered.value[0].done, true)
})

test('任务按项目显示，过去和未来日期不影响可见性', () => {
  state.addTask('收件箱任务')
  state.addProject('工作')
  const workId = state.projectId.value
  state.addTask('工作任务')
  state.tasks.value[0].due = '2099-01-01'
  state.addTask('过去日期任务')
  state.tasks.value[0].due = '2000-01-01'
  assert.deepEqual(state.filtered.value.map(t => t.text), ['过去日期任务', '工作任务'])
  state.toggleDone(state.tasks.value[0].id)
  assert.equal(state.filtered.value.length, 2)
  assert.equal(state.counts.value[workId], 1)
  state.setProject('inbox')
  assert.deepEqual(state.filtered.value.map(t => t.text), ['收件箱任务'])
})

test('重命名、移动任务与项目归属在刷新后保留', async () => {
  state.addTask('需要移动')
  const taskId = state.tasks.value[0].id
  state.addProject('项目一')
  const projectId = state.projectId.value
  state.renameProject(projectId, '项目二')
  state.moveTask(taskId, projectId)
  state.tasks.value = []
  state.projects.value = []
  await state.initTasks()
  assert.equal(state.currentProject.value.name, '项目二')
  assert.equal(state.filtered.value[0].id, taskId)
  assert.equal(state.counts.value.inbox, 0)
})

test('搜索限定当前项目，清除已完成不会删除其他项目任务', () => {
  state.addTask('相同任务')
  const inboxTaskId = state.tasks.value[0].id
  state.toggleDone(inboxTaskId)
  state.addProject('工作')
  state.addTask('相同任务')
  const workTaskId = state.tasks.value[0].id
  state.search.value = '相同'
  assert.deepEqual(state.filtered.value.map(t => t.id), [workTaskId])
  state.toggleDone(workTaskId)
  state.clearDone()
  assert.deepEqual(state.tasks.value.map(t => t.id), [inboxTaskId])
})

test('记录过去日期时保留当年，不按截止日期顺延到明年', () => {
  const parsed = parseInput('记录 1/1')
  assert.equal(parsed.due, `${new Date().getFullYear()}-01-01`)
  assert.equal(parsed.text, '记录')
})


test('项目图标可选择、修改并在刷新后保留', async () => {
  state.addProject('工作', 'briefcase')
  const projectId = state.projectId.value
  assert.equal(state.currentProject.value.icon, 'briefcase')
  state.renameProject(projectId, '开发', 'code')
  state.renameProject(projectId, '开发计划')
  state.projects.value = []
  await state.initTasks()
  assert.equal(state.currentProject.value.icon, 'code')
  assert.equal(state.currentProject.value.name, '开发计划')
})

test('旧项目没有图标时使用文件夹，不改变任务归属', async () => {
  storage.set('aster.projects', JSON.stringify([{ id: 'inbox', name: '收件箱' }]))
  await state.initTasks()
  assert.equal(state.currentProject.value.icon, 'folder')
  state.addTask('已有项目的任务')
  assert.equal(state.filtered.value.length, 1)
})
