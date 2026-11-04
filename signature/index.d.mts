import type {ColophonLine} from "../identity/index.d.mts";

/** Gmail's limit on a signature's length. */
export declare const GMAIL_LIMIT: number;

/** Markup an email client drops or Outlook's Word engine ignores. */
export declare const DROPPED_MARKUP: readonly string[];

/** Each image is exported at twice its display size, for sharp screens. */
export declare const EXPORT_SCALE: number;

/** PNG colour type 2, RGB with no alpha. */
export declare const PNG_RGB: number;

/** A PNG's size in pixels and its colour type, from its header. */
export interface PngHeader {
  width: number;
  height: number;
  colourType: number;
}

/** Every `<img>` tag in a signature, whole. */
export declare function imageTags(html: string): string[];

/** Every link's address in a signature, its `&amp;` read back as `&`. */
export declare function hrefs(html: string): string[];

/** A tag's attribute; throws where the tag has none. */
export declare function attribute(tag: string, name: string): string;

/** A PNG's size and colour type, read from its header; throws on a file that
 *  isn't a PNG. */
export declare function readPng(bytes: Uint8Array): PngHeader;

/** Text made literal inside a regular expression. */
export declare function escapeRegExp(text: string): string;

/** A site's signature and the facts it is checked against. */
export interface SignatureFacts {
  /** The signature's HTML, as pasted into Gmail. */
  html: string;
  /** The site's origin, which serves the images (`https://example.com`). */
  origin: string;
  /** The folder the images are served from (`/sig`). */
  imagesPath: string;
  /** That folder on disk, every file in it a signature image. */
  imagesDir: string;
  /** The colophon the signature carries, line by line. */
  colophon: readonly ColophonLine[];
  /** Whether a line with a `source` links its text there, or reads as a
   *  sentence. */
  linkSources: boolean;
}

/** Every rule a signature breaks, each named; empty when it keeps them all:
 *  Gmail's length, markup a client drops, the images' folder, size, alpha,
 *  alt text and border, and the colophon. */
export declare function signatureFaults(facts: SignatureFacts): string[];

/** One response header, as Next's `headers()` and `vercel.json` list them. */
export interface Header {
  key: string;
  value: string;
}

/** What is wrong with the headers the images are served with (the rule that
 *  matched their folder, or undefined where none did): no Cache-Control,
 *  under a day's life, or `immutable`; undefined when they are right. */
export declare function cacheFault(
  headers: readonly Header[] | undefined,
): string | undefined;
