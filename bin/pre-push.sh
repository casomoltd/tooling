#!/bin/sh
# Capture ref info from git — sub-scripts need it to detect
# whether we're pushing to main.
PRE_PUSH_REFS=$(cat)
export PRE_PUSH_REFS

# Uniform pre-push for every repo: check, build, then the version/tag gates.
# `npm run build` must exist in EVERY repo so this line never has to special-case
# one. Where a repo produces no build output (a source-only repo like tooling,
# consumed as a git-dep), define build as a no-op (`"build": "echo ..."`) rather
# than omitting it — a missing script would abort the push with "Missing script:
# build", which once made it ambiguous whether a source-only repo was even
# pushable. No-op keeps the step honest and uniform.
npm run check \
  && npm run build \
  && echo "$PRE_PUSH_REFS" | check-version \
  && echo "$PRE_PUSH_REFS" | check-tags
