import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "卓有成效的后端工程师",
  description: "A VitePress Site",
  themeConfig: {
    logo: "/icon.png",

    nav: [
      { text: '主页', link: '/' },
      { text: '系统设计', link: '/system-design/mysql-sync-es' }
    ],

    sidebar: [
      {
        text: '系统设计',
        items: [
          { text: '4种方法MySQL同步ES', link: '/system-design/mysql-sync-es' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ]
  },
  cleanUrls: true,
  lastUpdated: true
})
