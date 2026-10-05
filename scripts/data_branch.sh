#!/usr/bin/env bash
# Published data lives on the `data` branch: only data/ and runs/, with full history. main requires pull
# requests for code; the daily Action records data here instead, and the Pages build overlays it on main.
# See docs/decisions.md ("Data on its own branch").
#
#   restore             overlay data/ and runs/ from origin/data onto the working tree (no-op when the branch does
#                       not exist yet); prints the data commit used, which publish needs as BASE
#   reset BASE          put data/ and runs/ back as they were in BASE (or in HEAD when BASE is empty): used when a
#                       run fails lint, so nothing it wrote is published
#   publish BASE MSG    commit the working tree's data/ and runs/ as a child of BASE (a new root when BASE is empty)
#                       and push it to the data branch; prints "published" or "unchanged"
set -euo pipefail
BRANCH="${DATA_BRANCH:-data}"
DIRS=(data runs)

overlay() {  # $1 = commit
  for d in "${DIRS[@]}"; do
    if git cat-file -e "$1:$d" 2>/dev/null; then
      rm -rf "$d"
      git archive "$1" "$d" | tar -x
    fi
  done
}

case "${1:-}" in
  restore)
    if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
      git fetch --no-tags --depth=1 origin "$BRANCH" >/dev/null 2>&1
      base=$(git rev-parse FETCH_HEAD)
      overlay "$base"
      echo "$base"
    fi
    ;;
  reset)
    base="${2:-}"
    if [ -n "$base" ]; then
      overlay "$base"
    else
      git checkout -- "${DIRS[@]}" 2>/dev/null || true
      git clean -fdq -- "${DIRS[@]}" 2>/dev/null || true
    fi
    ;;
  publish)
    base="${2:-}"
    msg="${3:-data: update}"
    tmp=$(mktemp -d)
    export GIT_INDEX_FILE="$tmp/index"  # a fresh index: the commit holds data/ and runs/ only
    for d in "${DIRS[@]}"; do
      if [ -d "$d" ]; then git add "$d"; fi
    done
    tree=$(git write-tree)
    if [ -n "$base" ] && [ "$tree" = "$(git rev-parse "$base^{tree}")" ]; then
      echo "unchanged"
      exit 0
    fi
    if [ -n "$base" ]; then
      commit=$(git commit-tree "$tree" -p "$base" -m "$msg")
    else
      commit=$(git commit-tree "$tree" -m "$msg")
    fi
    git push --quiet origin "$commit:refs/heads/$BRANCH"
    echo "published"
    ;;
  *)
    echo "usage: $0 restore | reset BASE | publish BASE MESSAGE" >&2
    exit 2
    ;;
esac
