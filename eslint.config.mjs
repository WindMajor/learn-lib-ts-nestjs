// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'pnpm-lock.yaml'] },
  { files: ['**/*.{ts,tsx}'], languageOptions: { ecmaVersion: 2023, globals: globals.node } },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettier,
  { rules: { '@typescript-eslint/no-explicit-any': 'off', 'prettier/prettier': 'error' } },
);
