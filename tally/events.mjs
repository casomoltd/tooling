/**
 * `@casomoltd/tooling/tally/events`: the addresses a page embeds a Tally form
 * from, and a reader of what the embed posts back; safe to import in a
 * browser. The code lives in embed.mjs, where the typecheck reads it; beside
 * events.d.mts, TypeScript would skip it.
 */
export {
  readTallyEvent,
  TALLY_EMBED_OPTIONS,
  TALLY_EVENTS,
  TALLY_ORIGIN,
  TALLY_WIDGET_URL,
  tallyEmbedSrc,
  tallyFormHref,
} from "./embed.mjs";
