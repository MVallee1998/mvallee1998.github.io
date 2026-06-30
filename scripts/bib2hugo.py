#!/usr/bin/env python3
"""
Convert .bib files in bib/ to Hugo paper content pages under content/research/.

Usage:
    python scripts/bib2hugo.py           # skip existing pages
    python scripts/bib2hugo.py --force   # overwrite all pages

Each BibTeX entry produces content/research/<citekey>/index.md.
Place .bib files in the bib/ folder at the project root.

Supported BibTeX fields:
    title, author, year, month, journal, booktitle, doi, url,
    abstract, keywords, volume, number, pages, note, eprint
"""

import os
import re
import sys
import textwrap
from pathlib import Path

# ---------------------------------------------------------------------------
# BibTeX parser
# ---------------------------------------------------------------------------

def _read_braced_value(s, start):
    """Read a brace-delimited value starting at position `start` (the '{').
    Returns (value_without_outer_braces, end_position_exclusive)."""
    depth = 0
    i = start
    result = []
    while i < len(s):
        c = s[i]
        if c == '{':
            depth += 1
            if depth > 1:
                result.append(c)
        elif c == '}':
            depth -= 1
            if depth == 0:
                return ''.join(result), i + 1
            result.append(c)
        else:
            result.append(c)
        i += 1
    raise ValueError(f"Unmatched brace starting at position {start}")


def _read_quoted_value(s, start):
    """Read a quote-delimited value starting at position `start` (the '"').
    Returns (value, end_position_exclusive). Brace balancing inside quotes."""
    i = start + 1
    result = []
    depth = 0
    while i < len(s):
        c = s[i]
        if c == '{':
            depth += 1
            result.append(c)
        elif c == '}':
            depth -= 1
            result.append(c)
        elif c == '"' and depth == 0:
            return ''.join(result), i + 1
        else:
            result.append(c)
        i += 1
    raise ValueError(f"Unmatched quote starting at position {start}")


def parse_bib_string(text):
    """Parse a BibTeX string and return a list of (citekey, entry_dict) tuples."""
    # Strip comments (lines starting with %)
    lines = [l if not l.lstrip().startswith('%') else '' for l in text.splitlines()]
    text = '\n'.join(lines)

    entries = []
    i = 0
    n = len(text)

    while i < n:
        # Find next @
        at = text.find('@', i)
        if at == -1:
            break
        i = at + 1

        # Read entry type
        m = re.match(r'\s*([A-Za-z]+)\s*\{', text[i:])
        if not m:
            continue
        entry_type = m.group(1).lower()
        i += m.end()

        if entry_type in ('string', 'preamble', 'comment'):
            # Skip until matching closing brace
            depth = 1
            while i < n and depth:
                if text[i] == '{':
                    depth += 1
                elif text[i] == '}':
                    depth -= 1
                i += 1
            continue

        # Read citekey
        comma = text.find(',', i)
        if comma == -1:
            break
        citekey = text[i:comma].strip()
        i = comma + 1

        # Read fields until the closing outer brace
        fields = {'ENTRYTYPE': entry_type}
        depth = 1  # we're inside the outer {

        while i < n and depth > 0:
            # Skip whitespace and commas
            while i < n and text[i] in ' \t\n\r,':
                i += 1
            if i >= n:
                break
            if text[i] == '}':
                depth -= 1
                i += 1
                break

            # Read field name
            fm = re.match(r'([A-Za-z0-9_\-]+)\s*=\s*', text[i:])
            if not fm:
                # Skip unexpected content
                i += 1
                continue
            field_name = fm.group(1).lower()
            i += fm.end()

            # Read field value
            if i >= n:
                break
            if text[i] == '{':
                value, i = _read_braced_value(text, i)
            elif text[i] == '"':
                value, i = _read_quoted_value(text, i)
            else:
                # Bare value (number or @string reference) — read until , or }
                end = i
                while end < n and text[end] not in ',}':
                    end += 1
                value = text[i:end].strip()
                i = end

            fields[field_name] = value

        entries.append((citekey, fields))

    return entries


def parse_bib_file(path):
    with open(path, encoding='utf-8', errors='replace') as f:
        return parse_bib_string(f.read())


# ---------------------------------------------------------------------------
# LaTeX cleanup
# ---------------------------------------------------------------------------

_LATEX_MATH_PLACEHOLDER = '\x00'

def clean_latex(text):
    """Best-effort conversion of LaTeX markup to plain text / Markdown."""
    if not text:
        return text

    # Collapse whitespace / newlines
    text = re.sub(r'\s+', ' ', text).strip()

    # Preserve math spans ($...$) — pass through as-is for Hugo/MathJax
    # Remove outer braces that BibTeX uses for case protection: {Title} → Title
    # but keep inner braces that are part of LaTeX commands

    # Common LaTeX text commands → plain text
    text = re.sub(r'\\textbf\{([^}]*)\}', r'**\1**', text)
    text = re.sub(r'\\textit\{([^}]*)\}', r'*\1*', text)
    text = re.sub(r'\\emph\{([^}]*)\}', r'*\1*', text)
    text = re.sub(r'\\text\{([^}]*)\}', r'\1', text)

    # Accents and special characters
    accents = {
        r"\'": '', r'\`': '', r'\^': '', r'\"': '', r'\~': '',
        r'\c': '', r'\v': '',
    }
    for cmd, repl in accents.items():
        # \'{e} → é  (approximate: just strip the command, keep the letter)
        text = re.sub(re.escape(cmd) + r'\{(.)\}', r'\1', text)
        text = re.sub(re.escape(cmd) + r'(.)', r'\1', text)

    # Special symbols
    text = text.replace('\\&', '&').replace('\\%', '%').replace('\\$', '$')
    text = text.replace('---', '—').replace('--', '–')
    text = re.sub(r'~', ' ', text)  # non-breaking space

    # Remove remaining LaTeX commands (keep argument if present)
    text = re.sub(r'\\[A-Za-z]+\{([^}]*)\}', r'\1', text)
    text = re.sub(r'\\[A-Za-z]+', '', text)

    # Strip lone braces (case protection)
    text = text.replace('{', '').replace('}', '')

    return text.strip()


# ---------------------------------------------------------------------------
# Author parsing
# ---------------------------------------------------------------------------

def parse_authors(author_str):
    """Split 'Last, First and First Last and ...' into a list of display names."""
    if not author_str:
        return []
    raw = re.split(r'\s+and\s+', author_str, flags=re.IGNORECASE)
    authors = []
    for a in raw:
        a = clean_latex(a.strip())
        if not a:
            continue
        # BibTeX "Last, First" format → "First Last"
        if ',' in a:
            parts = [p.strip() for p in a.split(',', 1)]
            a = f"{parts[1]} {parts[0]}"
        authors.append(a)
    return authors


def format_author_citation(authors):
    """Format author list for the in-text citation line.

    First author: 'Last, First'; remaining: 'First Last'.
    e.g. 'Prinzel, Florianus, and Moritz-Maria von Igelfeld'
    """
    if not authors:
        return ''

    def invert_first(name):
        """'First Last' → 'Last, First' (best-effort for first author)."""
        parts = name.rsplit(' ', 1)
        if len(parts) == 2:
            return f"{parts[1]}, {parts[0]}"
        return name

    first = invert_first(authors[0])
    if len(authors) == 1:
        return first
    rest = authors[1:]
    if len(rest) == 1:
        return f"{first}, and {rest[0]}"
    return first + ', ' + ', '.join(rest[:-1]) + f", and {rest[-1]}"


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------

MONTHS = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'june': '06', 'july': '07', 'august': '08', 'september': '09',
    'october': '10', 'november': '11', 'december': '12',
}

def entry_date(fields):
    year = fields.get('year', '2000').strip()
    month_raw = fields.get('month', '').strip().lower()
    month = MONTHS.get(month_raw[:3], '01')
    try:
        int(year)
    except ValueError:
        year = re.sub(r'\D', '', year)[:4] or '2000'
    return f"{year}-{month}-01", year


# ---------------------------------------------------------------------------
# Markdown generation
# ---------------------------------------------------------------------------

def truncate(text, max_len):
    if len(text) <= max_len:
        return text
    return text[:max_len - 1].rsplit(' ', 1)[0] + '…'


def yaml_str(s):
    """Wrap a string in YAML double quotes, escaping inner quotes."""
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'


def yaml_list(items):
    return '[' + ', '.join(yaml_str(i) for i in items) + ']'


def build_bibtex_block(citekey, fields):
    """Re-emit a clean BibTeX block for the citation section."""
    entry_type = fields.get('ENTRYTYPE', 'article')
    order = ['author', 'year', 'title', 'journal', 'booktitle',
             'volume', 'number', 'pages', 'doi', 'url', 'eprint', 'note']
    skip = {'ENTRYTYPE', 'abstract', 'keywords', 'month', 'file',
            'annote', 'mendeley-tags', 'archiveprefix', 'primaryclass',
            'issn', 'isbn', 'fjournal', 'language', 'urldate', 'timestamp'}
    lines = [f'@{entry_type}{{{citekey},']
    seen = set()
    for k in order:
        if k in fields and k not in seen:
            seen.add(k)
            lines.append(f'  {k} = {{{fields[k]}}},')
    for k, v in fields.items():
        if k not in seen and k not in skip:
            seen.add(k)
            lines.append(f'  {k} = {{{v}}},')
    lines.append('}')
    return '\n'.join(lines)


def entry_to_markdown(citekey, fields):
    title = clean_latex(fields.get('title', 'Untitled'))
    authors = parse_authors(fields.get('author', ''))
    date_str, year = entry_date(fields)
    abstract = clean_latex(fields.get('abstract', ''))
    keywords_raw = fields.get('keywords', '')
    tags = [clean_latex(k.strip()) for k in re.split(r'[,;]', keywords_raw) if k.strip()] if keywords_raw else []

    # Prefer fjournal (full name) for display; fall back to journal/booktitle abbreviation
    venue_display = clean_latex(fields.get('fjournal') or fields.get('journal') or fields.get('booktitle') or '')
    venue_abbr = clean_latex(fields.get('journal') or fields.get('booktitle') or '')
    doi = fields.get('doi', '').strip()
    url = fields.get('url', '').strip()
    volume = fields.get('volume', '').strip()
    number = fields.get('number', '').strip()
    pages = fields.get('pages', '').replace('--', '–').strip()
    eprint = fields.get('eprint', '').strip()
    note = clean_latex(fields.get('note', ''))

    # summary shown on the list card: venue + volume/pages if available
    venue_line_parts = [venue_display]
    if volume and number:
        venue_line_parts.append(f'{volume} ({number})')
    elif volume:
        venue_line_parts.append(volume)
    if pages:
        venue_line_parts.append(pages)
    summary = ', '.join(p for p in venue_line_parts if p) or title

    # description: abstract truncated for SEO (falls back to venue summary)
    description = truncate(abstract or note or summary, 155)

    # editPost URL: prefer DOI, then eprint (arXiv), then plain URL
    if doi:
        edit_url = f"https://doi.org/{doi}"
    elif eprint:
        edit_url = f"https://arxiv.org/abs/{eprint}"
    elif url:
        edit_url = url
    else:
        edit_url = ''

    # --- Front matter ---
    fm_lines = ['---']
    fm_lines.append(f'title: {yaml_str(title)}')
    fm_lines.append(f'date: {date_str}')
    if tags:
        fm_lines.append(f'tags: {yaml_list(tags)}')
    if authors:
        fm_lines.append(f'author: {yaml_list(authors)}')
    if description:
        fm_lines.append(f'description: {yaml_str(description)}')
    fm_lines.append(f'summary: {yaml_str(summary)}')
    if edit_url or venue_abbr:
        fm_lines.append('editPost:')
        if edit_url:
            fm_lines.append(f'    URL: {yaml_str(edit_url)}')
        if venue_abbr:
            fm_lines.append(f'    Text: {yaml_str(venue_abbr)}')
    fm_lines.append('---')

    # --- Body ---
    body_parts = []

    # Download section: use local PDF placeholder; fall back to preprint URL
    download_lines = ['##### Download\n']
    if eprint:
        download_lines.append(f'+ [Preprint](https://arxiv.org/pdf/{eprint})')
    else:
        download_lines.append('+ [Paper](paper.pdf)')
    body_parts.append('\n'.join(download_lines))

    # Abstract
    if abstract:
        body_parts.append(f'##### Abstract\n\n{abstract}')

    # Citation — format: "Last, First, and Co-Author. Year. "Title." *Venue* Vol (Num): Pages. URL"
    cite_authors = format_author_citation(authors)
    cite_venue = f'*{venue_display}*' if venue_display else ''
    vol_issue = f' {volume} ({number})' if volume and number else (f' {volume}' if volume else '')
    page_part = f': {pages}' if pages else ''
    link_part = f'https://doi.org/{doi}' if doi else (f'https://arxiv.org/abs/{eprint}' if eprint else (url if url else ''))
    venue_block = cite_venue + vol_issue + page_part + ('.' if cite_venue or vol_issue or page_part else '')

    parts = []
    if cite_authors:
        parts.append(cite_authors + '.')
    if year:
        parts.append(year + '.')
    parts.append(f'"{title}."')
    if venue_block:
        parts.append(venue_block)
    if link_part:
        parts.append(link_part)
    cite_line = ' '.join(parts)

    bibtex = build_bibtex_block(citekey, fields)
    body_parts.append(f'##### Citation\n\n{cite_line}\n\n```BibTeX\n{bibtex}\n```')

    # Join body with separators
    body = '\n\n---\n\n'.join(body_parts)

    return '\n'.join(fm_lines) + '\n\n---\n\n' + body + '\n'


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

# Map bib filename (stem) → subsection folder under content/research/
BIB_SECTION = {
    'preprints': 'preprints',
    'articles':  'published',
    'conference': 'conferences',
}


def main():
    force = '--force' in sys.argv

    project_root = Path(__file__).parent.parent
    bib_dir = project_root / 'bib'
    papers_dir = project_root / 'content' / 'research'

    if not bib_dir.exists():
        print(f'No bib/ directory found at {bib_dir}. Create it and add .bib files.')
        sys.exit(1)

    bib_files = sorted(bib_dir.glob('*.bib'))
    if not bib_files:
        print(f'No .bib files found in {bib_dir}/')
        sys.exit(0)

    created = updated = skipped = errors = 0

    for bib_path in bib_files:
        section = BIB_SECTION.get(bib_path.stem, '')
        section_dir = papers_dir / section if section else papers_dir
        print(f'Reading {bib_path.name}  →  content/research/{section or ""}')
        try:
            entries = parse_bib_file(bib_path)
        except Exception as e:
            print(f'  ERROR parsing {bib_path.name}: {e}')
            errors += 1
            continue

        for citekey, fields in entries:
            out_dir = section_dir / citekey
            out_file = out_dir / 'index.md'

            if out_file.exists() and not force:
                print(f'  SKIP  {citekey} (already exists; use --force to overwrite)')
                skipped += 1
                continue

            try:
                content = entry_to_markdown(citekey, fields)
            except Exception as e:
                print(f'  ERROR generating {citekey}: {e}')
                errors += 1
                continue

            out_dir.mkdir(parents=True, exist_ok=True)
            existed = out_file.exists()
            out_file.write_text(content, encoding='utf-8')
            verb = 'UPDATE' if existed else 'CREATE'
            rel = out_file.relative_to(project_root / 'content')
            print(f'  {verb} {citekey}  →  content/{rel}')
            if existed:
                updated += 1
            else:
                created += 1

    print(f'\nDone: {created} created, {updated} updated, {skipped} skipped, {errors} errors.')


if __name__ == '__main__':
    main()
