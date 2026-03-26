#!/bin/sh
# Ensure push.followTags is enabled so version tags reach the remote.

FOLLOW=$(git config --get push.followTags 2>/dev/null)

if [ "$FOLLOW" != "true" ]; then
  echo "push.followTags is not enabled."
  echo "Run: git config push.followTags true"
  exit 1
fi
