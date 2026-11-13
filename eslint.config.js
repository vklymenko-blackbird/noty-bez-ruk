import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'public', 'node_modules', 'test-results', 'playwright-report', '.factory'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'innerHTML is blocked by the security rules.' },
        { property: 'outerHTML', message: 'outerHTML is blocked by the security rules.' },
        { property: 'insertAdjacentHTML', message: 'insertAdjacentHTML is blocked by the security rules.' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'dangerouslySetInnerHTML is blocked.' },
      ],
      'no-eval': 'error',
      'no-new-func': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  { files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'], languageOptions: { globals: { ...globals.browser } } },
  {
    files: ['scripts/**', '*.config.{js,ts}', 'e2e/**', 'tests/**'],
    languageOptions: { globals: { ...globals.node } },
  },
);
