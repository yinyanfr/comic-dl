import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/dist/', '.husky/_/', 'docs/.astro/']),
  js.configs.recommended,
  {
    files: ['docs/src/**/*.ts'],
    extends: [tseslint.configs.recommended],
  },
  {
    files: ['src/**/*.ts', 'extensions/*/src/**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  prettier,
);
