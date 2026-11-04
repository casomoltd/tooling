// The guards' cases: each a tool input and the verdict it should get, read
// by test.mts.
import type {Verdict} from "./lib/rule.mts";

// verdict: expected verdict, or null for "no match (allowed)".
// id: optional — assert which rule fired.
export interface Case {
  command?: string;
  file_path?: string;
  content?: string;
  new_string?: string;
  verdict: Verdict | null;
  id?: string;
}

export const bashCases: Case[] = [
  {
    command: "git push origin main",
    verdict: "ask",
    id: "git-push-confirm",
  },
  {
    command: "git push --follow-tags",
    verdict: "ask",
    id: "git-push-confirm",
  },
  {
    command: "git push --force origin main",
    verdict: "deny",
    id: "git-force-push",
  },
  {
    command: "git push -f",
    verdict: "deny",
    id: "git-force-push",
  },
  {
    command: "git push origin +main",
    verdict: "deny",
    id: "git-force-push",
  },
  // --force-with-lease is the safe variant: confirm, don't hard-block.
  {
    command: "git push --force-with-lease",
    verdict: "ask",
    id: "git-push-confirm",
  },
  {
    command: "git reset --hard HEAD~3",
    verdict: "deny",
    id: "git-reset-hard",
  },
  {
    command: "git rebase -i HEAD~2",
    verdict: "deny",
    id: "git-rebase-interactive",
  },
  {
    command: "git tag -d v1.0.0",
    verdict: "deny",
    id: "git-tag-delete",
  },
  {
    command: "git filter-branch --tree-filter x",
    verdict: "deny",
    id: "git-filter-branch",
  },
  {
    command: "npm version major",
    verdict: "deny",
    id: "version-major",
  },
  {
    command: "uv version --bump major",
    verdict: "deny",
    id: "version-major",
  },
  {
    command: "npm i -g typescript",
    verdict: "deny",
    id: "npm-global-install",
  },
  {
    command: "npm install --global eslint",
    verdict: "deny",
    id: "npm-global-install",
  },
  // Bumping is the release tail — confirm patch/minor (major stays denied).
  {
    command: "npm version patch",
    verdict: "ask",
    id: "version-bump-confirm",
  },
  {
    command: "npm version minor",
    verdict: "ask",
    id: "version-bump-confirm",
  },
  {
    command: "uv version --bump patch",
    verdict: "ask",
    id: "version-bump-confirm",
  },
  // Allowed — no rule should fire.
  {
    command: "git status",
    verdict: null,
  },
  // still a push token; confirm
  {
    command: "git push --help",
    verdict: "ask",
    id: "git-push-confirm",
  },
  // bare — prints, doesn't bump
  {
    command: "npm version",
    verdict: null,
  },
  {
    command: "npm i -D eslint",
    verdict: null,
  },
  // A commit in the one form asks for confirmation (git-commit-confirm);
  // AI-attribution stays commitlint's job. Any other form is refused.
  {
    command: "git -C /r/app commit -F /msgs/m.txt",
    verdict: "ask",
    id: "git-commit-confirm",
  },
  {
    command: 'git commit -m "feat: x"',
    verdict: "deny",
    id: "git-commit-form",
  },
  {
    command: "git commit --amend",
    verdict: "deny",
    id: "git-commit-form",
  },
  {
    command: 'git -C tooling commit -m "feat: x"',
    verdict: "deny",
    id: "git-commit-form",
  },
  {
    command: "cd /a && git commit -F /m",
    verdict: "deny",
    id: "git-commit-form",
  },
  {
    command: "git add a && git -C /a commit -F /m",
    verdict: "deny",
    id: "git-commit-form",
  },
  {
    command: "git status; git commit -am x",
    verdict: "deny",
    id: "git-commit-form",
  },
  {
    command: "(cd /a && git commit -m x)",
    verdict: "deny",
    id: "git-commit-form",
  },
  // git's options before the verb, in every spelling, are still a commit.
  {
    command: "git -C/r commit -m x",
    verdict: "deny",
    id: "git-commit-form",
  },
  {
    command: "git --work-tree /r commit -m x",
    verdict: "deny",
    id: "git-commit-form",
  },
  {
    command: "git -P commit -m x",
    verdict: "deny",
    id: "git-commit-form",
  },
  // A path word carrying a second command is not the form.
  {
    command: "git -C /r commit -F /m;git${IFS}push",
    verdict: "deny",
    id: "git-commit-form",
  },
  // The words in an argument are not a commit.
  {
    command: "grep -rn 'git commit' docs",
    verdict: null,
  },
  {
    command: "echo 'run git commit -F file' > notes.txt",
    verdict: null,
  },
  // Plumbing/maintenance verbs that start with "commit" are not commits.
  {
    command: "git commit-graph write",
    verdict: null,
  },
  {
    command: "git commit-tree abc123",
    verdict: null,
  },
  {
    command: "git tag -a v1.0.0 -m v1.0.0",
    verdict: null,
  },

  // ---- dependency-sweep carve-out ----
  // An unattended sweep can't answer an `ask`, so its two branch-side shapes
  // inside a `worktrees/dep-sweep-*` checkout must fall through cleanly, the
  // commit allowed though it isn't the one form.
  {
    command: "cd /w/worktrees/dep-sweep-lib && git commit -F /tmp/msg.txt",
    verdict: null,
  },
  {
    command: 'cd "/w/my repo/worktrees/dep-sweep-lib"'
      + " && git commit -F /tmp/msg.txt",
    verdict: null,
  },
  {
    command: "cd /w/worktrees/dep-sweep-lib"
      + " && git push --force-with-lease -u origin dep-sweep",
    verdict: null,
  },
  // ...and everything else stays guarded. The exemption is the exact shape,
  // not the directory: being in a sweep worktree licenses nothing on its own.
  {
    command: 'cd /w/worktrees/dep-sweep-lib && git commit -m "feat: x"',
    verdict: "deny",
    id: "git-commit-form",
  },
  // A path word carrying a second command is not the sweep's shape.
  {
    command: "cd /w/worktrees/dep-sweep-lib && git commit -F /m;git${IFS}push",
    verdict: "deny",
    id: "git-commit-form",
  },
  {
    command: 'cd "/w/$(touch x)/worktrees/dep-sweep-lib" && git commit -F /m',
    verdict: "deny",
    id: "git-commit-form",
  },
  {
    command: "cd /w/worktrees/dep-sweep-lib && git push -u origin main",
    verdict: "ask",
    id: "git-push-confirm",
  },
  // A compound tail must not ride in under the carve-out.
  {
    command: "cd /w/worktrees/dep-sweep-lib"
      + " && git commit -F /tmp/msg.txt && npm publish",
    verdict: "deny",
    id: "git-commit-form",
  },
  // A non-sweep worktree is an ordinary checkout.
  {
    command: "cd /w/worktrees/feature-x && git commit -F /tmp/msg.txt",
    verdict: "deny",
    id: "git-commit-form",
  },
  // Every other `deny` is absolute — the carve-out never reaches them.
  {
    command: "cd /w/worktrees/dep-sweep-lib && git push --force -u origin dep-sweep",
    verdict: "deny",
    id: "git-force-push",
  },
  {
    command: "cd /w/worktrees/dep-sweep-lib && git reset --hard HEAD~1",
    verdict: "deny",
    id: "git-reset-hard",
  },
];

export const editCases: Case[] = [
  {
    file_path: "/x/tsconfig.json",
    content: '{"compilerOptions":{"strict":false}}',
    verdict: "deny",
    id: "tsconfig-strict-weakening",
  },
  {
    file_path: "/x/tsconfig.base.json",
    content: '{"compilerOptions":{"skipLibCheck":true}}',
    verdict: "deny",
  },
  {
    file_path: "/x/bar.py",
    content: "x = thing()  # type: ignore",
    verdict: "deny",
    id: "py-type-ignore-blanket",
  },
  // Allowed cases.
  {
    file_path: "/x/bar.py",
    content: "x = thing()  # type: ignore[arg-type]",
    verdict: null,
  },
  {
    file_path: "/x/tsconfig.json",
    content: '{"compilerOptions":{"strict":true}}',
    verdict: null,
  },
  // `@ts-ignore` is eslint's job (`ban-ts-comment`): the hook must not fire on it.
  {
    file_path: "/x/foo.ts",
    new_string: "// @ts-ignore\nconst a = bad();",
    verdict: null,
  },
];
