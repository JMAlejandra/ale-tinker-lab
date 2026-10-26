#!/bin/sh
# Checks that a branch name is <type>/<short-name>, using the Conventional
# Commit types, e.g. "feat/search-page" or "docs/feature-templates".
# Takes the branch name as $1. Used by .githooks/pre-push and the PR title
# workflow.

. "$(dirname "$0")/conventional-types.sh"

branch=$1

case "$branch" in
  # The default branch, and prototype branches the /prototype skill keeps.
  main | prototype/*) exit 0 ;;
esac

if printf '%s\n' "$branch" | grep -Eq "^($TYPES)/[a-z0-9][a-z0-9.-]*$"; then
  exit 0
fi

cat >&2 <<MSG
Branch name not allowed: "$branch"

Use <type>/<short-name> in lowercase kebab-case, for example:
  feat/search-page
  fix/empty-post-names
  docs/feature-templates

Types: $(printf '%s' "$TYPES" | tr '|' ' ')
Rename with: git branch -m <new-name>
MSG
exit 1
