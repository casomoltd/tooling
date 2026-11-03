/**
 * The public face of the attribution entry. The code lives in tagger.mjs,
 * where the typecheck reads it against the declaration here; beside a .d.mts,
 * TypeScript would skip it.
 */
export {utmTagger} from "./tagger.mjs";
