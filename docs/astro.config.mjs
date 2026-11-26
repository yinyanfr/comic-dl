import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

const base = '/comic-dl';

export default defineConfig({
  site: 'https://yinyanfr.github.io',
  base,
  trailingSlash: 'always',
  redirects: {
    '/guide/copymanga/': `${base}/guide/basic/`,
    '/guide/fixture/': `${base}/development/local-testing/`,
    '/guide/migration/': `${base}/migration/v2-to-v3/`,
  },
  integrations: [
    starlight({
      title: 'comic-dl',
      locales: {
        root: { label: '简体中文', lang: 'zh-CN' },
        en: { label: 'English' },
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
          translations: { en: 'User guides' },
          items: [
            'guide/quickstart',
            'guide/basic',
            'guide/advanced',
            'guide/config-tutorial',
            'guide/library',
          ],
        },
        {
          label: '扩展开发',
          translations: { en: 'Extension development' },
          items: ['extensions/develop', 'extensions/zerobyw-walkthrough'],
        },
        {
          label: '项目开发',
          translations: { en: 'Project development' },
          items: ['development/contributing', 'development/local-testing'],
        },
        {
          label: '参考手册',
          translations: { en: 'Reference' },
          items: ['reference/cli', 'reference/config'],
        },
        {
          label: '规范',
          translations: { en: 'Specifications' },
          items: ['specs/source-extension-v1', 'specs/config-v1'],
        },
        {
          label: '从旧版迁移',
          translations: { en: 'Migration' },
          items: ['migration/v2-to-v3'],
        },
      ],
    }),
  ],
});
