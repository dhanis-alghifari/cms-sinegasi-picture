import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Keep handwritten files focused. Generated UI primitives are allowed
      // to surface the warning until they are replaced or removed.
      'max-lines': [
        'warn',
        {
          max: 400,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      // Shared boundary violations are errors so reusable code stays independent
      // from app setup and business features.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/**'],
              message: 'shared tidak boleh bergantung pada app.',
            },
            {
              group: ['@/features/**'],
              message: 'shared tidak boleh bergantung pada feature tertentu.',
            },
          ],
        },
      ],
    },
  },
  {
    // Route modules intentionally export RouteObject arrays next to lazy page
    // elements. They are configuration modules, not Fast Refresh components.
    files: ['src/features/**/routes.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // These files are generated/shared UI primitives. Some also export their
    // cva variants or managers by design, so Fast Refresh's component-only
    // heuristic does not apply at this boundary.
    files: ['src/shared/ui/primitives/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
      'max-lines': 'off',
    },
  },
  {
    // Compound components intentionally export a root function with named
    // subcomponents. Fast Refresh cannot classify that static API reliably.
    files: ['src/features/contests/components/ContestAwardResultFields.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
);
