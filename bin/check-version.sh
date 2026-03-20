#!/bin/sh
# Reject push if package.json version hasn't changed vs origin/main

LOCAL_VERSION=$(node -p "require('./package.json').version")
REMOTE_VERSION=$(git show origin/main:package.json 2>/dev/null \
  | node -p "JSON.parse(require('fs').readFileSync(0)).version" 2>/dev/null)

if [ "$LOCAL_VERSION" = "$REMOTE_VERSION" ]; then
  echo "Version unchanged ($LOCAL_VERSION). Run: npm version patch|minor|major"
  exit 1
fi

echo "Version: $REMOTE_VERSION -> $LOCAL_VERSION"
