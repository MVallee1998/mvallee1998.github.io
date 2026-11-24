# CV source

LaTeX source of the CV served at `/cv.pdf` (compiled with XeLaTeX).

- `cv.tex`: main file (layout settings and the list of sections)
- `cv/*.tex`: one file per section
- `academic-cv.cls`, `fonts/`: document class and the fonts it loads

To rebuild the CV and update `static/cv.pdf`, run from the repository root:

    scripts/build_cv.sh

Then commit `cv-src/` and `static/cv.pdf` together.
