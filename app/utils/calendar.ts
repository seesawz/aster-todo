import { toDateStr } from './parse.ts'

export function dateFromString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// 周一起始，固定六周；相邻月份日期可选，切换月份时保持布局稳定。
export function monthDays(year: number, month: number) {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(year, month, index - offset + 1)
    return { date: toDateStr(day), day: day.getDate(), currentMonth: day.getMonth() === month }
  })
}
