# Commits

How a commit is made in a repo on this package's gates: what happens at each
step, which gate runs where, and the one command a commit is made with. The
steps Claude follows are the [`commit` skill](../skills/commit/SKILL.md); the
hooks are in [Quality gates](../README.md#quality-gates).

## The steps

1. **Run the repo's checks.** `npm run check`, or a Python repo's suite, so
   the commit's own `pre-commit` hook, which runs the same, passes once it
   is confirmed.
2. **Stage the files by name.** `cd <repo> && git add a.ts b.ts`, never `git add -A` or
   `git add .`, so a commit holds only what was meant for it.
3. **Review the staged diff.** The review agents read what is staged, and the
   diff and their findings go to the person committing before anything lands.
4. **Write the message to a file.** The file is the message: what is checked
   next is exactly what the commit records.
5. **Run the message gate on the file.** The repo's own `commit-msg` hook,
   called with the file's path, checks it as the commit will; fix what it
   reports and run it again until it passes.
6. **Commit from the file, in [the one form](#the-command).** The person
   committing confirms it in a prompt that shows the repo, the staged files
   and the message (the [`git-commit-confirm`](../hooks/README.md) guard).
7. **The commit's own hooks run.** `pre-commit` runs `npm run check`, and
   `commit-msg` checks the message again; either one failing stops the
   commit.

Each step is a command of its own, never chained with another step, so each
one that asks for permission asks for itself alone.

A commit never bumps the version or pushes; that is the release, a separate
step ([`release-version`](../skills/release-version/SKILL.md)).

## The command

```text
cd <absolute repo path> && git commit -F <absolute message file>
```

Run alone, never chained after a `git add` or before a `git push`.

- **`cd` and absolute paths** name the repo outright, so the prompt can say
  which repo the commit lands in, and a commit never depends on which
  directory the shell happened to be in. git takes no option before its verb
  (`git -C`): the guards read the verb as the word after `git`.
- **`-F`** takes the message from the file step 4 wrote and step 5 checked.
  `-m` would send text nothing has checked.
- **One form** means the prompt matches the command whole, rather than
  parsing the many ways a shell command can be written.

The plugin's `git-commit-form` guard refuses a commit in any other form, with
the form to use instead ([the guards](../hooks/README.md)). The one exception
is an unattended dependency sweep's own commit, which no one is there to
confirm ([the sweep exemption](../hooks/README.md#the-dependency-sweeps-exemption)).

## Which gate checks what

| Step | Gate | Checks |
|---|---|---|
| 1 | the repo's checks, run by hand | its full health gate ([Quality gates](../README.md#quality-gates)) |
| 7 | `pre-commit` hook | the same `npm run check`, as the commit is made |
| 3 | review agents | the staged diff against the house standards |
| 5 and 7 | `commit-msg` hook | the message's format and the AI-attribution ban ([Quality gates](../README.md#quality-gates)), and a change to a file on the suppression list ([lint](lint.md)) |
| 6 | `git-commit-form` guard | the command is the one form; any other is refused |
| 6 | `git-commit-confirm` guard | the person committing sees repo, files and message, and says yes |

Step 5 and step 7 run the same message gate on the same file, so a message
that passed step 5 can't fail it at step 7.
