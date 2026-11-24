#!/usr/bin/env bash
# Build the CV from cv-src/ (XeLaTeX) and copy it to static/cv.pdf, served at /cv.pdf.
# Usage: scripts/build_cv.sh
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root/cv-src"
latexmk -xelatex -interaction=nonstopmode -halt-on-error cv.tex
cp cv.pdf "$root/static/cv.pdf"
echo "Updated static/cv.pdf"
