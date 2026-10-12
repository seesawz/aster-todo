<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import { PROJECT_ICONS, type ProjectIconName } from '~/utils/projectIcons'
const props = defineProps<{ mode: 'create' | 'rename', name?: string, icon?: ProjectIconName, openIcons?: boolean }>()
const emit = defineEmits<{ (e: 'save', name: string, icon: ProjectIconName): void, (e: 'cancel'): void }>()
const name = ref(props.name || '')
const icon = ref<ProjectIconName>(props.icon || 'folder')
const iconsVisible = ref(!!props.openIcons)
const iconButton = ref<HTMLButtonElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)

onMounted(() => {
  inputEl.value?.focus()
  inputEl.value?.setSelectionRange(name.value.length, name.value.length)
})

function submit() {
  if (name.value.trim()) emit('save', name.value.trim(), icon.value)
}

async function chooseIcon(value: ProjectIconName) {
  icon.value = value
  iconsVisible.value = false
  await nextTick()
  inputEl.value?.focus()
}

function onEscape() {
  if (iconsVisible.value) {
    iconsVisible.value = false
    iconButton.value?.focus()
  } else emit('cancel')
}
</script>

<template>
  <form class="project-editor" :aria-label="mode === 'create' ? '新建项目' : '重命名项目'" @submit.prevent="submit" @keydown.esc.stop.prevent="onEscape" @keydown.stop>
    <div class="project-editor-row">
      <button ref="iconButton" type="button" class="editor-icon-button" aria-label="选择项目图标" :aria-expanded="iconsVisible" title="选择项目图标" @click="iconsVisible = !iconsVisible">
        <ProjectIcon :name="icon" />
      </button>
      <input ref="inputEl" v-model="name" class="project-name-input" aria-label="项目名称" placeholder="项目名称" autocomplete="off" maxlength="60" required>
      <button type="submit" class="editor-action project-editor-save" :disabled="!name.trim()" :aria-label="mode === 'create' ? '创建项目' : '保存名称'" :title="mode === 'create' ? '创建项目（Enter）' : '保存名称（Enter）'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7" /></svg>
      </button>
      <button type="button" class="editor-action editor-cancel" aria-label="取消编辑项目" title="取消（Esc）" @click="emit('cancel')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </div>
    <AnimatePresence>
      <motion.div v-if="iconsVisible" key="icons" class="project-icon-picker" role="group" aria-label="项目图标选项" :initial="{ opacity: 0, height: 0 }" :animate="{ opacity: 1, height: 'auto' }" :exit="{ opacity: 0, height: 0, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }">
        <button v-for="option in PROJECT_ICONS" :key="option.id" type="button" class="project-icon-option" :class="{ 'bg-accent-soft text-accent-strong': icon === option.id }" :aria-label="option.label" :aria-pressed="icon === option.id" :title="option.label" @click="chooseIcon(option.id)">
          <ProjectIcon :name="option.id" />
        </button>
      </motion.div>
    </AnimatePresence>
  </form>
</template>
