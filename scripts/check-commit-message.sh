#!/bin/sh
# Checks that a commit message subject (or PR title) follows Conventional
# Commits, e.g. "feat: add search" or "fix(db)!: drop old column".
# Reads the subject from stdin. Used by .githooks/commit-msg and the PR title
# workflow, so the rule lives in one place.

TYPES="feat|fix|docs|chore|refactor|test|ci|build|perf|style|revert"

subject=$(head -n 1)

# Messages git writes itself.
case "$subject" in
  "Merge "* | "Revert \""* | "fixup! "* | "squash! "* | "amend! "*) exit 0 ;;
esac

if printf '%s\n' "$subject" | grep -Eq "^($TYPES)(\([a-z0-9._/-]+\))?!?: [^ ].*"; then
  exit 0
fi

cat >&2 <<MSG
Not a Conventional Commit: "$subject"

Use <type>[(scope)][!]: <description>, for example:
  feat: add search page
  fix(db): handle empty post names
  docs: explain the session hook

Types: $(printf '%s' "$TYPES" | tr '|' ' ')
MSG
exit 1
