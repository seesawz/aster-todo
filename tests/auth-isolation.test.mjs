import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { loadGuestWorkspace } from '../app/utils/guestStorage.ts'
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { ref, computed } from 'vue'
import { parseInput } from '../app/utils/parse.ts'

const storage = new Map()
Object.assign(globalThis, {
  ref, computed, parseInput,
  useRuntimeConfig: () => ({ public: { supabaseUrl: 'https://example.supabase.co', supabaseKey: 'test' } }),
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
})
const { useTasks } = await import('../app/composables/useTasks.ts')
const state = useTasks()
const tick = () => new Promise(resolve => setTimeout(resolve, 10))
const row = (text, owner) => ({ id: crypto.randomUUID(), owner, user_id: owner, project_id: 'inbox', text, created_at: new Date().toISOString() })
function mockClient(rows = [], options = {}) {
  const calls = []
  return {
    calls,
    from(table) {
      const call = { table, filters: [] }
      calls.push(call)
      const query = {
        select() { call.action = 'select'; return query },
        order() { return query },
        eq(key, value) { call.filters.push([key, value]); return query },
        in(key, value) { call.filters.push([key, value]); return query },
        insert(data) { call.action = 'insert'; call.data = data; return query },
        upsert(data) { call.action = 'upsert'; call.data = data; return query },
        update(data) { call.action = 'update'; call.data = data; return query },
        delete() { call.action = 'delete'; return query },
        then(resolve, reject) {
          const result = call.action === 'select'
            ? options.read?.(table) ?? { data: table === 'tasks' ? rows : [], error: null }
            : options.write?.(call) ?? { data: null, error: null }
          return Promise.resolve(result).then(resolve, reject)
        },
      }
      return query
    },
  }
}

beforeEach(async () => { await loadGuestWorkspace().catch(() => {}); globalThis.indexedDB = new IDBFactory(); state.resetTasks(); storage.clear() })

test('登录前不加载访客缓存，不能新建待办或项目', async () => {
  storage.set('aster.tasks', JSON.stringify([{ text: '旧访客任务' }]))
  await state.initTasks()
  assert.equal(state.tasks.value.length, 0)
  assert.equal(state.addTask('不允许'), false)
  assert.equal(state.addProject('不允许'), false)
})

test('账号 A 和 B 分离缓存、项目、搜索和撤销状态；退出立即清空', async () => {
  const a = mockClient([row('A 的任务', 'A')])
  await state.initTasks(a, 'A')
  state.addProject('A 项目')
  state.search.value = '私人搜索'
  state.removeTask(state.tasks.value[0].id)
  assert.equal(state.toastVisible.value, true)
  const b = mockClient([row('B 的任务', 'B')])
  await state.initTasks(b, 'B')
  assert.equal(state.search.value, '')
  assert.equal(state.projectId.value, 'inbox')
  assert.equal(state.projects.value.length, 1)
  assert.equal(state.toastVisible.value, false)
  state.undoRemove()
  assert.deepEqual(state.tasks.value.map(t => t.text), ['B 的任务'])
  assert.ok(storage.has('aster.tasks.user.A'))
  assert.ok(storage.has('aster.tasks.user.B'))
  assert.equal(storage.has('aster.tasks'), false)
  state.resetTasks()
  assert.equal(state.tasks.value.length, 0)
  assert.equal(state.writable.value, false)
})

test('切换账号后忽略上个账号延迟返回的查询', async () => {
  let finish
  const delayed = new Promise(resolve => { finish = resolve })
  const loadingA = state.initTasks(mockClient([], { read: table => table === 'tasks' ? delayed : { data: [], error: null } }), 'A')
  await tick()
  await state.initTasks(mockClient([row('B', 'B')]), 'B')
  finish({ data: [row('A', 'A')], error: null })
  await loadingA
  assert.deepEqual(state.tasks.value.map(t => t.text), ['B'])
  assert.equal(storage.has('aster.tasks.user.A'), false)
})

test('当前账号网络失败只读取自己的缓存，不读取访客或其他账号数据', async () => {
  storage.set('aster.tasks', JSON.stringify([{ text: '访客' }]))
  storage.set('aster.tasks.user.A', JSON.stringify([{ text: 'A' }]))
  storage.set('aster.tasks.user.B', JSON.stringify([{ text: 'B' }]))
  await state.initTasks(mockClient([], { read: () => ({ error: { message: 'offline' } }) }), 'B')
  assert.deepEqual(state.tasks.value.map(t => t.text), ['B'])
  assert.equal(state.mode.value, 'error')
  assert.equal(state.addTask('离线编辑'), false)
})

test('写入携带认证用户 ID；更新、删除与批量清理带账号过滤', async () => {
  const c = mockClient()
  await state.initTasks(c, 'A')
  state.addTask('我的任务')
  const id = state.tasks.value[0].id
  state.toggleDone(id)
  state.clearDone()
  state.addProject('我的项目')
  state.renameProject(state.projectId.value, '重命名')
  await tick()
  for (const call of c.calls) {
    if (['insert', 'upsert'].includes(call.action)) {
      assert.equal(call.data.user_id, 'A')
      assert.equal(call.data.owner, 'A')
    } else assert.ok(call.filters.some(([k, v]) => k === 'user_id' && v === 'A'))
  }
})

test('上个账号的写入失败不会污染新账号状态', async () => {
  let finish
  const delayed = new Promise(resolve => { finish = resolve })
  await state.initTasks(mockClient([], { write: () => delayed }), 'A')
  state.addTask('A')
  await state.initTasks(mockClient(), 'B')
  finish({ error: { message: 'A failed' } })
  await tick()
  assert.equal(state.mode.value, 'cloud')
  assert.equal(state.syncError.value, null)
})

test('主动选择访客后任务和项目存入 IndexedDB，刷新保留，不写匿名云端或 localStorage', async () => {
  await state.initTasks(null, '', true)
  assert.equal(state.localOnly.value, true)
  state.addProject('访客项目')
  const projectId = state.projectId.value
  state.addTask('访客待办')
  state.toggleStar(state.tasks.value[0].id)
  await state.initTasks(null, '', true)
  assert.equal(state.currentProject.value.name, '访客项目')
  assert.equal(state.filtered.value[0].text, '访客待办')
  assert.equal(state.filtered.value[0].starred, true)
  assert.equal(state.filtered.value[0].projectId, projectId)
  assert.equal(storage.has('aster.tasks'), false)
  assert.equal(storage.has('aster.projects'), false)
  assert.equal((await loadGuestWorkspace()).tasks.length, 1)
})

test('访客与账号空间分离，切回访客恢复本地项目且不自动上传', async () => {
  await state.initTasks(null, '', true)
  state.addTask('访客秘密')
  state.addProject('访客项目')
  const c = mockClient([row('账号任务', 'A')])
  await state.initTasks(c, 'A')
  assert.deepEqual(state.tasks.value.map(t => t.text), ['账号任务'])
  assert.equal(state.projects.value.length, 1)
  assert.ok(c.calls.every(call => call.action === 'select'))
  await state.initTasks(null, '', true)
  assert.deepEqual(state.tasks.value.map(t => t.text), ['访客秘密'])
  assert.ok(state.projects.value.some(p => p.name === '访客项目'))
})

test('旧访客 localStorage 数据一次迁移，清空后的 IndexedDB 不重复导入旧任务', async () => {
  storage.set('aster.tasks', JSON.stringify([{ text: '旧访客任务' }]))
  storage.set('aster.projects', JSON.stringify([{ id: 'inbox', name: '旧收件箱' }]))
  await state.initTasks(null, '', true)
  assert.equal(state.tasks.value[0].text, '旧访客任务')
  assert.equal(state.currentProject.value.name, '旧收件箱')
  state.removeTask(state.tasks.value[0].id)
  await state.initTasks(null, '', true)
  assert.equal(state.tasks.value.length, 0)
})

test('IndexedDB 不可用时暂停访客编辑，不偷偷降级为 localStorage', async () => {
  globalThis.indexedDB = { open() { throw new Error('blocked') } }
  await state.initTasks(null, '', true)
  assert.equal(state.mode.value, 'error')
  assert.equal(state.loading.value, false)
  assert.equal(state.localOnly.value, true)
  assert.equal(state.addTask('无法保存'), false)
  assert.equal(storage.has('aster.tasks'), false)
})
