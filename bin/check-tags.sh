#!/bin/sh
# Reject push if local version tags exist that aren't being pushed.
# Reminds the user to use --follow-tags.

LOCAL_VERSION=$(node -p "require('./package.json').version")
TAG="v$LOCAL_VERSION"

# If the tag doesn't exist locally, nothing to check
if ! git rev-parse "$TAG" >/dev/null 2>&1; then
  exit 0
fi

# If the tag already exists on the remote, nothing to do
if git ls-remote --tags origin "$TAG" 2>/dev/null \
    | grep -q "$TAG"; then
  exit 0
fi

echo "Tag $TAG exists locally but is not being pushed."
echo "Run: git push --follow-tags"
exit 1
