<script setup lang="ts">
import { dateFromString, monthDays } from '~/utils/calendar'
import { addDaysStr, nextMondayStr, toDateStr } from '~/utils/parse'

const props = defineProps<{ value: string | null }>()
const emit = defineEmits<{ (e: 'select', date: string | null): void, (e: 'cancel'): void }>()
const panelEl = ref<HTMLElement | null>(null)
const today = new Date()
const todayDate = toDateStr(today)
const initial = props.value ? dateFromString(props.value) : today
const year = ref(initial.getFullYear())
const month = ref(initial.getMonth())
const focusedDate = ref(toDateStr(initial))
const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const monthLabel = computed(() => `${year.value}年 ${month.value + 1}月`)
const cells = computed(() => monthDays(year.value, month.value))
const weeks = computed(() => Array.from({ length: 6 }, (_, index) => cells.value.slice(index * 7, index * 7 + 7)))
const fullDate = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
const shortDate = (date: string) => { const d = dateFromString(date); return `${d.getMonth() + 1}/${d.getDate()}` }

const quickDates = [
  { label: '今天', date: addDaysStr(0), icon: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5' },
  { label: '明天', date: addDaysStr(1), icon: 'M4 12h16m-6-6 6 6-6 6' },
  { label: '周末', date: addDaysStr((6 - today.getDay() + 7) % 7), icon: 'M4 9V5h16v4M3 9h18v11H3ZM8 13h8' },
  { label: '下周一', date: nextMondayStr(), icon: 'M4 5h16v16H4ZM4 10h16M8 3v4m8-4v4m-8 8h8' },
]

function shiftMonth(delta: number) {
  const next = new Date(year.value, month.value + delta, 1)
  year.value = next.getFullYear()
  month.value = next.getMonth()
  focusedDate.value = toDateStr(next)
}

function focusDay() {
  panelEl.value?.querySelector<HTMLButtonElement>(`[data-date="${focusedDate.value}"]`)?.focus()
}

onMounted(focusDay)

async function moveFocus(event: KeyboardEvent, date: string) {
  const target = dateFromString(date)
  const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
  if (event.key in offsets) target.setDate(target.getDate() + offsets[event.key])
  else if (event.key === 'Home') target.setDate(target.getDate() - (target.getDay() + 6) % 7)
  else if (event.key === 'End') target.setDate(target.getDate() + 6 - (target.getDay() + 6) % 7)
  else return
  event.preventDefault()
  focusedDate.value = toDateStr(target)
  year.value = target.getFullYear()
  month.value = target.getMonth()
  await nextTick()
  focusDay()
}
</script>

<template>
  <div ref="panelEl" class="date-picker" @keydown.esc.stop.prevent="emit('cancel')">
    <div class="date-picker-heading">
      <span>选择到期日期</span>
      <button type="button" class="date-picker-close" aria-label="关闭日期选择" title="关闭（Esc）" @click="emit('cancel')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </div>
    <div class="date-picker-body">
      <div class="date-shortcuts" role="group" aria-label="快捷日期">
        <button v-for="option in quickDates" :key="option.label" type="button" class="date-shortcut" :class="{ 'bg-accent-soft text-accent-strong': value === option.date }" :aria-pressed="value === option.date" @click="emit('select', option.date)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="option.icon" /></svg>
          <span>{{ option.label }}</span>
          <span class="date-shortcut-value">{{ shortDate(option.date) }}</span>
        </button>
        <button type="button" class="date-shortcut date-no-date" :aria-pressed="value === null" @click="emit('select', null)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM5.5 5.5l13 13" /></svg>
          <span>无日期</span>
        </button>
      </div>
      <div class="date-calendar">
        <div class="date-calendar-heading">
          <span class="date-calendar-month" aria-live="polite">{{ monthLabel }}</span>
          <button type="button" class="date-calendar-nav" aria-label="上个月" @click="shiftMonth(-1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button>
          <button type="button" class="date-calendar-nav" aria-label="下个月" @click="shiftMonth(1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></button>
        </div>
        <div class="date-calendar-weekdays" aria-hidden="true"><span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span></div>
        <div role="grid" :aria-label="monthLabel">
          <div v-for="(week, index) in weeks" :key="index" role="row" class="date-calendar-week">
            <button
              v-for="cell in week"
              :key="cell.date"
              type="button"
              role="gridcell"
              class="date-calendar-day"
              :class="{ 'date-selected': cell.date === value, 'date-today': cell.date === todayDate && cell.date !== value, 'text-subtle opacity-55': !cell.currentMonth && cell.date !== value }"
              :data-date="cell.date"
              :tabindex="cell.date === focusedDate ? 0 : -1"
              :aria-label="fullDate.format(dateFromString(cell.date))"
              :aria-selected="cell.date === value"
              :aria-current="cell.date === todayDate ? 'date' : undefined"
              @focus="focusedDate = cell.date"
              @keydown="moveFocus($event, cell.date)"
              @click="emit('select', cell.date)"
            >{{ cell.day }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
