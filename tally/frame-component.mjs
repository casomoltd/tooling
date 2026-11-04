"use client";
/**
 * A Tally form embedded in a React page: the frame, Tally's widget script
 * that sizes it, the form's own page offered where the script is blocked,
 * and the form's events read down to what a page may act on.
 *
 * Plain JS (`createElement`, no JSX), so the package keeps no build step; a
 * site's bundler compiles it with the rest of its client code. The code lives
 * here, where the typecheck reads it; beside frame.d.mts, TypeScript would
 * skip it.
 */
import {
  createElement as h, Fragment, useEffect, useEffectEvent, useState,
  useSyncExternalStore,
} from "react";
import NextScript from "next/script.js";
import {
  readTallyEvent, TALLY_ORIGIN, TALLY_WIDGET_URL, tallyEmbedSrc, tallyFormHref,
} from "./embed.mjs";

/** @import {ReactNode} from "react" */
/** @import {TallyEvent} from "./events.d.mts" */
/** @import {TallyFrameProps} from "./frame.d.mts" */

/** The frame's starting height, until the widget sizes it to the form; a
 *  host reserves the same space so its page doesn't jump as it loads. */
export const TALLY_FRAME_HEIGHT = 600;

/** Next's script loader. Its dist file gives `Script` a `.default` that
 *  points back to itself, so `.default` is `Script` in Node and in a bundler
 *  alike; the test is there for the typecheck, which sees only the module. */
const Script = /** @type {typeof NextScript.default} */ (
  "default" in NextScript ? NextScript.default : NextScript);

/**
 * A Tally form in the page. `hidden` takes any shape `URLSearchParams` does,
 * or undefined while the page doesn't yet know it: the frame then holds its
 * space and offers a reader without scripts the form's own page, which is
 * what the server renders. `onEvent` hears each page view and the submit,
 * never the answers, and the frame always calls the latest one it was given;
 * `fallback` draws the link to the form's own page in the site's style.
 * @param {Readonly<TallyFrameProps>} props
 */
export function TallyFrame({
  formId, title, hidden, height = TALLY_FRAME_HEIGHT, onEvent,
  fallback = openOnTally,
}) {
  const [blocked, setBlocked] = useState(false);
  // The latest handler, so the listener stays put across renders and a host
  // may pass it inline.
  const onTally = useEffectEvent(
    /** @param {TallyEvent} event */ (event) => onEvent?.(event));
  useEffect(() => {
    /** @param {MessageEvent} event */
    function onMessage(event) {
      // The reader checks the origin too; the listener checks it itself
      // because sonarjs/post-message requires every message listener to.
      if (event.origin !== TALLY_ORIGIN) return;
      const tally = readTallyEvent(event, formId);
      if (tally) onTally(tally);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [formId]);

  const href = tallyFormHref(formId);
  const hiddenPending = hidden === undefined;
  if (blocked) return fallback(href);
  if (hiddenPending) {
    return h("div", {style: {minHeight: height}},
      h("noscript", null, fallback(href)));
  }
  return h(Fragment, null,
    h("noscript", null, fallback(href)),
    h("iframe", {
      "data-tally-src": tallyEmbedSrc(formId, hidden),
      loading: "lazy",
      width: "100%",
      height,
      title,
      style: {border: 0},
    }),
    // onReady, not onLoad: it runs again when the page mounts after a
    // client-side navigation, when the script is already loaded.
    h(Script, {
      src: TALLY_WIDGET_URL,
      onReady: () => tallyWidget()?.loadEmbeds(),
      onError: () => setBlocked(true),
    }),
  );
}

/**
 * A value only the browser knows, such as how the reader arrived, for a
 * frame's `hidden`: undefined on the server and in the first render as the
 * page hydrates, then `read()`'s value. `read` must give an equal value each
 * time it is called (a string, say), as React compares the two.
 * @template T
 * @param {() => T} read
 * @returns {T | undefined}
 */
export function useBrowserValue(read) {
  return useSyncExternalStore(neverChanges, read, notReadYet);
}

/**
 * The form's own page, offered where the frame can't load.
 * @param {string} href
 * @returns {ReactNode}
 */
function openOnTally(href) {
  return h("p", null,
    "The form can’t load here. ", h("a", {href}, "Open it on Tally"), ".");
}

/** A browser value is fixed for the life of the page: nothing to subscribe
 *  to. */
function neverChanges() {
  return () => {};
}

/** On the server, and while the page hydrates, the browser value is not read
 *  yet. */
function notReadYet() {
  return undefined;
}

/** Tally's widget, once its script has run. */
function tallyWidget() {
  return /** @type {{Tally?: {loadEmbeds: () => void}}} */ (
    /** @type {unknown} */ (globalThis)).Tally;
}
