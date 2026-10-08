"""
fix_all_navbars.py — FPAMAS
Replaces the entire <nav class="sidebar-nav"> block on every app HTML page with
the canonical, up-to-date nav that includes:
  - data-division attributes on scoped pages
  - Divisions section (M&E active, others dimmed)
  - Guidelines link under System
  - No duplicate M&E links

Usage (run from your frontend HTML folder):
    python fix_all_navbars.py              # dry run — shows what will change
    python fix_all_navbars.py --fix        # applies in place
    python fix_all_navbars.py --fix --bak  # backs up .bak before writing
"""

import re, sys, shutil
from pathlib import Path

DRY_RUN = '--fix' not in sys.argv
BACKUP  = '--bak' in sys.argv

# ── App pages and which href is "active" for each ─────────────────────────────
APP_PAGES = {
    'dashboard.html':   'dashboard.html',
    'map.html':         'map.html',
    'assets.html':      'assets.html',
    'capture.html':     'capture.html',
    'approvals.html':   'approvals.html',
    'inspections.html': 'inspections.html',
    'me.html':          'me.html',
    'analytics.html':   'analytics.html',
    'users.html':       'users.html',
    'ocr.html':         'ocr.html',
    'excel.html':       'excel.html',
    'filedb.html':      'filedb.html',
    'audit.html':       'audit.html',
    'settings.html':    'settings.html',
    'asset-view.html':  'assets.html',   # asset-view marks Asset Registry active
    'guidelines.html':  'guidelines.html',
}

def canonical_nav(active_href: str) -> str:
    """Build the full canonical sidebar nav block for a given active page."""

    def item(href, icon, label, extra='', badge=''):
        active = ' active' if href == active_href else ''
        extra_str  = (' ' + extra) if extra else ''
        badge_str  = f'<span class="nav-badge" id="{badge}">0</span>' if badge else ''
        return (
            f'    <a class="nav-item{active}" href="{href}"{extra_str}>'
            f'<i class="fa-solid {icon}"></i>{label}{badge_str}</a>'
        )

    def section(label):
        return f'    <div class="nav-section">{label}</div>'

    def dim(href, icon, label, division):
        """Dimmed / coming-soon nav item for unbuilt division pages."""
        return (
            f'    <a class="nav-item" href="{href}" data-division="{division}" '
            f'style="opacity:.45;pointer-events:none;cursor:default" title="Coming Soon">'
            f'<i class="fa-solid {icon}"></i>{label}'
            f'<span style="font-size:9px;background:rgba(255,255,255,.12);'
            f'padding:1px 6px;border-radius:4px;margin-left:auto">Soon</span></a>'
        )

    lines = [
        '  <nav class="sidebar-nav">',

        # ── Platform ──────────────────────────────────────────────────────────
        section('Platform'),
        item('dashboard.html',   'fa-gauge-high',          'Dashboard',
             badge='nb-assets'),
        item('map.html',         'fa-map',                  'Live Map'),
        item('assets.html',      'fa-database',             'Asset Registry',
             extra='data-division="Assets &amp; Condition"'),

        # ── Management ────────────────────────────────────────────────────────
        section('Management'),
        item('capture.html',     'fa-location-crosshairs',  'Field Capture',
             extra='data-division="Assets &amp; Condition"'),
        item('approvals.html',   'fa-stamp',                'Approvals',
             extra='data-require-role="Sub-Head,Supervisor,System Admin"'),
        item('inspections.html', 'fa-clipboard-check',      'Inspections',
             extra='data-division="Assets &amp; Condition"'),
        item('me.html',          'fa-chart-line',           'M&amp;E Reports',
             extra='data-division="Monitoring &amp; Evaluation"'),
        item('analytics.html',   'fa-chart-bar',            'Analytics'),
        item('users.html',       'fa-users',                'Users',
             badge='nb-users'),

        # ── Divisions ─────────────────────────────────────────────────────────
        section('Divisions'),
        item('assets.html',      'fa-database',             'Assets &amp; Condition',
             extra='data-division="Assets &amp; Condition"'),
        item('me.html',          'fa-chart-line',           'Monitoring &amp; Evaluation',
             extra='data-division="Monitoring &amp; Evaluation"'),
        dim('#', 'fa-drafting-compass', 'Planning &amp; Design',
            'Planning &amp; Design'),
        dim('#', 'fa-helmet-safety',    'Rehabilitation &amp; Restoration',
            'Rehabilitation &amp; Restoration'),
        dim('#', 'fa-chalkboard-user',  'Training &amp; Maintenance',
            'Building Training &amp; Maintenance'),

        # ── Data Tools ────────────────────────────────────────────────────────
        section('Data Tools'),
        item('ocr.html',         'fa-file-magnifying-glass','OCR Scanner'),
        item('excel.html',       'fa-file-excel',           'Excel Import'),
        item('filedb.html',      'fa-folder-open',          'File Database'),

        # ── System ────────────────────────────────────────────────────────────
        section('System'),
        item('audit.html',       'fa-clock-rotate-left',    'Audit Log'),
        item('settings.html',    'fa-sliders',              'Settings'),
        item('guidelines.html',  'fa-book-open',            'Guidelines'),

        '  </nav>',
    ]
    return '\n'.join(lines)


# Match the entire <nav class="sidebar-nav">…</nav> block
NAV_RE = re.compile(
    r'<nav\s+class=["\']sidebar-nav["\']>.*?</nav>',
    re.DOTALL | re.IGNORECASE,
)


def process(path: Path, active: str):
    html = path.read_text(encoding='utf-8', errors='replace')
    original = html

    matches = NAV_RE.findall(html)
    if not matches:
        return False, ['  ⚠ No sidebar-nav block found — skipped']

    new_nav = canonical_nav(active)

    # Replace first occurrence, remove any extras (handles duplicates)
    first = True
    def replace(m):
        nonlocal first
        if first:
            first = False
            return new_nav
        return ''   # removes duplicates

    new_html = NAV_RE.sub(replace, html)
    changed  = new_html != original
    log      = []

    if not changed:
        log.append('  ✅ Nav already up to date')
        return False, log

    log.append(f'  → Nav replaced ({len(matches)} block(s) found, duplicates removed)')

    # Verify key links are present
    for check in ['guidelines.html', 'me.html', 'nav-section">Divisions']:
        if check not in new_html:
            log.append(f'  ✗ Missing after replace: {check}')

    if not DRY_RUN:
        if BACKUP:
            shutil.copy2(path, path.with_suffix('.bak'))
        path.write_text(new_html, encoding='utf-8')
        log.append('  ✔ Saved')
    else:
        log.append('  ℹ (dry run — not saved)')

    return changed, log


def main():
    pages = [(Path(name), active)
             for name, active in APP_PAGES.items()
             if Path(name).exists()]

    missing = [name for name in APP_PAGES if not Path(name).exists()]

    mode = 'DRY RUN' if DRY_RUN else 'FIX MODE'
    print(f'\n FPAMAS — Fix All Navbars [{mode}]')
    print(f' {len(pages)} pages found'
          + (f', {len(missing)} missing: {", ".join(missing)}' if missing else ''))
    print('─' * 60)

    n_changed = 0
    for path, active in sorted(pages, key=lambda x: x[0].name):
        changed, log = process(path, active)
        icon = '🔧' if changed else '✅'
        print(f'\n{icon}  {path.name}  (active: {active})')
        for line in log:
            print(line)
        if changed:
            n_changed += 1

    print('\n' + '─' * 60)
    print(f' Pages updated: {n_changed}/{len(pages)}')
    if DRY_RUN and n_changed:
        print('\n Run with --fix to apply:')
        print('   python fix_all_navbars.py --fix')
        print('   python fix_all_navbars.py --fix --bak\n')
    elif not DRY_RUN:
        print(f'\n Done. Hard-refresh your browser (Ctrl+Shift+R) to see changes.\n')


if __name__ == '__main__':
    main()
