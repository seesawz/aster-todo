<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import type { Task } from '~/utils/parse'

const props = defineProps<{
  task: Task
  draggable: boolean
  dragging: boolean
  /** null = 无标记，true = 上方插入线，false = 下方插入线 */
  dropMark: boolean | null
}>()

const { projects, moveTask, toggleDone, toggleStar, saveEdit, removeTask } = useTasks()

// ---- 双击行内编辑 ----
const editing = ref(false)
const detailsVisible = ref(false)
const editText = ref('')
const editEl = ref<HTMLInputElement | null>(null)

function startEdit() {
  editText.value = props.task.text
  editing.value = true
  nextTick(() => {
    editEl.value?.focus()
    editEl.value?.setSelectionRange(editText.value.length, editText.value.length)
  })
}

function finishEdit(save: boolean) {
  if (!editing.value) return
  editing.value = false
  const val = editText.value.trim()
  if (save && val) saveEdit(props.task.id, val)
}

function onProjectChange(e: Event) {
  moveTask(props.task.id, (e.target as HTMLSelectElement).value)
}

const recordStamp = computed(() => fmtStamp(props.task.done ? props.task.completedAt || props.task.createdAt : props.task.createdAt))
</script>

<template>
  <motion.li
    layout="position"
    :initial="{ opacity: 0, y: 6 }"
    :animate="{ opacity: dragging ? 0.35 : 1, y: 0 }"
    :exit="{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, borderBottomWidth: 0, pointerEvents: 'none' }"
    :style="{ overflow: 'hidden' }"
    class="task group/task"
    :data-id="task.id"
    :draggable="draggable"
  >
    <span v-if="dropMark !== null" class="drop-indicator" :class="dropMark ? 'top-[-1px]' : 'bottom-[-1px]'" />
    <span class="task-check">
      <motion.input
        :while-press="{ scale: 0.9 }"
        type="checkbox"
        class="check"
        :checked="task.done"
        :aria-label="task.done ? '标记为未完成' : '标记为已完成'"
        @change="toggleDone(task.id)"
      />
      <svg v-if="task.done" class="check-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4.5 12.5 5 5 10-11" /></svg>
    </span>

    <div class="task-content">
      <div class="task-main">
        <svg
          v-if="task.priority"
          class="flag" :class="{ 'text-p1': task.priority === 1, 'text-p2': task.priority === 2, 'text-p3': task.priority === 3 }"
          viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          :aria-label="`P${task.priority} 优先级`"
        >
          <path d="M6 21V4" />
          <path d="M6 4.5c1.8-1.2 3.7-1.2 5.5 0s3.7 1.2 5.5 0V13c-1.8 1.2-3.7 1.2-5.5 0s-3.7-1.2-5.5 0" />
        </svg>

        <input
          v-if="editing"
          ref="editEl"
          v-model="editText"
          class="edit-input"
          maxlength="300"
          @keydown.enter="finishEdit(true)"
          @keydown.escape="finishEdit(false)"
          @blur="finishEdit(true)"
        >
        <span v-else class="task-text" :class="{ 'text-subtle line-through decoration-subtle decoration-1': task.done }" title="双击编辑" role="button" tabindex="0" @dblclick="startEdit" @keydown.enter.prevent="startEdit">{{ task.text }}</span>
        <time class="task-stamp" :title="`${task.done ? '完成于' : '创建于'} ${recordStamp}`">{{ recordStamp.slice(5, 10) }}</time>

      </div>
      <div v-if="task.tags.length || task.due" class="task-meta">
        <span v-for="tag in task.tags" :key="tag" class="tag-chip">#{{ tag }}</span>
        <span v-if="task.due" class="due-chip" title="记录日期">{{ task.due }}</span>
      </div>
    </div>

    <div class="task-side">
      <motion.button
        :while-press="{ scale: 0.9 }"
        class="task-action hover:text-gold" :class="{ 'opacity-100 text-gold [&_svg]:fill-current': task.starred }"
        :aria-label="task.starred ? '取消星标' : '加星标'"
        :title="task.starred ? '取消星标' : '星标'"
        @click="toggleStar(task.id)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
          <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
        </svg>
      </motion.button>

      <motion.button
        :while-press="{ scale: 0.9 }"
        class="task-action" :class="{ 'opacity-100 bg-hover': detailsVisible }"
        aria-label="任务详情与操作"
        :aria-expanded="detailsVisible"
        :aria-controls="`task-details-${task.id}`"
        title="任务详情与操作"
        @click="detailsVisible = !detailsVisible"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
      </motion.button>
    </div>
    <AnimatePresence>
      <motion.div
        v-if="detailsVisible"
        :id="`task-details-${task.id}`"
        key="details"
        class="task-details"
        :initial="{ opacity: 0, height: 0 }"
        :animate="{ opacity: 1, height: 'auto' }"
        :exit="{ opacity: 0, height: 0 }"
      >
        <div class="task-details-content">
          <div class="task-record"><span>创建时间</span><time>{{ fmtStamp(task.createdAt) }}</time></div>
          <div v-if="task.done" class="task-record mt-6px"><span>完成时间</span><time>{{ recordStamp }}</time></div>
          <div class="task-detail-actions">
            <label v-if="projects.length > 1" class="task-project-label">
              移至
              <select class="task-project" aria-label="移动任务到项目" :value="task.projectId" @change="onProjectChange">
                <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option>
              </select>
            </label>
            <button type="button" class="task-delete" aria-label="删除任务" title="删除任务" @click="removeTask(task.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 7h16M10 11v6M14 11v6M6.5 7l1 12a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-12M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2" />
              </svg>
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  </motion.li>
</template>
