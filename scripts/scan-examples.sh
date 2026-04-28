#!/usr/bin/env bash
# ============================================================================
# Prism — Placeholder & Example-Text Audit
# ============================================================================
# Surfaces every placeholder="..." and "e.g." / "for example" instance in the
# tracked codebase for human review. Maintainers naturally write these from
# their own real life ("e.g. Lincoln Park Zoo" because they live in Chicago,
# "e.g., Grandma Helen" because their kid actually has a Grandma Helen) — so
# even when the rest of the codebase is anonymized, these tend to drift
# toward real data.
#
# This script does NOT decide what's PII. It produces a list. The maintainer
# eyeballs each line and asks: "does this come from my real life?" If yes,
# replace with a generic alternative.
#
# Suggested generic alternatives:
#   names           Alex / Emma / Jordan / Sophie (matches Prism's seed)
#   cities          Multi-region rotation: "Kauai, Rome, Banff"
#   schools         Never use a real one
#   phones          (555) 01xx-xxxx (reserved-for-fiction range)
#   emails          name@example.com (reserved-for-documentation domain)
#
# This audit is COMPLEMENTARY to scripts/scan-pii.sh:
#   scan-pii.sh   — catches values explicitly on the maintainer's denylist
#   scan-examples — surfaces all candidate spots for the maintainer to review
#                   (catches values they didn't realize were specific)
#
# Run before each release tag and after merging large feature work.
#
# Usage:
#   bash scripts/scan-examples.sh            # full output
#   bash scripts/scan-examples.sh | less     # paginated for big codebases
#
# Always exits 0 — this is a review tool, not a gate.
# ============================================================================

set -euo pipefail

SECTION_DIVIDER="================================================================"

count_placeholders=0
count_examples=0

echo "$SECTION_DIVIDER"
echo "PLACEHOLDER ATTRIBUTES (placeholder=\"...\")"
echo "$SECTION_DIVIDER"
echo "Review each line. Anything specific to your real life → replace."
echo ""

# Capture and count separately so we can print a summary at the end.
placeholder_output=$(
  git ls-files \
    | grep -E '\.(tsx|jsx|ts|html)$' \
    | xargs -d '\n' grep -nE 'placeholder="[^"]+"' 2>/dev/null \
  || true
)
if [ -n "$placeholder_output" ]; then
  echo "$placeholder_output"
  count_placeholders=$(printf "%s" "$placeholder_output" | wc -l)
else
  echo "(none)"
fi

echo ""
echo "$SECTION_DIVIDER"
echo "EXAMPLE PATTERNS (e.g. / for example)"
echo "$SECTION_DIVIDER"
echo "Review each line — particularly proper nouns and specific addresses."
echo ""

example_output=$(
  git ls-files \
    | grep -E '\.(tsx|jsx|ts|html|md)$' \
    | xargs -d '\n' grep -niE "(e\.g\.|for example)" 2>/dev/null \
  || true
)
if [ -n "$example_output" ]; then
  echo "$example_output"
  count_examples=$(printf "%s" "$example_output" | wc -l)
else
  echo "(none)"
fi

echo ""
echo "$SECTION_DIVIDER"
echo "SUMMARY: $count_placeholders placeholder(s), $count_examples example pattern(s)"
echo "$SECTION_DIVIDER"
echo "This script never fails — it's a review tool. Eyeball the output above."
echo "After review, anonymize anything personal and re-run to confirm."
