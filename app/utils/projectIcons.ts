export const PROJECT_ICONS = [
  { id: 'folder', label: '文件夹', paths: ['M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z'] },
  { id: 'briefcase', label: '工作', paths: ['M9 6V4h6v2M3 6h18v14H3Z', 'M3 11a20 20 0 0 0 18 0M10 12h4'] },
  { id: 'home', label: '生活', paths: ['m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8'] },
  { id: 'code', label: '开发', paths: ['m8 6-6 6 6 6m8-12 6 6-6 6M14 4l-4 16'] },
  { id: 'book', label: '学习', paths: ['M12 5v16M3 4c4-1 6-1 9 1 3-2 5-2 9-1v16c-4-1-6-1-9 1-3-2-5-2-9-1Z'] },
  { id: 'bulb', label: '灵感', paths: ['M9 18h6M10 21h4M8 15a7 7 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z'] },
  { id: 'heart', label: '兴趣', paths: ['M12 21 3 12C-2 5 7 0 12 6 17 0 26 5 21 12Z'] },
  { id: 'target', label: '目标', paths: ['M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z', 'M17 12a5 5 0 1 1-5-5 5 5 0 0 1 5 5Z', 'M13 12a1 1 0 1 1-1-1 1 1 0 0 1 1 1Z'] },
] as const

export type ProjectIconName = typeof PROJECT_ICONS[number]['id']

export function isProjectIcon(value: unknown): value is ProjectIconName {
  return PROJECT_ICONS.some(icon => icon.id === value)
}
