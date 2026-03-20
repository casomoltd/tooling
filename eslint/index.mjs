/**
 * Creates the shared ESLint base config.
 *
 * Consumers must pass the resolved imports since this package
 * has no dependencies of its own.
 *
 * @param {{ defineConfig, globalIgnores }} eslintConfig - from "eslint/config"
 * @param {Array} nextVitals - from "eslint-config-next/core-web-vitals"
 * @param {Array} nextTs - from "eslint-config-next/typescript"
 * @param {{ configs: { recommended: object } }} sonarjs - from "eslint-plugin-sonarjs"
 */
export function createBaseConfig({
  defineConfig,
  globalIgnores,
  nextVitals,
  nextTs,
  sonarjs,
}) {
  return defineConfig([
    ...nextVitals,
    ...nextTs,
    sonarjs.configs.recommended,
    globalIgnores([
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      ".prettierrc.js",
    ]),
    {
      files: ["**/*.cjs"],
      rules: {
        "@typescript-eslint/no-require-imports": "off",
      },
    },
    {
      rules: {
        "max-len": [
          "error",
          {
            code: 88,
            ignoreUrls: true,
            ignoreStrings: true,
            ignoreTemplateLiterals: true,
            ignoreRegExpLiterals: true,
          },
        ],
      },
    },
  ]);
}
