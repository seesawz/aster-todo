import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dateFromString, monthDays } from '../app/utils/calendar.ts'

test('六周月历以周一开始，闰年二月完整且没有重复日期', () => {
  const days = monthDays(2024, 1)
  assert.equal(days.length, 42)
  assert.equal(new Set(days.map(day => day.date)).size, 42)
  assert.equal(dateFromString(days[0].date).getDay(), 1)
  assert.equal(days.filter(day => day.currentMonth).length, 29)
  assert.ok(days.some(day => day.date === '2024-02-29' && day.currentMonth))
})

test('跨年月历正确区分前后月份，日期解析保持本地年月日', () => {
  const days = monthDays(2025, 0)
  assert.equal(days[0].date, '2024-12-30')
  assert.equal(days[0].currentMonth, false)
  assert.equal(days.filter(day => day.currentMonth).length, 31)
  const date = dateFromString('2025-01-01')
  assert.equal(date.getFullYear(), 2025)
  assert.equal(date.getMonth(), 0)
  assert.equal(date.getDate(), 1)
})
