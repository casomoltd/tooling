#!/bin/sh
# Refuse a push that would put a merge commit on the remote.
#
# History is linear here: a branch catches up by rebasing, never by merging.
# A merge commit costs the thing a linear history is kept for — `git log` on a
# file stops being the list of changes to it, `git bisect` has two parents to
# choose between, and a revert has to name which side it means.
#
# The forge refuses merges made through its own UI; this refuses the other
# route, which is a local `git merge` followed by an ordinary push. Both are
# needed: neither covers the other.
#
# Only what the push would ADD is judged. A merge already on the remote stays
# where it is, because rewriting shared history to satisfy a new rule costs
# more than the rule is worth.

STATUS=0

while read -r _ LOCAL_SHA REMOTE_REF REMOTE_SHA; do
  # A deletion pushes the zero sha and adds nothing.
  case "$LOCAL_SHA" in
    *[!0]*) ;;
    *) continue ;;
  esac

  case "$REMOTE_SHA" in
    # A new branch: everything on it that no remote already has.
    *[!0]*) RANGE="$REMOTE_SHA..$LOCAL_SHA" ;;
    *) RANGE="$LOCAL_SHA --not --remotes" ;;
  esac

  # shellcheck disable=SC2086  # RANGE carries its own arguments.
  MERGES=$(git rev-list --merges $RANGE 2>/dev/null)

  if [ -n "$MERGES" ]; then
    COUNT=$(printf '%s\n' "$MERGES" | wc -l | tr -d ' ')
    echo "$REMOTE_REF would gain $COUNT merge commit(s):"
    printf '%s\n' "$MERGES" | while read -r SHA; do
      echo "  $(git log --format='%h %s' -1 "$SHA")"
    done
    echo "History is linear here. Rebase instead:"
    echo "  git rebase main"
    STATUS=1
  fi
done

exit $STATUS
