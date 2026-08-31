#!/bin/sh
# Capture ref info from git — sub-scripts need it to detect
# whether we're pushing to main.
PRE_PUSH_REFS=$(cat)
export PRE_PUSH_REFS

# Uniform pre-push for every repo: the repo's own health gate, then the
# release-protocol gates.
#
# Building belongs to `check`, not here. A repo whose build fails is not
# healthy, and any assertion that reads build output (SSR, page meta, sitemap)
# has to run after the build inside that same script — so `check` is where the
# step already has to live. Declaring it here as well would give the build two
# owners and run it twice wherever `check` builds. A repo that needs a build
# gate adds `npm run build` to its own `check`; one that produces no artifact
# simply doesn't.
npm run check \
  && echo "$PRE_PUSH_REFS" | check-version \
  && echo "$PRE_PUSH_REFS" | check-tags
