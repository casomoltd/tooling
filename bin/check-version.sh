#!/bin/sh
# Reject push to main if version hasn't changed vs origin/main.
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

LOCAL_VERSION=$(node -p "require('./package.json').version")
REMOTE_VERSION=$(git show origin/main:package.json 2>/dev/null \
  | node -p \
    "JSON.parse(require('fs').readFileSync(0)).version" \
    2>/dev/null)

if [ "$LOCAL_VERSION" = "$REMOTE_VERSION" ]; then
  echo \
    "Version unchanged ($LOCAL_VERSION)." \
    "Run: npm version patch|minor|major"
  exit 1
fi

echo "Version: $REMOTE_VERSION -> $LOCAL_VERSION"
