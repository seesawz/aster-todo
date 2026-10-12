<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import type { Task } from '~/utils/parse'

const props = defineProps<{ tasks: Task[] }>()

const { search, reorder } = useTasks()

// 项目内未搜索时可拖拽排序
const canDrag = computed(() => !search.value)
const composer = ref<{ focus: () => void } | null>(null)

defineExpose({ focus: () => composer.value?.focus() })

let dragId: string | null = null
let dropTarget: { id: string, before: boolean } | null = null
const draggingId = ref<string | null>(null)
const dropMark = ref<{ id: string, before: boolean } | null>(null)

function onDragStart(e: DragEvent) {
  if (!canDrag.value) return
  const id = (e.target as HTMLElement).closest<HTMLElement>('.task')?.dataset.id
  const task = props.tasks.find(t => t.id === id)
  if (!task) return
  dragId = task.id
  draggingId.value = task.id
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e: DragEvent) {
  if (!dragId) return
  const li = (e.target as HTMLElement).closest('.task') as HTMLElement | null
  dropMark.value = null
  dropTarget = null
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
  <ul
    class="task-list"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <AnimatePresence :initial="false">
      <motion.li v-if="props.tasks.length === 0" key="empty" class="task-list-empty" :initial="{ opacity: 0, height: 0 }" :animate="{ opacity: 1, height: 'auto' }" :exit="{ opacity: 0, height: 0, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }" :style="{ overflow: 'hidden' }">
        <slot name="empty" />
      </motion.li>
      <TaskItem
        v-for="t in props.tasks"
        :key="t.id"
        :task="t"
        :draggable="canDrag"
        :dragging="t.id === draggingId"
        :drop-mark="t.id === dropMark?.id ? dropMark.before : null"
      />
    </AnimatePresence>
    <motion.li layout="position" class="task-add-row">
      <TaskComposer ref="composer" />
    </motion.li>
  </ul>
</template>
