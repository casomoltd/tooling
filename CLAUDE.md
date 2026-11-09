# tooling

Public repo: shared dev config + CLIs (published to npm as `@casomoltd/tooling`, MIT) **and** a Claude Code skills plugin (`.claude-plugin/`) shipping the generic engineering-standard skills under `skills/`.

**This repo is PUBLIC.** Never add private repo names, internal strategy, the dev backlog, curated memory, or business-specific skills here — those live in private configuration. A public skill must contain no private repo names, paths, or URLs. (`npm run check` runs the `verify-pack` leak-gate; run it before committing.)

## Authoring skills / agents

When creating or editing a skill or agent, follow [`docs/skill-agent-schema.md`](docs/skill-agent-schema.md), the house authoring schema: the interface vocabulary and the three-profile decision table (procedural skill · agent · standard/rubric) that says which sections a given unit needs.

For the prose, [`skills/docs-style`](skills/docs-style/SKILL.md) is the owner. Before handing back, run [`agents/skill-review`](agents/skill-review.md) on a changed skill or brief and [`agents/doc-review`](agents/doc-review.md) on a changed doc.
