// The guards' cases: each a tool input and the verdict it should get, read
// by test.mts. `verdict` is the expected verdict, or null for "no match
// (allowed)"; `id`, where given, is the rule that must fire.
import type {BashRuleId} from "./guard-bash.mts";
import type {EditRuleId} from "./guard-edit.mts";
import type {Verdict} from "./lib/rule.mts";
import {wrappedCases} from "./wrapped-cases.mts";

/** A Bash command and the verdict it should get. */
export interface BashCase {
  command: string;
  verdict: Verdict | null;
  id?: BashRuleId;
}

/** An Edit or Write and the verdict it should get: Write carries `content`,
 *  Edit `new_string`. */
export interface EditCase {
  file_path: string;
  content?: string;
  new_string?: string;
  verdict: Verdict | null;
  id?: EditRuleId;
}

export const bashCases: BashCase[] = [
  // A push is asked about wherever it goes: a remote's name or an address.
  {
    command: "git push https://github.com/org/repo.git main",
    verdict: "ask", id: "git-push-confirm",
  },
  {
    command: "git push --follow-tags origin main",
    verdict: "ask", id: "git-push-confirm",
  },
  {
    command: "git push origin main > /tmp/push.log 2> /dev/null",
    verdict: "ask", id: "git-push-confirm",
  },
  {
    command: "git push origin feature/x && ls /tmp",
    verdict: "ask", id: "git-push-confirm",
  },
  {
    command: "git push origin HEAD:refs/heads/main",
    verdict: "ask", id: "git-push-confirm",
  },
  {command: "git push origin main", verdict: "ask", id: "git-push-confirm"},
  {command: "git push --follow-tags", verdict: "ask", id: "git-push-confirm"},
  {command: "git push --force origin main", verdict: "deny", id: "git-force-push"},
  {command: "git push -f", verdict: "deny", id: "git-force-push"},
  {command: "git push origin +main", verdict: "deny", id: "git-force-push"},
  // --force-with-lease is the safe variant: confirm, don't hard-block.
  {command: "git push --force-with-lease", verdict: "ask", id: "git-push-confirm"},
  {command: "git reset --hard HEAD~3", verdict: "deny", id: "git-reset-hard"},
  {command: "git rebase -i HEAD~2", verdict: "deny", id: "git-rebase-interactive"},
  {command: "git tag -d v1.0.0", verdict: "deny", id: "git-tag-delete"},
  {
    command: "git filter-branch --tree-filter x",
    verdict: "deny", id: "git-filter-branch",
  },
  {command: "npm version major", verdict: "deny", id: "version-major"},
  {command: "uv version --bump major", verdict: "deny", id: "version-major"},
  {command: "npm i -g typescript", verdict: "deny", id: "npm-global-install"},
  {command: "npm install --global eslint", verdict: "deny", id: "npm-global-install"},
  // Bumping is the release tail — confirm patch/minor (major stays denied).
  {command: "npm version patch", verdict: "ask", id: "version-bump-confirm"},
  {command: "npm version minor", verdict: "ask", id: "version-bump-confirm"},
  {command: "uv version --bump patch", verdict: "ask", id: "version-bump-confirm"},
  // Allowed — no rule should fire.
  {command: "git status", verdict: null},
  // still a push token; confirm
  {command: "git push --help", verdict: "ask", id: "git-push-confirm"},
  // bare — prints, doesn't bump
  {command: "npm version", verdict: null},
  {command: "npm i -D eslint", verdict: null},
  // Every commit is asked about, in any form; AI-attribution stays
  // commitlint's job. Options between git and its verb are seen through.
  {
    command: "cd /r/app && git commit -F /msgs/m.txt",
    verdict: "ask", id: "git-commit-confirm",
  },
  {
    command: "git -C /r/app commit -F /msgs/m.txt",
    verdict: "ask", id: "git-commit-confirm",
  },
  {command: 'git commit -m "feat: x"', verdict: "ask", id: "git-commit-confirm"},
  {command: "git commit --amend", verdict: "ask", id: "git-commit-confirm"},
  {
    command: "git status; git commit -am x",
    verdict: "ask", id: "git-commit-confirm",
  },
  {command: "(cd /a && git commit -m x)", verdict: "ask", id: "git-commit-confirm"},
  {
    command: "git --work-tree /r commit -m x",
    verdict: "ask", id: "git-commit-confirm",
  },
  // A mention inside an argument counts, erring towards caution.
  {
    command: "grep -rn 'git commit' docs",
    verdict: "ask", id: "git-commit-confirm",
  },
  // Plumbing/maintenance verbs that start with "commit" are not commits.
  {command: "git commit-graph write", verdict: null},
  {command: "git commit-tree abc123", verdict: null},
  {command: "git tag -a v1.0.0 -m v1.0.0", verdict: null},

  // Skipping git's hooks is refused; `-n` means it only on a commit.
  {
    command: "git commit --no-verify -F /m",
    verdict: "deny", id: "git-no-verify",
  },
  {command: "git commit -n -m x", verdict: "deny", id: "git-no-verify"},
  {command: "git commit -anm x", verdict: "deny", id: "git-no-verify"},
  {
    command: "git push --no-verify origin main",
    verdict: "deny", id: "git-no-verify",
  },
  {
    command: "cd /r && git -C /r merge --no-verify feature",
    verdict: "deny", id: "git-no-verify",
  },
  {command: "git push -n origin main", verdict: "ask", id: "git-push-confirm"},
  // Options before git's verb don't hide it from any rule.
  // A quoted option holding a separator is one word, not the command's end.
  {
    command: "git -c 'alias.x=a;b' push --force origin main",
    verdict: "deny", id: "git-force-push",
  },
  {command: 'git -c "a=b|c" reset --hard', verdict: "deny", id: "git-reset-hard"},
  {command: "git -C '/a&b' push -f", verdict: "deny", id: "git-force-push"},
  // A newline ends a command, so a later line's words aren't git's.
  {command: "git log --oneline\necho reset --hard", verdict: null},
  {command: "git status\necho push", verdict: null},
  // A rule's words stay inside its command, so a later one isn't read as git's.
  {command: "git push origin main && rm -f x", verdict: "ask", id: "git-push-confirm"},
  // A quoted message is one word, so a verb inside it isn't read as git's.
  {
    command: 'git commit -m "undo reset --hard"',
    verdict: "ask", id: "git-commit-confirm",
  },
  // A flag-shaped word after the verb, even in a message, errs towards
  // caution: refused on purpose.
  {command: 'git commit -m "fix -n flag"', verdict: "deny", id: "git-no-verify"},
  {
    command: "git -C /r push --force origin main",
    verdict: "deny", id: "git-force-push",
  },
  {command: "git -C /r push origin main", verdict: "ask", id: "git-push-confirm"},
  {command: "git -C /r status", verdict: null},
  {command: "ls .git -la", verdict: null},
  {
    command: "git -C /r reset --hard HEAD~1",
    verdict: "deny", id: "git-reset-hard",
  },
  {command: "git -c core.x=y tag -d v1.0.0", verdict: "deny", id: "git-tag-delete"},
  {
    command: "git --git-dir /r/.git rebase -i HEAD~2",
    verdict: "deny", id: "git-rebase-interactive",
  },
  {command: "npm --prefix /r version major", verdict: "deny", id: "version-major"},
  {
    command: "npm --prefix /r version minor",
    verdict: "ask", id: "version-bump-confirm",
  },
  {command: "npm -g install eslint", verdict: "deny", id: "npm-global-install"},
  ...wrappedCases,

  // A dependency sweep's commit and push are asked about like any other.
  {
    command: "cd /w/worktrees/dep-sweep-lib && git commit -F /tmp/msg.txt",
    verdict: "ask", id: "git-commit-confirm",
  },
  {
    command: "cd /w/worktrees/dep-sweep-lib"
      + " && git push --force-with-lease -u origin dep-sweep",
    verdict: "ask", id: "git-push-confirm",
  },
  {
    command: "cd /w/worktrees/dep-sweep-lib && git push --force -u origin dep-sweep",
    verdict: "deny", id: "git-force-push",
  },
];

export const editCases: EditCase[] = [
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
