/**
 * What a site's form styling needs from the engine: a selector for a block.
 * The styling itself, its colours, face and recipes, is the site's.
 */

/**
 * One selector per block, by Tally's documented `.tally-block-<uuid>` class,
 * each with the same suffix.
 * @param {string[]} uuids
 * @param {string} suffix
 */
export function blockSelectors(uuids, suffix) {
  return uuids.map((uuid) => `.tally-block-${uuid}${suffix}`).join(",\n");
}
