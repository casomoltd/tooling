# @casomo/tooling

Shared linting, formatting, and commit config for Casomo sites.

## What's included

| Export | Description |
|---|---|
| `@casomo/tooling/eslint` | `createBaseConfig()` — ESLint flat config with Next.js, TypeScript, and SonarJS |
| `@casomo/tooling/prettier` | Prettier config object |
| `@casomo/tooling/commitlint` | commitlint config with `no-ai-attribution` plugin |

## How it's consumed

Sites reference this package as a `file:` devDependency:

```json
"devDependencies": {
  "@casomo/tooling": "file:../tooling"
}
```

The `file:` path resolves at `npm install` time on the local machine. This
is fine because all linting, typechecking, and spell-checking runs locally
before committing — there is no CI pipeline for these checks yet.

Vercel builds only install production `dependencies`, so `devDependencies`
(including this package) are skipped during remote builds. If CI-based
linting is added later, this package would need to be published to a
registry or the CI runner would need access to the monorepo layout.

## No dependencies

This package has no `dependencies` of its own. ESLint plugins and other
tools are installed by each consuming site. The ESLint config uses a
factory function (`createBaseConfig`) that receives resolved imports from
the consumer to avoid module resolution issues.
