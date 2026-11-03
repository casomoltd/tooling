/**
 * Comparing two versions of a form. A form has three: the code's, the last
 * push's, and the live form's in Tally; `formChanges` compares any two, in
 * either direction.
 *
 * The live form can differ from the code for two reasons, and they need
 * opposite responses. An edit made in Tally's editor since the last push has
 * to be brought into the code, or the next push deletes it. A change made in
 * the code since the last push only needs pushing. Comparing each with the
 * last push tells the two apart, so the record of the last push is kept (see
 * `pushedStore`).
 */
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {toBlocks, toSettings} from "./translator.mjs";
import {BLOCK_TYPES, OPTION_TYPES} from "./vocabulary.mjs";

/** @import {Block, TallySettings} from "./index.d.mts" */
/** @import {TallyForm} from "./client.mjs" */

/**
 * A form at one moment, whichever copy it is. All three take this one shape,
 * so any two compare.
 * @typedef {{blocks: TallyForm["blocks"],
 *   settings: Record<string, unknown>}} FormVersion
 */

/** A block as a version holds it.
 *  @typedef {TallyForm["blocks"][number]} VersionBlock */

/** One difference: where it is (a block's uuid, or a setting's name), its
 *  kind, and a line a person can act on.
 *  @typedef {{where: string, kind: ChangeKind, line: string}} Change */

/** What kind of difference a change is. */
export const CHANGE_KINDS = Object.freeze({
  Added: "added",
  Removed: "removed",
  Retyped: "retyped",
  Changed: "changed",
  Setting: "setting",
});

/** @typedef {(typeof CHANGE_KINDS)[keyof typeof CHANGE_KINDS]} ChangeKind */

/** The longest a value is shown in a change's line, ellipsis included. */
const SHOW_LIMIT = 160;
const ELLIPSIS = "...";

/** The lists inside a block that each hold an answer of their own, and what
 *  to call one. */
const FIELD_LISTS = /** @type {const} */ ([
  ["hiddenFields", "hidden field"], ["calculatedFields", "calculation"],
]);

/** What `pushRefusal` is told about a push it judges.
 *  @typedef {{dropped: string[], edits: number, recorded: boolean}} PushRisk */

/**
 * The record of each form's last push, one JSON file per form in `dir`: a
 * cache of what was sent, rebuilt by the next push, so the site keeps it out
 * of git.
 * @param {string} dir
 */
export function pushedStore(dir) {
  /** @param {string} formKey */
  const file = (formKey) => path.join(dir, `${formKey}.json`);
  return {
    /** @param {string} formKey @returns {Promise<FormVersion | undefined>} */
    async read(formKey) {
      try {
        return JSON.parse(await readFile(file(formKey), "utf8"));
      } catch (error) {
        const {code} = /** @type {NodeJS.ErrnoException} */ (error);
        if (code === "ENOENT") return undefined;
        throw error;
      }
    },
    /** @param {string} formKey @param {FormVersion} version */
    async write(formKey, version) {
      await mkdir(dir, {recursive: true});
      await writeFile(file(formKey), `${JSON.stringify(version)}\n`);
    },
  };
}

/** @typedef {ReturnType<typeof pushedStore>} PushedStore */

/**
 * The version a live form's edits are read against: the last push, or with no
 * record of one, the code. Standing in, the code makes every difference read
 * as an editor edit, which errs safe.
 * @param {PushedStore} store
 * @param {string} formKey
 * @param {FormVersion} code
 */
export async function baseline(store, formKey, code) {
  const pushed = await store.read(formKey);
  return pushed ? {version: pushed, recorded: true} : {version: code, recorded: false};
}

/** The code's blocks and settings as a version.
 *  @param {Block[]} blocks @param {TallySettings} settings @returns {FormVersion} */
export function codeVersion(blocks, settings) {
  return {blocks, settings: Object.fromEntries(Object.entries(settings))};
}

/** What a push of the form sends, as the command records it, for a site that
 *  pins its forms' output.
 *  @param {import("./index.d.mts").FormDefinition} form @returns {FormVersion} */
export function pushedVersion(form) {
  return codeVersion(toBlocks(form), toSettings(form));
}

/**
 * The live form cut down to what the given versions write. Tally adds payload
 * fields and holds every setting, while the code writes a few; those are not
 * changes, so a live block keeps only the fields the versions give it, and
 * the settings only the ones they name. A block none of them holds was added
 * in the editor, and is kept whole.
 * @param {TallyForm} live
 * @param {...FormVersion} scope
 * @returns {FormVersion}
 */
export function liveVersion(live, ...scope) {
  /** @type {Map<string, Set<string>>} */
  const fields = new Map();
  for (const block of scope.flatMap((v) => v.blocks)) {
    const known = fields.get(block.uuid) ?? new Set();
    for (const field of Object.keys(block.payload)) known.add(field);
    fields.set(block.uuid, known);
  }
  const settings = new Set(scope.flatMap((v) => Object.keys(v.settings)));
  return {
    blocks: live.blocks.map((block) => {
      const known = fields.get(block.uuid);
      return known ? {...block, payload: pick(block.payload, known)} : block;
    }),
    settings: pick(live.settings ?? {}, settings),
  };
}

/**
 * Everything that differs between two versions of a form, read as going from
 * `before` to `after`. It is symmetric: swapping the two swaps "added" for
 * "removed" and the two sides of each change, and finds the same blocks.
 * @param {FormVersion} before
 * @param {FormVersion} after
 * @param {(uuid: string) => string} name
 * @returns {Change[]}
 */
export function formChanges(before, after, name) {
  const was = new Map(before.blocks.map((b) => [b.uuid, b]));
  const now = new Map(after.blocks.map((b) => [b.uuid, b]));
  const blocks = [...new Set([...was.keys(), ...now.keys()])].flatMap((uuid) => {
    const from = was.get(uuid);
    const to = now.get(uuid);
    /** @param {ChangeKind} kind @param {string} line @returns {Change} */
    const at = (kind, line) => ({where: uuid, kind, line});
    if (from && !to) {
      return [at(CHANGE_KINDS.Removed, `removed: ${name(uuid)} (${from.type})`)];
    }
    if (to && !from) {
      return [at(CHANGE_KINDS.Added, `added: ${name(uuid)} ${to.type} `
        + show(to.payload.safeHTMLSchema ?? to.payload.text))];
    }
    if (!from || !to) throw new Error(`${uuid} is in neither version`);
    const retyped = to.type !== from.type || to.groupUuid !== from.groupUuid
      ? [at(CHANGE_KINDS.Retyped, `changed type: ${name(uuid)} is now ${to.type}`)]
      : [];
    const fields = changedKeys(from.payload, to.payload).map((field) =>
      at(CHANGE_KINDS.Changed, `changed: ${name(uuid)} ${field}: `
        + `${show(from.payload[field])} → ${show(to.payload[field])}`));
    return [...retyped, ...fields];
  });
  const settings = changedKeys(before.settings, after.settings).map((setting) => ({
    where: setting,
    kind: CHANGE_KINDS.Setting,
    line: `changed setting: ${setting}: ${show(before.settings[setting])} → `
      + show(after.settings[setting]),
  }));
  return [...blocks, ...settings];
}

/**
 * The edits made in Tally since the last push that the code does not yet
 * hold: what changed from the last push to the live form, where the code
 * still differs from the live form. Once an edit is in the code, it drops out.
 * @param {FormVersion} pushed
 * @param {FormVersion} code
 * @param {FormVersion} live
 * @param {(uuid: string) => string} name
 */
export function unportedEdits(pushed, code, live, name) {
  /** @param {Change} c */
  const changeKey = (c) =>
    `${c.kind === CHANGE_KINDS.Setting ? "setting" : "block"}:${c.where}`;
  const stillDiffers = new Set(formChanges(code, live, name).map(changeKey));
  return formChanges(pushed, live, name).filter((c) => stillDiffers.has(changeKey(c)));
}

/**
 * The answers a push would delete: every question, option, hidden field and
 * calculation the live form holds that the next version does not. Tally
 * deletes a submission's answers with the block or field that held them, so
 * each is named for the person deciding whether to force it.
 * @param {TallyForm} live
 * @param {VersionBlock[]} next
 * @returns {string[]}
 */
export function droppedAnswers(live, next) {
  const keep = answerHolders(next);
  return [...answerHolders(live.blocks)]
    .filter(([uuid]) => !keep.has(uuid))
    .map(([uuid, what]) => `  ${what} (${uuid})`);
}

/**
 * Each answer a version holds, by the uuid Tally keys it under, with a name
 * for it: a question by its title, an option by its words, a hidden field or a
 * calculation by its name, which sit inside one block, so a field dropped from
 * that block is found too.
 * @param {VersionBlock[]} blocks
 * @returns {Map<string, string>}
 */
function answerHolders(blocks) {
  /** @type {Map<string, string>} */
  const held = new Map();
  for (const block of blocks) {
    const {payload} = block;
    if (block.type === BLOCK_TYPES.Title) {
      held.set(block.uuid, `question ${JSON.stringify(payload.safeHTMLSchema)}`);
    } else if (OPTION_TYPES.has(block.type)) {
      held.set(block.uuid, `option ${JSON.stringify(payload.text)}`);
    }
    for (const [list, what] of FIELD_LISTS) {
      const fields = /** @type {{uuid: string, name: string}[] | undefined} */ (
        payload[list]);
      for (const field of fields ?? []) held.set(field.uuid, `${what} ${field.name}`);
    }
  }
  return held;
}

/**
 * Why a push must not go ahead, or undefined when it may: answers it would
 * delete, unless `deleteAnswers`; then editor edits it would delete, unless
 * `discardEdits`. Each flag lets through only its own refusal. With no record
 * of the last push, every difference from the live form reads as an edit, so
 * the message says that rather than blame the editor.
 * @param {PushRisk} risk
 * @param {{deleteAnswers: boolean, discardEdits: boolean}} allow
 * @param {{deleteAnswers: string, discardEdits: string}} flagNames
 * @returns {string | undefined}
 */
export function pushRefusal({dropped, edits, recorded}, allow, flagNames) {
  if (dropped.length > 0 && !allow.deleteAnswers) {
    return "This push would delete answers the live form holds:\n"
      + `${dropped.join("\n")}\nRestore those keys, or pass `
      + `${flagNames.deleteAnswers} for a form not yet taking answers.`;
  }
  if (edits === 0 || allow.discardEdits) return undefined;
  return recorded
    ? `The live form has ${edits} edits made in Tally that the code does not `
      + "hold, which this push would delete. Run tally diff and bring them into "
      + `the code, or pass ${flagNames.discardEdits} to discard them.`
    : `There is no record of this form's last push here, so ${edits} `
      + "differences from the live form can't be told apart from editor edits. "
      + `Run tally diff, then pass ${flagNames.discardEdits} once none of them `
      + "is an edit to keep.";
}

/** The keys either record holds whose values differ.
 *  @param {Record<string, unknown>} a @param {Record<string, unknown>} b */
function changedKeys(a, b) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((key) => !same(a[key], b[key]));
}

/** @param {Record<string, unknown>} record @param {Set<string>} keys */
function pick(record, keys) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => keys.has(key)));
}

/** Equal as data: objects compare by their keys and values, whatever order
 *  Tally stores the keys in. @param {unknown} a @param {unknown} b */
function same(a, b) {
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
}

/** @param {unknown} value @returns {unknown} */
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([k, v]) => [k, sorted(v)]));
  }
  return value;
}

/** @param {unknown} value */
function show(value) {
  const text = JSON.stringify(value) ?? "nothing";
  return text.length > SHOW_LIMIT
    ? `${text.slice(0, SHOW_LIMIT - ELLIPSIS.length)}${ELLIPSIS}`
    : text;
}
