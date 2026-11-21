/** One attribute of a start tag: its name, lower case, and its value with its
 *  references read back, absent where the attribute is written without one. */
export interface StartTagAttribute {
  name: string;
  value?: string;
}

/** A start tag: its name, lower case, its attributes (only the first of a
 *  repeated name), and where it starts and ends in the markup. */
export interface StartTag {
  name: string;
  attributes: StartTagAttribute[];
  start: number;
  end: number;
}

/** `text` with its character references read back: `&amp; &quot; &lt; &gt;
 *  &apos;` (and their upper-case forms but `&apos;`), the typographic
 *  `&nbsp; &lsquo; &rsquo; &ldquo; &rdquo; &ndash; &mdash; &hellip;` (lower
 *  case only; `&nbsp;` reads as U+00A0), and any numeric one,
 *  decimal or hex. A reference is read only with its closing `;`. A reference
 *  to no character reads as U+FFFD, and 128 to 159 are not remapped as
 *  Windows-1252; any other name is left as written. */
export declare function decodeEntities(text: string): string;

/** Text made literal inside a regular expression. */
export declare function escapeRegExp(text: string): string;

/** Every start tag in `html`, read in one forward pass, so a tag written
 *  inside a quoted value is not one. A regex, not a parser: a comment or a
 *  script's string is read as markup. */
export declare function startTags(html: string): StartTag[];
