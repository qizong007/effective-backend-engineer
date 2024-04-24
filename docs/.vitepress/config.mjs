import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "卓有成效的后端工程师",
  description: "卓有成效的后端工程师。聚沙成塔，精益求精。Be An Effective Back- end Engineer。解决实际问题，问题出发，场景入手，不罗列知识点；提炼工程要点，取高频面试题和日常工作实践的最大交集；后端研发干货，干湿比高的宝贵服务端工程经验；文档完全免费，该文档免费开源，欢迎大家一起建设",
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
      { icon: 'github', link: 'https://github.com/qizong007/effective-backend-engineer' }
    ],

    footer: {
      message: '<a href="https://beian.miit.gov.cn">闽ICP备2020020906号-2</a>',
      copyright: 'Copyright © 2024-present <a href="https://github.com/qizong007">@王帅真</a>'
    }
  },
  cleanUrls: true,
  lastUpdated: true
})
