/**
 * Where a site's Tally API key comes from, exported on its own as
 * `@casomoltd/tooling/tally/api-key`: a site's own script that calls Tally's
 * API reads the key as the `tally` command does, without loading the rest of
 * the engine. Each export is typed as api-key.d.mts declares it, so a
 * signature that moves in config.mjs fails the typecheck here. This file is
 * not named for its types file: TypeScript reads a `.d.mts` beside a `.mjs`
 * of the same name as that module's types and stops checking the module.
 */
import * as config from "./config.mjs";

/** @import * as Declared from "./api-key.d.mts" */

/** @type {typeof Declared.loadTallySettings} */
export const loadTallySettings = config.loadTallySettings;

/** @type {typeof Declared.tallyApiKey} */
export const tallyApiKey = config.tallyApiKey;
