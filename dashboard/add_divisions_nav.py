"""
add_divisions_nav.py — FPAMAS
Adds a "Divisions" section to the sidebar nav of every app HTML page.

The section shows all 5 FPAM divisions. Built modules link to their page.
Unbuilt modules are dimmed and non-clickable (will activate as they're built).

Usage (run from your frontend HTML folder):
    python add_divisions_nav.py              # dry run
    python add_divisions_nav.py --fix        # apply changes
    python add_divisions_nav.py --fix --bak  # apply with backups
"""

import os, re, sys, shutil
from pathlib import Path

DRY_RUN = '--fix' not in sys.argv
BACKUP  = '--bak' in sys.argv

# ── Pages that have the app sidebar ──────────────────────────────────────────
APP_PAGES = {
    'dashboard.html', 'map.html', 'assets.html', 'capture.html',
    'approvals.html', 'inspections.html', 'me.html', 'analytics.html',
    'users.html', 'ocr.html', 'excel.html', 'filedb.html',
    'audit.html', 'settings.html', 'asset-view.html',
}

# ── Canonical nav structure (same for all pages) ──────────────────────────────
# Each item: (href, icon, label, data_division, built)
# built=False → dimmed, non-clickable, shows "Coming Soon"
DIVISIONS = [
    ('me.html',  'fa-chart-line',      'Monitoring &amp; Evaluation',   'Monitoring &amp; Evaluation',          True),
    ('#',        'fa-drafting-compass', 'Planning &amp; Design',          'Planning &amp; Design',               False),
    ('#',        'fa-helmet-safety',    'Rehabilitation &amp; Restoration','Rehabilitation &amp; Restoration',    False),
    ('#',        'fa-chalkboard-user',  'Training &amp; Maintenance',     'Building Training &amp; Maintenance', False),
    ('assets.html','fa-database',       'Assets &amp; Condition',         'Assets &amp; Condition',              True),
]

def build_divisions_block():
    lines = ['    <div class="nav-section">Divisions</div>']
    for href, icon, label, division, built in DIVISIONS:
        style = '' if built else ' style="opacity:.45;pointer-events:none;cursor:default"'
        title = '' if built else ' title="Coming Soon"'
        suffix = '' if built else ' <span style="font-size:9px;background:rgba(255,255,255,.12);padding:1px 6px;border-radius:4px;margin-left:auto">Soon</span>'
        lines.append(
            f'    <a class="nav-item" href="{href}" data-division="{division}"{style}{title}>'
            f'<i class="fa-solid {icon}"></i>{label}{suffix}</a>'
        )
    return '\n'.join(lines)

DIVISIONS_BLOCK = build_divisions_block()

# Marker we inject so we don't add the block twice
MARKER = 'data-divisions-nav="1"'

# ── Find insertion point ──────────────────────────────────────────────────────
# Insert BEFORE the "Data Tools" nav section
DATA_TOOLS_RE = re.compile(
    r'([ \t]*<div\s+class=["\']nav-section["\']>Data Tools</div>)',
    re.IGNORECASE
)

def process_file(path: Path):
    html    = path.read_text(encoding='utf-8', errors='replace')
    changed = False
    log     = []

    # Already patched?
    if MARKER in html:
        log.append('  ✅ Already has Divisions nav — skipped')
        return False, log

    # Find insertion point
    m = DATA_TOOLS_RE.search(html)
    if not m:
        log.append('  ⚠ Could not find "Data Tools" nav section — skipped')
        return False, log

    # Build the block with the marker attribute on the first element
    block = f'\n    <div class="nav-section" {MARKER}>Divisions</div>\n'
    for href, icon, label, division, built in DIVISIONS:
        style = '' if built else ' style="opacity:.45;pointer-events:none;cursor:default"'
        title = '' if built else ' title="Coming Soon"'
        suffix = '' if built else ' <span style="font-size:9px;background:rgba(255,255,255,.12);padding:1px 6px;border-radius:4px;margin-left:auto">Soon</span>'
        block += (
            f'    <a class="nav-item" href="{href}" data-division="{division}"{style}{title}>'
            f'<i class="fa-solid {icon}"></i>{label}{suffix}</a>\n'
        )

    # Insert before "Data Tools"
    new_html = html[:m.start()] + block + html[m.start():]
    changed  = True
    log.append('  → Divisions section inserted before Data Tools')

    if not DRY_RUN:
        if BACKUP:
            shutil.copy2(path, path.with_suffix('.bak'))
        path.write_text(new_html, encoding='utf-8')
        log.append('  ✔ Saved')
    else:
        log.append('  ℹ (dry run — not saved)')

    return changed, log


def main():
    pages = sorted([p for p in Path('.').glob('*.html') if p.name in APP_PAGES])

    if not pages:
        print('\nNo app HTML pages found. cd into your frontend HTML folder first.\n')
        sys.exit(1)

    mode = 'DRY RUN' if DRY_RUN else 'FIX MODE'
    print(f'\n FPAMAS — Add Divisions Nav [{mode}]')
    print(f' {len(pages)} pages\n' + '─' * 55)

    n_changed = 0
    for p in pages:
        changed, log = process_file(p)
        icon = '🔧' if changed else '✅'
        print(f'\n{icon}  {p.name}')
        for line in log:
            print(line)
        if changed:
            n_changed += 1

    print('\n' + '─' * 55)
    print(f' Pages updated: {n_changed}/{len(pages)}')
    if DRY_RUN and n_changed:
        print(f'\n Run with --fix to apply:')
        print(f'   python add_divisions_nav.py --fix')
        print(f'   python add_divisions_nav.py --fix --bak\n')
    elif not DRY_RUN:
        print(f'\n Done. Refresh your browser to see changes.\n')


if __name__ == '__main__':
    main()
