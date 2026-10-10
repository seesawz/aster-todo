<script setup lang="ts">
const { addTask } = useTasks()

const input = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const sendDisabled = computed(() => input.value.trim().length === 0)

// 实时智能解析预览（Todoist 风格）
const hintParts = computed(() => {
  const raw = input.value.trim()
  if (!raw) return []
  const p = parseInput(raw)
  const parts: string[] = []
  if (p.due) parts.push(`📅 ${dueLabel(p.due)}`)
  if (p.priority) parts.push(`${'!'.repeat(4 - p.priority)} ${['', 'P1 高', 'P2 中', 'P3 低'][p.priority]}优先级`)
  for (const tag of p.tags) parts.push(`#${tag}`)
  return parts
})

function submit() {
  if (!addTask(input.value)) return
  input.value = ''
}

function focus() {
  inputEl.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <form class="composer" @submit.prevent="submit">
    <div class="composer-row">
      <input
        ref="inputEl"
        v-model="input"
        type="text"
        placeholder="添加任务，试试：明天 交房租 !! #生活"
        autocomplete="off"
        maxlength="300"
      >
      <button type="submit" class="send-btn" :disabled="sendDisabled" aria-label="添加任务">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
        </svg>
      </button>
    </div>
    <div v-if="hintParts.length" class="composer-hint">
      <span class="hint-label">识别到</span>
      <span v-for="part in hintParts" :key="part" class="hint-chip">{{ part }}</span>
    </div>
  </form>
</template>
