// Nuxt 配置：SPA 模式 + 静态生成，适配 GitHub Pages 子路径托管
export default defineNuxtConfig({
  compatibilityDate: '2026-10-10',

  // 纯客户端应用：数据在 localStorage / Supabase，无需服务端渲染
  ssr: false,

  app: {
    // GitHub 项目页托管在仓库子路径下
    baseURL: '/aster-todo/',
    head: {
      title: 'Aster — 待办清单',
      htmlAttrs: { lang: 'zh-CN' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: '简洁的待办清单应用，轻松管理每日任务' },
      ],
      link: [{
        rel: 'icon',
        href: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='%23D97757'%20stroke-width='2.4'%20stroke-linecap='round'%3E%3Cpath%20d='M12%202.5v5.5M12%2016v5.5M2.5%2012H8M16%2012h5.5M5.3%205.3l3.9%203.9M14.8%2014.8l3.9%203.9M18.7%205.3l-3.9%203.9M9.2%2014.8l-3.9%203.9'/%3E%3C/svg%3E",
      }],
    },
    spaLoadingTemplate: 'app/spa-loading-template.html',
  },

  modules: ['@unocss/nuxt'],

  // Supabase 连接信息由环境变量注入（构建时烘焙进静态产物）
  runtimeConfig: {
    public: {
      supabaseUrl: '',
      supabaseKey: '',
    },
  },
})
