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
      logo: {
        src: '../assets/project-icon.png',
        alt: 'comic-dl',
      },
      favicon: '/favicon.png',
      locales: {
        root: { label: '简体中文', lang: 'zh-CN' },
        en: { label: 'English' },
        ja: { label: '日本語' },
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
          translations: { en: 'User guides', ja: '使い方' },
          items: [
            'guide/quickstart',
            'guide/basic',
            'guide/advanced',
            'guide/config-tutorial',
            'guide/library',
            'guide/service-api',
          ],
        },
        {
          label: '书架与自动追更',
          translations: {
            en: 'Shelf and automatic updates',
            ja: '本棚と自動更新',
          },
          items: ['shelf/manage', 'shelf/updates'],
        },
        {
          label: 'WebUI',
          items: ['webui/usage', 'webui/deployment'],
        },
        {
          label: 'Agent Skills',
          translations: { en: 'Agent Skills', ja: 'Agent Skills' },
          items: [
            'agent-skills',
            'agent-skills/cli',
            'agent-skills/library',
            'agent-skills/webui',
            'agent-skills/extensions',
            'agent-skills/core',
          ],
        },
        {
          label: '扩展开发',
          translations: { en: 'Extension development', ja: '拡張機能の開発' },
          items: ['extensions/develop', 'extensions/zerobyw-walkthrough'],
        },
        {
          label: '项目开发',
          translations: { en: 'Project development', ja: 'プロジェクト開発' },
          items: ['development/contributing', 'development/local-testing'],
        },
        {
          label: '参考手册',
          translations: { en: 'Reference', ja: 'リファレンス' },
          items: ['reference/cli', 'reference/config', 'reference/library-api'],
        },
        {
          label: '规范',
          translations: { en: 'Specifications', ja: '仕様' },
          items: ['specs/source-extension-v1', 'specs/config-v1'],
        },
        {
          label: '从旧版迁移',
          translations: { en: 'Migration', ja: '旧バージョンからの移行' },
          items: ['migration/v2-to-v3', 'migration/v3-to-v4'],
        },
      ],
    }),
  ],
});
