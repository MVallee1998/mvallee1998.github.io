#!/usr/bin/env bash
# Build the figures of the research overview page as SVGs in content/research/.
#   - research-figures/*.tex (TikZ, standalone) are compiled with pdflatex;
#   - the Berkovich skeleton is cropped from the mukai project, if it is checked out next to this repository.
# Usage: scripts/build_research_figures.sh
# Needs: pdflatex, pdfcrop, pdftocairo.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$root/research-figures"
out="$root/content/research"
build="$(mktemp -d)"
trap 'rm -rf "$build"' EXIT

for tex in "$src"/*.tex; do
  name="$(basename "$tex" .tex)"
  [ "$name" = style ] && continue
  (cd "$src" && pdflatex -interaction=nonstopmode -halt-on-error -output-directory "$build" "$name.tex" >/dev/null) \
    || { echo "pdflatex failed on $name.tex, see $build/$name.log" >&2; trap - EXIT; exit 1; }
  pdftocairo -svg "$build/$name.pdf" "$out/fig_$name.svg"
  echo "Updated content/research/fig_$name.svg"
done

berkovich="$root/../mukai+project/figures_standalone/genus_10_curve_berkovich.pdf"
if [ -f "$berkovich" ]; then
  pdfcrop --margins 2 "$berkovich" "$build/berkovich.pdf" >/dev/null
  pdftocairo -svg "$build/berkovich.pdf" "$out/fig_berkovich.svg"
  echo "Updated content/research/fig_berkovich.svg"
else
  echo "Skipped the Berkovich skeleton: $berkovich not found" >&2
fi
