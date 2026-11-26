import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import reactHooks from 'eslint-plugin-react-hooks';
import {readFileSync} from 'node:fs';
import {builtinModules} from 'node:module';
import {createLibConfig} from './eslint/lib.mjs';

/** The markup helpers' module, and the export it ships as, read from the
 *  manifest so the message names whatever the package publishes it as. */
const HTML_MODULE = 'lib/html.mjs';
const PKG = JSON.parse(
  readFileSync(new URL('package.json', import.meta.url), 'utf8'));
const htmlExport = Object.entries(PKG.exports)
  .find(([, target]) => target.default === `./${HTML_MODULE}`)?.[0];
if (htmlExport === undefined) {
  throw new Error(`no package export ships ${HTML_MODULE}`);
}
const NODE_FREE = `${HTML_MODULE} ships as ${PKG.name}${htmlExport.slice(1)}`
  + ' to any runtime; keep it free of Node modules.';

/* The repo that ships the house config lints itself with it. */
export default [
  // A third party's generated build, copied whole (`bin/render-report.mjs`
  // says why), so none of it is ours to lint.
  {ignores: ['bin/vendor/**']},
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
    // The markup helpers ship as a package export and are imported by
    // modules that stay free of Node, so a consumer can load them in any
    // runtime.
    files: [HTML_MODULE],
    rules: {
      'no-restricted-imports': ['error', {
        paths: builtinModules.map((name) => ({name, message: NODE_FREE})),
        patterns: [{group: ['node:*'], message: NODE_FREE}],
      }],
    },
  },
  {
    // The tests are plain node:assert scripts with no describe or it, which
    // this rule reads as empty.
    files: ['**/*.test.mjs', 'hooks/test.mts', 'hooks/*.test.mts'],
    rules: {'sonarjs/no-empty-test-file': 'off'},
  },
];
