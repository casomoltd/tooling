# Releases

How a repo on this package's gates releases a version: what has to be true before, how the version is bumped and tagged, and what the push does. A commit never releases; that is [Commits](commit.md). Anyone may propose a change that meets the gates; a release is made by a maintainer.

## The rules

- **Release from a clean tree.** `git status --porcelain` prints nothing: every change is already committed through the gates.
- **The repo's own tooling bumps the version.** Never hand-edit the `version` field and never hand-create a tag. In an npm repo, `npm version patch` (or `minor`) edits `package.json`, commits and creates an annotated tag in one step. In a Python repo, `uv version --bump patch` edits the files, and the commit and the annotated tag (`git tag -a v<version>`) follow by hand; a lightweight tag is skipped by `--follow-tags`.
- **Patch by default, minor when asked, major only with a maintainer's approval.**
- **Fetch the remote's tags first** (`git fetch origin --tags`). Without it, a tag only the remote holds goes unseen, and the bump can pick a version another clone already released; if the bump refuses a version, stop rather than bump past it.
- **Each step is a command of its own,** never run in parallel with another command, so a bump can never land in the wrong working directory.
- **A push to `main` must carry a new version and its tag.** The `pre-push` hook refuses it if `package.json`'s `version` equals `origin/main`'s, or if `git config push.followTags` is not `true` (a Python repo runs these through its dev-only npm layer: [README](../README.md#a-repo-whose-toolchain-is-not-npm)). Other branches skip both.
- **History stays linear.** The `pre-push` hook refuses any push that would add a merge commit; a branch catches up by rebase.
- **A push is a release.** After the `pre-push` gate ([Quality gates § The hooks](quality-gates.md#the-hooks)), CI runs the gate again on the pushed commit, and the publish workflow runs on whatever its `on:` block names: a tag push publishes a package, a branch push deploys an app. Push with `git push --atomic --follow-tags origin <default branch>`, one repo at a time, so the branch and its tag land together or not at all.
