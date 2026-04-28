#!/usr/bin/env bash
# ============================================================================
# Prism — PII Denylist Scanner
# ============================================================================
# Greps tracked files for items in a maintainer-curated personal denylist.
# Catches the cross-artifact-shape bug class where a fixture LOOKS fictional
# but actually uses real names / addresses / phones the maintainer happens
# to know. LLM review can't tell 'Eric in a mock' from 'Eric who lives at
# this house'; a denylist can.
#
# DENYLIST FILE
# -------------
# Path: $PRISM_PII_DENYLIST (env var) OR ~/.config/prism-pii-denylist.txt
#
# Format (one entry per line):
#     # Comments start with hash. Blank lines ignored.
#     RealFirstName
#     RealLastName
#     742 Real Street
#     real.email@example.com
#     5551234567
#
# The denylist itself MUST live outside the repo and MUST NOT be committed.
# Each maintainer populates their own. Categories to consider:
#   - Real names of household members (first AND last)
#   - Street addresses, school names, employer names
#   - Phone numbers (anything not in 555-01xx reserved-for-fiction)
#   - Email addresses other than the maintainer's public commit identity
#   - Personal GPS coordinates (for travel feature)
#
# USAGE
# -----
#   bash scripts/scan-pii.sh                 # scan tracked files
#   PRISM_PII_DENYLIST=/path/to/list bash scripts/scan-pii.sh
#
# Exits 0 if clean OR if no denylist file exists (with a warning).
# Exits 1 if any tracked file contains a denylist entry.
#
# Wire into git via .husky/pre-push or .git/hooks/pre-push to run before
# every push. The cost of an extra grep is far smaller than a public PII
# leak.
# ============================================================================

set -euo pipefail

# Resolve the denylist path. Try in order:
#   1. $PRISM_PII_DENYLIST if set
#   2. $HOME/.config/prism-pii-denylist.txt (Linux/macOS, also Git Bash on Windows)
#   3. $USERPROFILE/.config/prism-pii-denylist.txt (Windows; some bash setups have
#      HOME pointing at a Linux-shaped path that doesn't match the actual user dir)
DENYLIST=""
candidates=()
if [ -n "${PRISM_PII_DENYLIST:-}" ]; then
  candidates+=("$PRISM_PII_DENYLIST")
fi
if [ -n "${HOME:-}" ]; then
  candidates+=("${HOME}/.config/prism-pii-denylist.txt")
fi
if [ -n "${USERPROFILE:-}" ]; then
  # Convert C:\Users\Foo to /c/Users/Foo for bash file-test compatibility.
  win_home="${USERPROFILE//\\//}"
  win_home="${win_home//C:/\/c}"
  win_home="${win_home//D:/\/d}"
  candidates+=("${win_home}/.config/prism-pii-denylist.txt")
  candidates+=("${USERPROFILE}/.config/prism-pii-denylist.txt")
fi
for path in "${candidates[@]}"; do
  if [ -f "$path" ]; then
    DENYLIST="$path"
    break
  fi
done

if [ -z "$DENYLIST" ]; then
  cat <<EOF
[scan-pii] WARNING: denylist not found.
Searched:
$(printf '  - %s\n' "${candidates[@]}")

To enable PII scanning, create the file with one entry per line.
See docs/code-review-modalities.md (TODO #5) for guidance on what to include.

Skipping scan — exiting clean, but you have no protection until the file exists.
EOF
  exit 0
fi

violations=0
matched_entries=()

# Read denylist line by line. Skip blanks and comments.
while IFS= read -r entry || [ -n "$entry" ]; do
  # Trim trailing CR (in case the file was edited on Windows).
  entry="${entry%$'\r'}"
  # Trim leading/trailing whitespace.
  entry="$(echo "$entry" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [ -z "$entry" ] && continue
  case "$entry" in '#'*) continue ;; esac

  # Whole-word, fixed-string grep across tracked files only.
  # Excludes the scan script and modality docs which discuss the issue meta.
  # `|| true` because xargs returns non-zero when *any* grep batch finds
  # nothing — even if other batches matched. Ignore the exit status and
  # check the output instead.
  # `grep -I` skips binary files (PNG/GIF/etc.) which would otherwise produce
  # false positives from random byte sequences happening to match a denylist
  # entry. Real text-file leaks are still caught.
  matches=$(
    git ls-files \
      | grep -v -E '^(scripts/scan-pii\.sh|docs/code-review-modalities\.md)$' \
      | xargs -d '\n' grep -wn -F -I -- "$entry" 2>/dev/null \
    || true
  )
  if [ -n "$matches" ]; then
    echo ""
    echo "[scan-pii] DENYLIST MATCH: $entry"
    echo "$matches" | sed 's/^/  /'
    violations=$((violations + 1))
    matched_entries+=("$entry")
  fi
done < "$DENYLIST"

echo ""
if [ "$violations" -eq 0 ]; then
  echo "[scan-pii] Clean: no denylist matches in tracked files."
  exit 0
fi

echo "[scan-pii] FAIL: $violations denylist entr$([ "$violations" -eq 1 ] && echo "y" || echo "ies") matched in tracked files."
echo "Anonymize the offending values before pushing."
echo "If a match is intentional and not actually PII, add it to a"
echo "scripts/scan-pii.allowlist file (one path or path:line per entry)."
exit 1
