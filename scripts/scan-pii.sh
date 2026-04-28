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
# Last-resort: ask Windows directly via cmd.exe for USERPROFILE. Catches
# WSL / Git-Bash / npm-spawned bash where USERPROFILE didn't propagate into
# the bash environment.
#
# Path format depends on the bash flavor:
#   Git Bash on Windows  → /c/Users/Foo
#   WSL (mounts C: at /mnt/c) → /mnt/c/Users/Foo
# We can't reliably detect which, so we try both.
if command -v cmd.exe >/dev/null 2>&1; then
  win_up_raw=$(cmd.exe /c "echo %USERPROFILE%" 2>/dev/null | tr -d '\r')
  if [ -n "${win_up_raw:-}" ]; then
    # /c/... form (Git Bash)
    gitbash_path=$(echo "$win_up_raw" | sed 's|\\|/|g; s|^\([A-Za-z]\):|/\L\1|')
    # /mnt/c/... form (WSL)
    wsl_path=$(echo "$win_up_raw" | sed 's|\\|/|g; s|^\([A-Za-z]\):|/mnt/\L\1|')
    candidates+=("${gitbash_path}/.config/prism-pii-denylist.txt")
    candidates+=("${wsl_path}/.config/prism-pii-denylist.txt")
  fi
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

# Single-pass scan. Naive approach (loop over each entry, grep all files
# once per entry) is O(entries × files) and went 30s+ on a 50-entry list
# against the Prism tree. Strip comments + blanks into a temp file, then
# one `grep -f` does the whole job in one Aho-Corasick pass.
tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT INT TERM

# Filter denylist:
#   - drop blank lines
#   - drop comment lines (whole-line comments starting with #, after trim)
#   - strip leading/trailing whitespace from each remaining entry
#   - strip trailing CR (Windows line endings)
sed -e 's/\r$//' \
    -e 's/^[[:space:]]*//' \
    -e 's/[[:space:]]*$//' \
    "$DENYLIST" \
  | grep -v '^$' \
  | grep -v '^#' \
  > "$tmpfile"

if [ ! -s "$tmpfile" ]; then
  echo "[scan-pii] Denylist contains no entries (after stripping comments and blanks)."
  echo "Add real entries to $DENYLIST or the scan does nothing."
  exit 0
fi

# Single-pass: grep -f reads patterns from the temp file. -w whole-word,
# -F fixed-string, -I skip binary files. xargs may shard the file list
# across multiple grep invocations on very large repos, which is fine —
# each shard still does one pass over its files for all patterns at once.
matches=$(
  git ls-files \
    | grep -v -E '^(scripts/scan-pii\.sh|scripts/scan-examples\.sh|docs/code-review-modalities\.md)$' \
    | xargs -d '\n' grep -wn -F -I -f "$tmpfile" 2>/dev/null \
  || true
)

if [ -z "$matches" ]; then
  echo "[scan-pii] Clean: no denylist matches in tracked files."
  exit 0
fi

violations=$(printf '%s\n' "$matches" | wc -l)

echo "[scan-pii] DENYLIST MATCHES:"
printf '%s\n' "$matches" | sed 's/^/  /'
echo ""
echo "[scan-pii] FAIL: $violations match(es) in tracked files."
echo "Anonymize the offending values before pushing."
exit 1
