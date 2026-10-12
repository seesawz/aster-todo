<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
const { addTask, currentProject } = useTasks()

const input = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const canSubmit = computed(() => input.value.trim().length > 0)

// 实时智能解析预览（Todoist 风格）
const hintParts = computed(() => {
  const raw = input.value.trim()
  if (!raw) return []
  const p = parseInput(raw)
  const parts: string[] = []
  if (p.due) parts.push(`📅 到期 ${p.due}`)
  if (p.priority) parts.push(`${'!'.repeat(4 - p.priority)} ${['', 'P1 高', 'P2 中', 'P3 低'][p.priority]}优先级`)
  for (const tag of p.tags) parts.push(`#${tag}`)
  return parts
})

// refocus：Enter 提交后保持输入框聚焦以便连续添加；失焦提交时不抢回焦点
function submit(refocus = true) {
  if (!addTask(input.value)) return
  input.value = ''
  if (refocus) inputEl.value?.focus()
}

function focus() {
  inputEl.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <form class="composer group/composer" @submit.prevent="submit(true)">
    <div class="composer-row">
      <input
        class="composer-input"
        ref="inputEl"
        v-model="input"
        type="text"
        placeholder="添加任务…"
        :aria-label="`添加任务到${currentProject.name}`"
        autocomplete="off"
        maxlength="300"
        @blur="submit(false)"
      >
      <kbd v-if="!canSubmit" class="composer-key" aria-hidden="true">Enter</kbd>
    </div>
    <AnimatePresence>
      <motion.div v-if="hintParts.length" key="hints" class="composer-hint" :initial="{ opacity: 0, height: 0 }" :animate="{ opacity: 1, height: 'auto' }" :exit="{ opacity: 0, height: 0, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }" :style="{ overflow: 'hidden' }">
        <span class="hint-label">识别到</span>
        <span v-for="part in hintParts" :key="part" class="hint-chip">{{ part }}</span>
      </motion.div>
    </AnimatePresence>
  </form>
</template>
