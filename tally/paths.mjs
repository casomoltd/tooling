/**
 * `@casomoltd/tooling/tally/paths`: a block's address and uuid, without the
 * form builder. The code lives in address.mjs, where the typecheck reads it;
 * beside paths.d.mts, TypeScript would skip it.
 */
export {Paths, RANGE_ENDS, stableUuid} from "./address.mjs";
