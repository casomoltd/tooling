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
