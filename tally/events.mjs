/**
 * `@casomoltd/tooling/tally/events`: reading what a Tally embed posts to its
 * page, safe to import in a browser. The code lives in event-reader.mjs,
 * where the typecheck reads it; beside events.d.mts, TypeScript would skip
 * it.
 */
export {
  readTallyEvent,
  TALLY_EMBED_OPTIONS,
  TALLY_EVENTS,
  TALLY_ORIGIN,
  TALLY_WIDGET_URL,
  tallyEmbedSrc,
  tallyFormHref,
} from "./event-reader.mjs";
