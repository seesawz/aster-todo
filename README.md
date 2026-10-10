# Claude Todo ✳

以 [Claude Code 桌面端](https://claude.com/claude-code)设计风格打造的待办清单应用。

**技术栈：Nuxt 4（SPA 静态生成）+ Supabase（PostgreSQL）+ pnpm**，零自定义后端，可通过 GitHub Pages 免费托管。

## 功能模块

参考市面优秀待办应用（**Todoist** / **Things 3** / **Microsoft To Do**）提炼：

| 模块 | 参考对象 | 说明 |
|---|---|---|
| 🧠 智能输入解析 | Todoist | `明天 交房租 !! #生活` → 自动识别日期（今天/明天/后天/M月D日）、优先级（`!`~`!!!`）、标签，输入时实时预览 |
| 🚩 优先级 | Todoist P1–P3 | 红/橙/蓝三色旗帜，`今天`视图按日期 + 优先级排序 |
| 📅 截止日期 | Todoist / Apple Reminders | 今天橙色高亮、逾期红色标注 |
| ⭐ 星标 | Microsoft To Do | 独立「重要」视图 |
| 🗂 视图 | Things 3 | 今天 / 重要 / 全部 / 已完成，带计数徽标与专属空状态 |
| 🔍 搜索 / ⌨️ 快捷键 | 各家标配 | `/` 搜索、`N` 新任务、`Esc` 清空 |
| ↩️ 撤销 / ✏️ 双击编辑 / ↕️ 拖拽排序 | 各家标配 | 删除 Toast 5 秒可撤销；「全部」视图可拖拽 |
| 🌗 深浅色主题 | Claude Code 桌面端 | 跟随系统 + 手动切换记忆 |

## 数据库（Supabase）

- 数据表 `tasks`，行级安全（RLS）：无需登录 —— 每个浏览器生成随机 `owner` 标识，通过请求头 `x-owner-id` 传递，只能读写自己的数据
- 云端为主 + `localStorage` 缓存：未配置 Supabase 或云端不可达时自动降级本地模式（侧边栏底部有连接状态灯）
- 初始化：Supabase 控制台 → SQL Editor → 执行 [`supabase/schema.sql`](./supabase/schema.sql)

### 配置

本地开发：复制 `.env.example` 为 `.env`，填入项目 URL 与 publishable key：

```
NUXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NUXT_PUBLIC_SUPABASE_KEY=sb_publishable_xxx
```

部署：在 GitHub 仓库 **Settings → Secrets and variables → Actions** 配置同名 Secrets，构建时注入。

## 开发

```bash
pnpm install
pnpm dev        # 开发服务器
pnpm generate   # 静态生成到 .output/public
```

## 部署（GitHub Pages）

`.github/workflows/deploy.yml` 会在 push 到 main 时自动构建部署。首次使用需：

1. 仓库 **Settings → Pages** → Source 切换为 **GitHub Actions**
2. 配置上面的两个 Secrets

## 设计语言

暖奶油色背景 + 赤陶橙（`#D97757`）强调、衬线标题、发丝边框、对话式输入框，响应式适配移动端。

## Roadmap

- 子任务清单（Things 3 checklist）
- 循环任务（每天/每周）
- 多端数据冲突合并策略（当前为云端覆盖本地）
