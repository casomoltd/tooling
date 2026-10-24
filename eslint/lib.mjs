import {HOUSE_RULES} from './house-rules.mjs';

/**
 * Creates a shared ESLint config for TypeScript libraries
 * (non-Next.js projects).
 *
 * Consumers must pass the resolved imports since this package
 * has no dependencies of its own.
 *
 * @param {{ config: Function }} tseslint - from "typescript-eslint"
 * @param {{ configs: { recommended: object } }} sonarjs
 *   - from "eslint-plugin-sonarjs"
 */
export function createLibConfig({tseslint, sonarjs}) {
  return tseslint.config(
    ...tseslint.configs.recommended,
    sonarjs.configs.recommended,
    {
      ignores: ['dist/**', 'node_modules/**'],
    },
    {
      files: ['**/*.cjs'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    HOUSE_RULES,
  );
}
