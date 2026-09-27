import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    // The SDK must run on any fetch-capable runtime: no Node-only globals.
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Buffer', message: 'Use Uint8Array; the SDK must run outside Node.' },
        { name: 'process', message: 'The SDK must run outside Node.' },
        { name: 'require', message: 'Use ESM imports.' },
      ],
    },
  },
  {
    files: ['tests/**/*.ts', 'examples/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
