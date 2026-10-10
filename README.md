# Claude Todo ✳

一个以 [Claude Code 桌面端](https://claude.com/claude-code)设计风格打造的待办清单网页应用。

纯静态实现（HTML / CSS / 原生 JS，零依赖、零构建），通过 GitHub Pages 免费部署。

## 特性

- ✨ **Claude Code 桌面端设计语言**：暖奶油色背景、赤陶橙（`#D97757`）强调色、衬线标题、发丝边框与柔和圆角
- 🌗 **深浅色主题**：默认跟随系统，可手动切换并记忆
- ✅ 添加 / 完成 / 删除任务，支持筛选（全部 / 进行中 / 已完成）
- 📊 侧边栏实时进度条与计数徽标
- 💾 数据通过 `localStorage` 保存在本地浏览器
- ⌨️ 回车快速添加，响应式适配移动端

## 本地运行

无需构建，直接打开 `index.html`，或：

```bash
npx serve .
```

## 部署

推送到 GitHub 后，在仓库 **Settings → Pages** 中选择 `main` 分支根目录即可。
