# tooling

Public repo: shared dev config + CLIs (consumed as a git dependency,
not published) **and** a Claude Code skills plugin (`.claude-plugin/`)
shipping the generic engineering-standard skills under `skills/`.

**This repo is PUBLIC.** Never add private repo names, internal
strategy, the dev backlog, curated memory, or business-specific skills
here — those live in private workspace config. A public skill must
contain no private repo names, paths, or URLs. (`npm run check` runs the
`verify-pack` leak-gate; run it before committing.)

## Authoring skills / agents

When creating or editing a skill or agent, follow `docs/skill-agent-schema.md` —
the house authoring schema: the interface vocabulary and the three-profile decision
table (procedural skill · agent · standard/rubric) that says which sections a given
unit needs.
