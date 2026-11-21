// remark rule: every skill an agent preloads must resolve.
//
// An agent's `skills:` frontmatter names skills Claude Code loads into the
// subagent before it starts. A name that resolves to nothing is skipped with
// only a debug-log warning (Claude Code docs, sub-agents, "Preload skills into
// subagents"), so a misspelt or moved skill silently strips an agent of its
// rubric. This rule makes that a lint failure instead; under `remark --frail`
// it fails the build.
//
// A preload resolves to the repo's own skills (`skills/<name>/SKILL.md`, or
// `.claude/skills/<name>/SKILL.md` where a repo keeps them under `.claude/`)
// or to the house skills shipped in this package (`skills/<name>/SKILL.md`
// beside `bin/`), named bare or as `casomoltd:<name>`. Nothing machine-local
// counts, `~/.claude/skills` or an installed plugin, so the answer is the
// same on every machine, CI included; a preload of any other plugin's skill
// fails for the same reason.
import {existsSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

/** The house skills: this package's own `skills/`, installed or checked out. */
const HOUSE_SKILLS = fileURLToPath(new URL("../skills/", import.meta.url));
const HOUSE_PREFIX = "casomoltd:";
const REPO_SKILL_DIRS = ["skills", path.join(".claude", "skills")];

/** The remark plugin. Options exist for the tests; a config passes none. */
export default function remarkLintAgentPreloads({
  cwd = process.cwd(),
  houseDir = HOUSE_SKILLS,
} = {}) {
  return (tree, file) => {
    if (!file.path || !isAgentBrief(file.path)) return;
    const frontmatter = tree.children.find((node) => node.type === "yaml");
    if (!frontmatter) return;
    const names = preloadNames(frontmatter.value);
    if (names?.length === 0) {
      file.message("has a `skills:` field that names no skill", frontmatter);
    }
    for (const name of names ?? []) {
      if (resolves(name, {cwd, houseDir})) continue;
      file.message(
        `preloads skill "${name}", which resolves to no SKILL.md in this repo's`
          + " skills/ or .claude/skills/, nor in @casomoltd/tooling's skills/",
        frontmatter,
      );
    }
  };
}

/**
 * The skill names in an agent's frontmatter `skills:` field, in either form
 * YAML allows: an inline list (`skills: a, b` or `skills: [a, b]`) or a
 * block list, indented or flush. `undefined` where the field is absent, so
 * an empty field reads as `[]` and is refused rather than passing unread.
 * Read by hand rather than with a YAML parser because this config runs in
 * every consumer, which installs remark but not a parser; the frontmatter
 * schema rule beside it already refuses YAML that doesn't parse.
 */
export function preloadNames(frontmatter) {
  const lines = frontmatter.split(/\r?\n/).map(withoutComment);
  const at = lines.findIndex((line) => /^skills:/.test(line));
  if (at === -1) return undefined;
  const inline = lines[at].slice("skills:".length).trim();
  const items = inline === ""
    ? blockItems(lines.slice(at + 1))
    : inline.replace(/^\[|\]$/g, "").split(",");
  return items.map(unquote).filter((name) => name !== "");
}

/**
 * Whether a preload name resolves, against the repo at `cwd` and the house
 * skills in `houseDir`. A `casomoltd:` name can only be a house skill; any
 * other prefixed name is another plugin's, which never resolves here.
 */
export function resolves(name, {cwd, houseDir}) {
  if (name.startsWith(HOUSE_PREFIX)) {
    return skillAt(houseDir, name.slice(HOUSE_PREFIX.length));
  }
  if (name.includes(":")) return false;
  return REPO_SKILL_DIRS.some((dir) => skillAt(path.join(cwd, dir), name))
    || skillAt(houseDir, name);
}

/** The `- item` lines that follow a key, up to the first line that isn't one. */
function blockItems(lines) {
  const items = [];
  for (const line of lines) {
    const item = line.trimStart();
    if (!item.startsWith("-")) break;
    items.push(item.slice(1));
  }
  return items;
}

/** Whether `dir` holds a skill called `name`. */
function skillAt(dir, name) {
  return existsSync(path.join(dir, name, "SKILL.md"));
}

/** A YAML scalar without its surrounding quotes. */
function unquote(raw) {
  return raw.trim().replace(/^(["'])(.*)\1$/, "$2");
}

/** A line up to a ` #` comment: YAML starts one at a `#` after whitespace. */
function withoutComment(line) {
  const at = line.search(/\s#/);
  return at === -1 ? line : line.slice(0, at);
}

/** An agent brief: a markdown file directly inside an `agents/` directory. */
function isAgentBrief(filePath) {
  return filePath.endsWith(".md")
    && path.basename(path.dirname(filePath)) === "agents";
}
