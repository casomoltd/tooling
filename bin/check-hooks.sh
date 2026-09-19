#!/bin/sh
# Is the house commit gate actually active in this repo?
#
# Answers one question, and answers it by *behaviour* rather than by presence.
# A repo can have a commit-msg hook that enforces some of the rules, or an
# older copy of them, and look wired while letting real violations through —
# that is exactly what happened: three repos each grew a hand-written copy of
# `no-ai-attribution`, two of them missing the length limits, and nothing
# noticed for months because every one of them *had* a hook.
#
# So this feeds the hook messages that must fail and checks that they do.
#
#   check-hooks            # this repo
#   check-hooks ~/dev/*    # every repo under a directory
#
# Exit 0 if every repo checked is gated, 1 otherwise. Language-neutral: sh and
# git only, like check-linear and check-tags.
set -e

status=0

check_one() {
  repo=$1
  name=$(basename "$repo")

  if [ ! -d "$repo/.git" ]; then
    return 0  # not a repo; silently skip so globs can be sloppy
  fi

  hooks=$(git -C "$repo" config --get core.hooksPath || echo ".git/hooks")
  case "$hooks" in
    /*) hook="$hooks/commit-msg" ;;
    *)  hook="$repo/$hooks/commit-msg" ;;
  esac

  if [ ! -f "$hook" ]; then
    printf '%-24s NOT GATED  (no commit-msg hook)\n' "$name"
    status=1
    return 0
  fi

  msg=$(mktemp)
  failures=""

  # Each probe is a message the house rules must reject. Keep the bodies
  # single-line so a copy that only checks the header still fails the first.
  probe() {
    printf '%s' "$2" > "$msg"
    if git -C "$repo" hook run --ignore-missing commit-msg -- "$msg" \
        >/dev/null 2>&1; then
      failures="$failures $1"
    fi
  }

  probe attribution "Add a thing

Co-authored-by: Claude <noreply@anthropic.com>
"
  probe header-length "Add a thing with a subject line that runs past the fifty character limit
"
  probe body-length "Add a thing

This body line is deliberately longer than the seventy-two character limit.
"

  rm -f "$msg"

  if [ -n "$failures" ]; then
    printf '%-24s PARTIAL    (accepts:%s)\n' "$name" "$failures"
    status=1
  else
    printf '%-24s gated\n' "$name"
  fi
}

if [ $# -eq 0 ]; then
  check_one "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
else
  for arg in "$@"; do
    check_one "$arg"
  done
fi

exit $status
