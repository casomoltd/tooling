/**
 * `@casomoltd/tooling/hooks/shapes`: the command shapes the guards match on
 * their exact form, for a consuming repo's own hook to import rather than
 * re-spell. The code lives in command-shapes.mjs, where the typecheck reads
 * it; beside shapes.d.mts, TypeScript would skip it.
 */
export {
  COMMIT_FORM,
  isSweepCommand,
  matchCommitForm,
  PLAIN_PATH_CHAR,
} from "./command-shapes.mjs";
