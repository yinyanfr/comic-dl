import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://yinyanfr.github.io',
  base: '/comic-dl',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'comic-dl',
      description: 'comic-dl 漫画下载器的使用、扩展开发和接口文档。',
      locales: {
        root: { label: '简体中文', lang: 'zh-CN' },
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/yinyanfr/comic-dl',
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/yinyanfr/comic-dl/edit/main/docs/',
      },
      sidebar: [
        {
          label: '使用指南',
          items: [
            'guide/quickstart',
            'guide/library',
            'guide/config-tutorial',
            'guide/copymanga',
            'guide/fixture',
            'guide/migration',
          ],
        },
        {
          label: '扩展开发',
          items: ['extensions/develop', 'extensions/zerobyw-walkthrough'],
        },
        {
          label: '项目开发',
          items: ['development/contributing'],
        },
        {
          label: '参考手册',
          items: ['reference/cli', 'reference/config'],
        },
        {
          label: '规范',
          items: ['specs/source-extension-v1', 'specs/config-v1'],
        },
      ],
    }),
  ],
});
