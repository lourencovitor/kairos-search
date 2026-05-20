import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'src/job-research-agent/web/client/dist/**'],
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'test-fixtures/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
  // Orquestrador principal — complexidade inerente ao coordenar 12 fontes + pipeline completo
  {
    files: ['src/job-research-agent/index.ts'],
    rules: { 'max-lines': ['warn', { max: 900, skipBlankLines: true, skipComments: true }] },
  },
  // Arquivo de configuração central — cresce naturalmente com cada nova fonte/site
  {
    files: ['src/job-research-agent/config/job-research.config.ts'],
    rules: { 'max-lines': ['warn', { max: 700, skipBlankLines: true, skipComments: true }] },
  },
  // React SPA root — concentra estado global, layout e múltiplos providers
  {
    files: ['src/job-research-agent/web/client/src/App.tsx'],
    rules: { 'max-lines': ['warn', { max: 600, skipBlankLines: true, skipComments: true }] },
  },
  // Suítes de teste — longas por design para cobrir todos os casos do pipeline
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: { 'max-lines': ['warn', { max: 900, skipBlankLines: true, skipComments: true }] },
  },
];
