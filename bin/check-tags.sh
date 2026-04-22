#!/bin/sh
# Ensure push.followTags is enabled when pushing to main.
# Non-main branches skip this check.

PUSHING_MAIN=false
while read -r _ _ REMOTE_REF _; do
  case "$REMOTE_REF" in
    refs/heads/main) PUSHING_MAIN=true ;;
  esac
done

if [ "$PUSHING_MAIN" = false ]; then
  exit 0
fi

FOLLOW=$(git config --get push.followTags 2>/dev/null)

if [ "$FOLLOW" != "true" ]; then
  echo "push.followTags is not enabled."
  echo "Run: git config push.followTags true"
  exit 1
fi
