# Claude Todo ✳

一个以 [Claude Code 桌面端](https://claude.com/claude-code)设计风格打造的待办清单网页应用。

纯静态实现（HTML / CSS / 原生 JS，零依赖、零构建），通过 GitHub Pages 免费部署。

## 功能模块设计

参考市面上优秀的待办应用（**Todoist**、**Things 3**、**Microsoft To Do**）提炼出的功能模块：

| 模块 | 参考对象 | 说明 |
|---|---|---|
| 🧠 智能输入解析 | Todoist 自然语言识别 | 输入 `明天 交房租 !! #生活`，自动识别**截止日期**（今天/明天/后天/10月12日）、**优先级**（`!`~`!!!`）、**标签**（`#xx`），输入框下方实时预览识别结果 |
| 🚩 优先级体系 | Todoist P1–P3 | 红 / 橙 / 蓝三色旗帜，`今天`视图内按日期 + 优先级排序 |
| 📅 截止日期 | Todoist / Apple Reminders | 今天橙色高亮，逾期红色标注「已逾期」，未来显示星期 |
| ⭐ 星标「重要」 | Microsoft To Do 重要列表 | 悬停任务出现星标按钮，独立的「重要」视图聚合 |
| 🗂 视图体系 | Things 3 | 侧边栏四大视图：**今天 / 重要 / 全部 / 已完成**，各带计数徽标与专属空状态文案 |
| 🔍 搜索 | 各家标配 | 按 `/` 快捷键聚焦，跨文本与标签全文搜索，防抖 120ms |
| ↩️ 删除撤销 | Todoist Toast | 删除后底部 Toast 保留 5 秒，一键撤销 |
| ✏️ 行内编辑 | Things 3 | 双击任务文本直接编辑，Enter 保存 / Esc 取消 |
| ↕️ 拖拽排序 | 各家标配 | 「全部」视图内拖拽调整顺序，带橙色位置指示线 |
| 📤 数据导出 | 各家标配 | 一键导出全部数据为 JSON 备份 |
| ⌨️ 快捷键 | 各家标配 | `N` 聚焦新任务输入框，`/` 聚焦搜索，`Esc` 清空搜索 |
| 🌗 深浅色主题 | Claude Code 桌面端 | 默认跟随系统，手动切换后记忆偏好 |

数据结构（含 v1 → v2 自动迁移）：

```js
{
  id: string,           // uuid
  text: string,         // 任务文本（已剥离解析标记）
  done: boolean,
  priority: 0|1|2|3,    // 0 无 / 1 高 / 2 中 / 3 低
  due: 'YYYY-MM-DD'|null,
  starred: boolean,
  tags: string[],
  createdAt: number,
  completedAt: number|null
}
```

## 设计语言

- 暖奶油色背景（`#FAF9F5`）+ 亚麻色侧边栏（`#F0EEE5`），Claude 赤陶橙强调色（`#D97757`）
- 衬线标题（Georgia）+ 等宽字体点缀，发丝边框与柔和圆角
- 对话式输入框（仿 Claude Code 聊天输入区，聚焦时橙色光环）
- 响应式适配移动端

## 本地运行

无需构建，直接打开 `index.html`，或：

```bash
npx serve .
```

## 部署

推送到 GitHub 后，在仓库 **Settings → Pages** 中选择 `main` 分支根目录即可。

## Roadmap

- 子任务 / 步骤清单（Things 3 checklist）
- 循环任务（每天/每周）
- ICS 日历订阅导出
