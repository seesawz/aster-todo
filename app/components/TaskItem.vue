<script setup lang="ts">
import type { Task } from '~/utils/parse'

const props = defineProps<{
  task: Task
  draggable: boolean
  dragging: boolean
  /** null = 无标记，true = 上方插入线，false = 下方插入线 */
  dropMark: boolean | null
}>()

const emit = defineEmits<{
  (e: 'dragstart', ev: DragEvent): void
  (e: 'dragend'): void
}>()

const { toggleDone, toggleStar, saveEdit, removeTask } = useTasks()

// ---- 双击行内编辑 ----
const editing = ref(false)
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

// ---- 截止日期徽标 ----
const dueInfo = computed(() => {
  if (!props.task.due) return null
  const diff = diffDays(props.task.due)
  const cls = props.task.done ? '' : diff < 0 ? 'overdue' : diff === 0 ? 'today' : ''
  const label = props.task.done
    ? dueLabel(props.task.due)
    : diff < 0 ? `${dueLabel(props.task.due)} 已逾期` : dueLabel(props.task.due)
  return { cls, label }
})

const doneStamp = computed(() =>
  props.task.done ? fmtStamp(props.task.completedAt || props.task.createdAt) : '',
)
</script>

<template>
  <li
    class="task"
    :class="{
      done: task.done,
      dragging,
      'drop-before': dropMark === true,
      'drop-after': dropMark === false,
    }"
    :data-id="task.id"
    :draggable="draggable"
    @dragstart="emit('dragstart', $event)"
    @dragend="emit('dragend')"
  >
    <input
      type="checkbox"
      class="check"
      :checked="task.done"
      :aria-label="task.done ? '标记为未完成' : '标记为已完成'"
      @change="toggleDone(task.id)"
    >

    <div class="task-content">
      <div class="task-main">
        <svg
          v-if="task.priority"
          class="flag" :class="'p' + task.priority"
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
        <span v-else class="task-text" title="双击编辑" @dblclick="startEdit">{{ task.text }}</span>

        <span v-for="tag in task.tags" :key="tag" class="tag-chip">#{{ tag }}</span>
      </div>

      <div v-if="dueInfo" class="task-meta">
        <span class="due-chip" :class="dueInfo.cls">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <rect x="4" y="5.5" width="16" height="15" rx="2.5" /><path d="M8 3.5v4M16 3.5v4M4 11h16" />
          </svg>
          {{ dueInfo.label }}
        </span>
      </div>
    </div>

    <div class="task-side">
      <span v-if="task.done" class="task-time" title="完成于">{{ doneStamp }}</span>

      <button
        class="task-action star" :class="{ on: task.starred }"
        :aria-label="task.starred ? '取消星标' : '加星标'"
        :title="task.starred ? '取消星标' : '星标'"
        @click="toggleStar(task.id)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
          <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
        </svg>
      </button>

      <button
        class="task-action delete"
        aria-label="删除任务"
        title="删除"
        @click="removeTask(task.id)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 7h16M10 11v6M14 11v6M6.5 7l1 12a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-12M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2" />
        </svg>
      </button>
    </div>
  </li>
</template>
