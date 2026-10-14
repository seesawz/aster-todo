/** One atomic snapshot for the visitor workspace; account caches stay separate. */
export interface GuestWorkspace { tasks: unknown[], projects: unknown[], lastProjectId?: string }
const DATABASE = 'aster-todo'
const STORE = 'workspaces'
const GUEST = 'guest'
let writes: Promise<void> = Promise.resolve()

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('本地数据库暂时不可用，请关闭其他标签页后重试。'))
  })
}

async function readSnapshot(): Promise<GuestWorkspace | undefined> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).get(GUEST)
    tx.oncomplete = () => { db.close(); resolve(request.result) }
    tx.onabort = () => { db.close(); reject(tx.error) }
    tx.onerror = () => { /* onabort handles transaction errors */ }
  })
}

async function writeSnapshot(snapshot: GuestWorkspace): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(snapshot, GUEST)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onabort = () => { db.close(); reject(tx.error) }
    tx.onerror = () => { /* onabort handles transaction errors */ }
  })
}

export async function loadGuestWorkspace() {
  await writes
  return readSnapshot()
}

export function saveGuestWorkspace(snapshot: GuestWorkspace) {
  // Copy before queuing: later edits/account changes must not change this write.
  const copy: GuestWorkspace = JSON.parse(JSON.stringify(snapshot))
  const result = writes.then(() => writeSnapshot(copy))
  writes = result.catch(() => {})
  return result
}
