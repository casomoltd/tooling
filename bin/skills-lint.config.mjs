// remark config for linting a Claude Code skills/agents/docs tree — the basic
// smoke test that catches most breakage a rename or hand-edit leaves behind:
// invalid YAML frontmatter and broken markdown links/anchors. Nothing custom,
// just three stock remark plugins.
//
//   remark-frontmatter             recognise the `---` YAML block
//   remark-validate-links          every relative link + #anchor resolves
//   remark-lint-frontmatter-schema frontmatter parses and has name+description
//
// Run with cwd = the repo being linted, pointing remark at this file:
//   remark --frail --quiet --no-stdout --rc-path <this> <paths…>
// (`--frail` turns findings into a non-zero exit — the gate.) Both the file
// globs and the schema path are resolved relative to cwd by the plugin, so the
// schema — which lives here in `tooling` — is expressed relative to whatever
// cwd remark runs in, letting one config serve tooling's CI and a consumer
// repo's hook alike.
import path from "node:path";
import {fileURLToPath} from "node:url";
import remarkFrontmatter from "remark-frontmatter";
import remarkValidateLinks from "remark-validate-links";
import remarkLintFrontmatterSchema from "remark-lint-frontmatter-schema";

const schemaAbs = fileURLToPath(
  new URL("./schemas/frontmatter.schema.json", import.meta.url),
);
const schema = path.relative(process.cwd(), schemaAbs);

// `**` skips dot-directories, so the plain globs match a non-dot tree (tooling's
// own `skills/`) while the `.claude/**` variants reach a repo's `.claude/` tree
// (where every consumer's skills + agents actually live). One config, both.
const targets = [
  "**/SKILL.md",
  ".claude/**/SKILL.md",
  "**/agents/*.md",
  ".claude/**/agents/*.md",
];

export default {
  plugins: [
    remarkFrontmatter,
    [remarkValidateLinks, {repository: false}],
    [remarkLintFrontmatterSchema, {schemas: {[schema]: targets}}],
  ],
};
