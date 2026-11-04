import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import reactHooks from 'eslint-plugin-react-hooks';
import {createLibConfig} from './eslint/lib.mjs';

/* The repo that ships the house config lints itself with it. */
export default [
  ...createLibConfig({tseslint, sonarjs}),
  {
    // The CLIs exist to run git and npm from the PATH a developer has.
    files: ['bin/**', 'hooks/**', 'scripts/**'],
    rules: {'sonarjs/no-os-command-from-path': 'off'},
  },
  {
    // The React frame and its tests: hooks run in the same order every
    // render, and an effect names what it reads.
    files: ['tally/frame*.mjs'],
    plugins: {'react-hooks': reactHooks},
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    // The tests are plain node:assert scripts with no describe or it, which
    // this rule reads as empty.
    files: ['**/*.test.mjs', 'hooks/test.mts', 'hooks/*.test.mts'],
    rules: {'sonarjs/no-empty-test-file': 'off'},
  },
];
