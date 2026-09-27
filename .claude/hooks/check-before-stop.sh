#!/bin/sh
input=$(cat)
printf '%s' "$input" | grep -Eq '"stop_hook_active": ?true' && exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -z "$(git status --porcelain -- src scripts e2e checks)" ] && exit 0
out=$( { npm test --silent && GUARD_BASE=HEAD npm run --silent guard; } 2>&1 ) && exit 0
printf 'Unit tests or guard failed on your uncommitted changes. Fix them, or add the missing test, before finishing. A change that truly needs no test can be committed with a "No-test: <reason>" trailer:\n%s\n' "$(printf '%s\n' "$out" | grep -Ev '^(BJS|✔)' | tail -40)" >&2
exit 2
