#!/bin/sh
# Capture ref info from git — sub-scripts need it to detect
# whether we're pushing to main.
PRE_PUSH_REFS=$(cat)
export PRE_PUSH_REFS

npm run check \
  && npm run build \
  && echo "$PRE_PUSH_REFS" | check-version \
  && echo "$PRE_PUSH_REFS" | check-tags
