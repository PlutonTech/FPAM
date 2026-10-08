"""
fix_navbars.py — FPAMAS
Ensures every app HTML page has the correct, up-to-date sidebar nav.

Usage:
    python fix_navbars.py                  # dry-run (shows what would change)
    python fix_navbars.py --fix            # applies changes in-place
    python fix_navbars.py --fix --backup   # backs up each file before changing

Run from the folder that contains your HTML files, e.g.:
    cd C:/Users/Hp/Downloads/fpam/FPAMAS-frontend
    python fix_navbars.py --fix
"""

import os
import re
import sys
import shutil
from pathlib import Path

# ── CLI args ──────────────────────────────────────────────────────────────────
DRY_RUN = '--fix' not in sys.argv
BACKUP  = '--backup' in sys.argv

# ── Canonical nav items ───────────────────────────────────────────────────────
# Each entry: (href, icon, label, extra_attrs, badge_id)
# extra_attrs: any additional HTML attributes on the <a> tag
# badge_id: optional id for the nav-badge span inside the link

NAV_ITEMS = [
    # ── Platform ──
    ('__section__', 'Platform'),
    ('dashboard.html',   'fa-gauge-high',          'Dashboard',      '',                                              'nb-assets'),
    ('map.html',         'fa-map',                  'Live Map',       '',                                              ''),
    ('assets.html',      'fa-database',             'Asset Registry', 'data-division="Assets &amp; Condition"',        ''),
    # ── Management ──
    ('__section__', 'Management'),
    ('capture.html',     'fa-location-crosshairs',  'Field Capture',  'data-division="Assets &amp; Condition"',        ''),
    ('approvals.html',   'fa-stamp',                'Approvals',      'data-require-role="Sub-Head,Supervisor,System Admin"', ''),
    ('inspections.html', 'fa-clipboard-check',      'Inspections',    'data-division="Assets &amp; Condition"',        ''),
    ('me.html',          'fa-chart-line',           'M&amp;E Reports','data-division="Monitoring &amp; Evaluation"',   ''),
    ('analytics.html',   'fa-chart-bar',            'Analytics',      '',                                              ''),
    ('users.html',       'fa-users',                'Users',          '',                                              'nb-users'),
    # ── Data Tools ──
    ('__section__', 'Data Tools'),
    ('ocr.html',         'fa-file-magnifying-glass','OCR Scanner',    '',                                              ''),
    ('excel.html',       'fa-file-excel',           'Excel Import',   '',                                              ''),
    ('filedb.html',      'fa-folder-open',          'File Database',  '',                                              ''),
    # ── System ──
    ('__section__', 'System'),
    ('audit.html',       'fa-clock-rotate-left',    'Audit Log',      '',                                              ''),
    ('settings.html',    'fa-sliders',              'Settings',       '',                                              ''),
]

# ── Canonical sidebar bottom (user card) ──────────────────────────────────────
SIDEBAR_BOTTOM = '''  <div class="sidebar-bottom">
    <div class="user-card-sb">
      <div class="user-av" id="sb-user-initials">A</div>
      <div style="flex:1;min-width:0">
        <div class="user-nm" id="sb-user-name">Loading\u2026</div>
        <div class="user-rl" id="sb-user-role">\u2014</div>
        <div id="sb-user-division" style="font-size:9px;color:rgba(255,255,255,.35);margin-top:2px;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>
      </div>
      <div style="display:flex;gap:4px">
        <button class="icon-btn" onclick="toggleTheme()" title="Toggle theme"><i class="fa-solid fa-circle-half-stroke"></i></button>
        <button class="icon-btn" onclick="doLogout()" title="Logout"><i class="fa-solid fa-right-from-bracket"></i></button>
      </div>
    </div>
  </div>'''

def build_nav_html(active_href: str) -> str:
    """Build the canonical <nav class="sidebar-nav">…</nav> block."""
    lines = ['  <nav class="sidebar-nav">']
    for item in NAV_ITEMS:
        if item[0] == '__section__':
            lines.append(f'    <div class="nav-section">{item[1]}</div>')
            continue

        href, icon, label, extra, badge_id = item
        active_cls = ' active' if href == active_href else ''
        extra_str  = (' ' + extra) if extra else ''
        badge_str  = f'<span class="nav-badge" id="{badge_id}">0</span>' if badge_id else ''
        lines.append(
            f'    <a class="nav-item{active_cls}" href="{href}"{extra_str}>'
            f'<i class="fa-solid {icon}"></i>{label}{badge_str}</a>'
        )

    lines.append('  </nav>')
    return '\n'.join(lines)


def build_full_sidebar(active_href: str) -> str:
    nav   = build_nav_html(active_href)
    return nav + '\n' + SIDEBAR_BOTTOM


# ── Patterns to find existing nav/sidebar-bottom blocks ──────────────────────
# Matches <nav class="sidebar-nav">…</nav>  (multiline)
NAV_RE = re.compile(
    r'[ \t]*<nav\s+class=["\']sidebar-nav["\']>.*?</nav>',
    re.DOTALL | re.IGNORECASE,
)

# Matches <div class="sidebar-bottom">…</div> (multiline)
BOTTOM_RE = re.compile(
    r'[ \t]*<div\s+class=["\']sidebar-bottom["\']>.*?</div>\s*\n?\s*</aside>',
    re.DOTALL | re.IGNORECASE,
)

# ── Pages to process ──────────────────────────────────────────────────────────
# Only these pages have the app sidebar (not public-facing pages)
APP_PAGES = {
    'dashboard.html', 'map.html', 'assets.html', 'capture.html',
    'approvals.html', 'inspections.html', 'me.html', 'analytics.html',
    'users.html', 'ocr.html', 'excel.html', 'filedb.html',
    'audit.html', 'settings.html', 'asset-view.html',
}


def process_file(path: Path) -> tuple[bool, list[str]]:
    """
    Returns (changed, issues) where issues is a list of human-readable messages.
    If DRY_RUN, nothing is written.
    """
    issues  = []
    changed = False
    html    = path.read_text(encoding='utf-8', errors='replace')
    name    = path.name
    active  = name  # active link matches the file's own name

    new_html = html

    # ── 1. Fix / inject <nav class="sidebar-nav"> ─────────────────────────────
    nav_matches = NAV_RE.findall(html)
    correct_nav = build_nav_html(active)

    if not nav_matches:
        issues.append('  ✗ MISSING sidebar-nav block')
    else:
        if len(nav_matches) > 1:
            issues.append(f'  ⚠ {len(nav_matches)} sidebar-nav blocks found (duplicates)')

        # Check each nav item is present
        for item in NAV_ITEMS:
            if item[0] == '__section__':
                continue
            href = item[0]
            if f'href="{href}"' not in html:
                issues.append(f'  ✗ Missing nav link: {href}')
            elif href == 'me.html' and 'me.html' not in nav_matches[0]:
                issues.append(f'  ✗ me.html link missing from nav block')

        # Replace all nav blocks with canonical version
        first = True
        def replace_nav(m):
            nonlocal first
            if first:
                first = False
                return correct_nav
            return ''  # remove duplicates
        new_html_attempt = NAV_RE.sub(replace_nav, new_html)
        if new_html_attempt != new_html:
            issues.append('  → Nav block updated')
            changed = True
            new_html = new_html_attempt

    # ── 2. Fix sidebar-bottom (user card) ────────────────────────────────────
    bottom_matches = BOTTOM_RE.findall(html)
    if not bottom_matches:
        issues.append('  ⚠ sidebar-bottom block not found (may use different structure)')
    else:
        correct_bottom = SIDEBAR_BOTTOM + '\n</aside>'
        new_html_attempt = BOTTOM_RE.sub(correct_bottom, new_html)
        if new_html_attempt != new_html:
            issues.append('  → sidebar-bottom (user card) updated')
            changed = True
            new_html = new_html_attempt

    # ── 3. Check sb-user-division div exists ─────────────────────────────────
    if 'sb-user-division' not in html:
        issues.append('  ✗ sb-user-division element missing in user card')

    # ── 4. Write if changed ───────────────────────────────────────────────────
    if changed and not DRY_RUN:
        if BACKUP:
            shutil.copy2(path, path.with_suffix('.html.bak'))
        path.write_text(new_html, encoding='utf-8')
        issues.append('  ✔ File saved')

    return changed, issues


def main():
    cwd   = Path('.')
    pages = sorted([f for f in cwd.glob('*.html') if f.name in APP_PAGES])

    if not pages:
        print('No app HTML pages found in current directory.')
        print('Run this script from the folder containing your HTML files.')
        sys.exit(1)

    mode = 'DRY RUN (no files changed)' if DRY_RUN else 'FIX MODE'
    print(f'\n FPAMAS — Navbar Checker [{mode}]')
    print(f' Found {len(pages)} app pages\n')
    print('─' * 60)

    total_changed = 0
    total_issues  = 0

    for path in pages:
        changed, issues = process_file(path)
        status = '🔧 NEEDS FIX' if changed else '✅ OK'
        if not issues:
            status = '✅ OK'
        print(f'\n{status}  {path.name}')
        for issue in issues:
            print(issue)
        if changed:
            total_changed += 1
        total_issues += len([i for i in issues if '✗' in i])

    print('\n' + '─' * 60)
    print(f'\n Summary:')
    print(f'   Pages checked : {len(pages)}')
    print(f'   Pages to fix  : {total_changed}')
    print(f'   Issues found  : {total_issues}')

    if DRY_RUN and total_changed:
        print(f'\n Run with --fix to apply changes:')
        print(f'   python fix_navbars.py --fix')
        print(f'   python fix_navbars.py --fix --backup   (keeps .html.bak copies)\n')
    elif not DRY_RUN:
        print(f'\n All done. Restart Live Server to see changes.\n')


if __name__ == '__main__':
    main()
