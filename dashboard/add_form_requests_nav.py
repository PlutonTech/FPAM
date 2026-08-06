#!/usr/bin/env python3
"""
add_form_requests_nav.py

Adds a "Form Requests" sidebar link across your internal dashboard pages,
right after the "Users" nav-item — matching the sidebar structure confirmed
in users.html:

    <a class="nav-item active" href="users.html">...Users...</a>

Run from your dashboard/ folder (where dashboard.html, users.html, me.html
etc. all live):
    python add_form_requests_nav.py

By default this targets every .html file in the current directory except
form_requests.html and mda_portal.html themselves (the former already has
its own sidebar with this link active; the latter is the external MDA
portal and intentionally has no internal sidebar at all).

Idempotent — safe to re-run. Skips any file that already links to
form_requests.html.
"""

import re
import sys
from pathlib import Path

EXCLUDE = {'form_requests.html', 'mda_portal.html'}

# Matches the Users nav-item line regardless of whether it has 'active' class
# or the nav-badge span (it varies slightly page to page — active only shows
# on users.html itself).
USERS_NAV_PATTERN = re.compile(
    r'(<a class="nav-item(?:\s+active)?" href="users\.html">.*?</a>)'
)

NEW_LINK = '\n    <a class="nav-item" href="form_requests.html"><i class="fa-solid fa-file-circle-check"></i>Form Requests</a>'


def patch_file(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')

    if 'href="form_requests.html"' in text:
        print(f"  skip  {path.name} — link already present")
        return False

    new_text, n = USERS_NAV_PATTERN.subn(lambda m: m.group(1) + NEW_LINK, text, count=1)

    if n == 0:
        print(f"  WARN  {path.name} — Users nav-item pattern not found, nothing changed (add the link by hand for this page)")
        return False

    path.write_text(new_text, encoding='utf-8')
    print(f"  OK    {path.name}")
    return True


def main():
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.')
    print(f"Patching dashboard pages in: {root.resolve()}\n")

    changed = 0
    html_files = sorted(root.glob('*.html'))
    if not html_files:
        print("No .html files found in this directory — are you running this from the dashboard/ folder?")
        return

    for p in html_files:
        if p.name in EXCLUDE:
            continue
        if patch_file(p):
            changed += 1

    print(f"\nDone — {changed} file(s) updated.")
    print("Open a couple of pages in the browser to confirm the sidebar link renders and navigates correctly.")


if __name__ == '__main__':
    main()
