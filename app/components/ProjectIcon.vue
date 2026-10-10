<script setup lang="ts">
import { PROJECT_ICONS, type ProjectIconName } from '~/utils/projectIcons'
const props = defineProps<{ name: ProjectIconName }>()
const icon = computed(() => PROJECT_ICONS.find(icon => icon.id === props.name)!)
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-for="path in icon.paths" :key="path" :d="path" />
  </svg>
</template>
