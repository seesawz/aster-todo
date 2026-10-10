<script setup lang="ts">
import type { Task } from '~/utils/parse'

const props = defineProps<{ tasks: Task[] }>()

const { view, search, reorder } = useTasks()

// 拖拽排序仅在「全部」视图且未搜索时可用
const canDrag = computed(() => view.value === 'all' && !search.value)

let dragId: string | null = null
let dropTarget: { id: string, before: boolean } | null = null
const draggingId = ref<string | null>(null)
const dropMark = ref<{ id: string, before: boolean } | null>(null)

function onDragStart(e: DragEvent, task: Task) {
  if (!canDrag.value) return
  dragId = task.id
  draggingId.value = task.id
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e: DragEvent) {
  if (!dragId) return
  const li = (e.target as HTMLElement).closest('.task') as HTMLElement | null
  dropMark.value = null
  if (!li || li.dataset.id === dragId) return
  const r = li.getBoundingClientRect()
  const before = e.clientY < r.top + r.height / 2
  dropMark.value = { id: li.dataset.id!, before }
  dropTarget = dropMark.value
}

function onDrop(e: DragEvent) {
  if (dragId && dropTarget) reorder(dragId, dropTarget.id, dropTarget.before)
}

function onDragEnd() {
  dragId = null
  dropTarget = null
  draggingId.value = null
  dropMark.value = null
}
</script>

<template>
  <TransitionGroup
    tag="ul"
    name="task"
    class="task-list"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <TaskItem
      v-for="t in props.tasks"
      :key="t.id"
      :task="t"
      :draggable="canDrag"
      :dragging="t.id === draggingId"
      :drop-mark="t.id === dropMark?.id ? dropMark.before : null"
      @dragstart="onDragStart($event, t)"
      @dragend="onDragEnd"
    />
  </TransitionGroup>
</template>
