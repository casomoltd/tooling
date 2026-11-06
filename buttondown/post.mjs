/**
 * The newsletter post format, read and written in one place. The reading
 * is shared by `buttondown check <file.md>` and `buttondown draft`: whatever
 * this refuses, both refuse, so a post the copy gate passes is one `draft`
 * accepts on the same grounds.
 *
 * A post is a markdown file whose first line, after any front matter, is
 * `# Subject`. The front matter is `key: value` lines between `---` fences.
 */
import {readFile} from "node:fs/promises";

/** The fence that opens and closes the front matter, with its newline. */
const FENCE = "---\n";

const FRONT_MATTER = new RegExp(`^${FENCE}([\\s\\S]*?)\\n${FENCE}`);

/** The line that opens a post's body names its subject. */
const HEADING = "# ";

/** Throws unless an image field holds an absolute URL, since Buttondown
 *  stores a relative one as given and the image then never loads. */
export function assertAbsoluteUrl(field, value) {
  if (!URL.canParse(value)) {
    throw new Error(`${field} must be an absolute URL, got `
      + JSON.stringify(value));
  }
}

/**
 * A post split into what `check` and `draft` read. `fields` is the front
 * matter as written, and a key it does not set is absent (`undefined`), as
 * `draft` passes a key through only when set. Refuses a post whose body
 * doesn't open on `# Subject`, an empty `id:` or `image:`, and an `image:`
 * that is not an absolute URL.
 */
export function parsePost(raw) {
  const m = raw.match(FRONT_MATTER);
  const fields = frontMatterFields(m?.[1] ?? "");
  const lines = (m ? raw.slice(m[0].length) : raw).trimStart().split("\n");
  if (!lines[0]?.startsWith(HEADING)) {
    throw new Error("after any front matter, the first line must be `# Subject`");
  }
  assertFrontMatter(fields);
  return {
    raw,
    hasFrontMatter: Boolean(m),
    fields,
    subject: lines[0].slice(HEADING.length).trim(),
    body: lines.slice(1).join("\n"),
  };
}

/** The post at `file`, read and parsed. */
export async function readPost(file) {
  return parsePost(await readFile(file, "utf8"));
}

/**
 * What a reader reads, part by part: the subject, the description when the
 * front matter sets one, and the body. The rest of the front matter is not
 * read: an `id:` is Buttondown's key and an `image:` a URL, and neither is a
 * word. Each part is `[name, text]`, so a check can say where it found a
 * problem.
 */
export function readerParts(post) {
  return [
    ["subject", post.subject],
    ["description", post.fields.description],
    ["body", post.body],
  ].filter(([, text]) => text !== undefined);
}

/** The parts a reader reads as one markdown document, the subject as its
 *  heading, so a check reading markdown sees each part as its own block. */
export function readerText(post) {
  return readerParts(post)
    .map(([name, text]) => (name === "subject" ? HEADING + text : text))
    .join("\n\n");
}

/** The post's file with `id: <id>` as the first front-matter line, opening
 *  front matter if it has none, so a re-run of `draft` finds its email. */
export function withId(post, id) {
  const idLine = `id: ${id}\n`;
  return post.hasFrontMatter
    ? FENCE + idLine + post.raw.slice(FENCE.length)
    : FENCE + idLine + FENCE + post.raw;
}

/** Throws on a front-matter field that is set but unusable. */
function assertFrontMatter(fields) {
  if ("id" in fields && !fields.id) {
    throw new Error("front matter has an empty `id:`; delete the line to "
      + "create a draft");
  }
  if ("image" in fields && !fields.image) {
    throw new Error("front matter has an empty `image:`; delete the line "
      + "to use the newsletter's share image");
  }
  if (fields.image) assertAbsoluteUrl("image", fields.image);
}

/** Each `key: value` line, split at its first colon and trimmed. */
function frontMatterFields(text) {
  return Object.fromEntries(text.split("\n")
    .filter((line) => line.includes(":"))
    .map((line) => {
      const at = line.indexOf(":");
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }));
}
