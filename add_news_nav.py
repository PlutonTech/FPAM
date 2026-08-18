#!/usr/bin/env python3
"""
add_news_nav.py

Adds a "News" link into the public-site nav (desktop .nav-links, mobile
.nav-mob, and the footer "Navigate" list) across every public-facing page
EXCEPT news.html itself (which already has it, with the active state set).

Run from the folder containing your frontend HTML files:
    python add_news_nav.py

Targets only the pages confirmed to share the ticker/nav/footer pattern:
index.html, about.html, contact.html, gallery.html, assets.html,
complaint.html. login.html / register.html are intentionally skipped —
they're standalone auth screens without this nav structure. If either of
those DOES have the full public nav on your live site, add its filename to
TARGET_PAGES below and re-run.

Idempotent: safe to re-run — pages that already have the News link are
skipped automatically (checked by presence of href="news.html").
"""

import re
import sys
from pathlib import Path

TARGET_PAGES = [
    "index.html",
    "about.html",
    "contact.html",
    "gallery.html",
    "assets.html",
    "complaint.html",
]

# Insert right after the "About" link in each of the three places, matching
# the established order used across the site: Home, About, News, Contact,
# Gallery, Asset.
DESKTOP_AFTER = re.compile(r'(<a href="about\.html"[^>]*>About</a>)')
DESKTOP_INSERT = '\n      <a href="news.html">News</a>'

MOBILE_AFTER = re.compile(
    r'(<a href="about\.html"\s+onclick="toggleMenu\(\)">About</a>)'
)
MOBILE_INSERT = '<a href="news.html" onclick="toggleMenu()">News</a>'

FOOTER_AFTER = re.compile(
    r'(<li><a href="about\.html">About</a></li>)'
)
FOOTER_INSERT = '<li><a href="news.html">News</a></li>'


def patch_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")

    if 'href="news.html"' in text:
        print(f"  skip  {path.name} — News link already present")
        return False

    original = text

    # Desktop nav-links
    text, n1 = DESKTOP_AFTER.subn(lambda m: m.group(1) + DESKTOP_INSERT, text, count=1)

    # Mobile nav-mob — allow either attribute order (class before/after onclick)
    mobile_pattern = re.compile(
        r'(<a href="about\.html"[^>]*onclick="toggleMenu\(\)"[^>]*>About</a>)'
    )
    text, n2 = mobile_pattern.subn(lambda m: m.group(1) + MOBILE_INSERT, text, count=1)

    # Footer "Navigate" list
    text, n3 = FOOTER_AFTER.subn(lambda m: m.group(1) + FOOTER_INSERT, text, count=1)

    if text == original:
        print(f"  WARN  {path.name} — no matches found, nothing changed (check patterns by hand)")
        return False

    path.write_text(text, encoding="utf-8")
    print(f"  OK    {path.name} — desktop:{n1} mobile:{n2} footer:{n3}")
    return True


def main():
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
    print(f"Patching public pages in: {root.resolve()}\n")

    changed = 0
    for name in TARGET_PAGES:
        p = root / name
        if not p.exists():
            print(f"  MISS  {name} — file not found, skipped")
            continue
        if patch_file(p):
            changed += 1

    print(f"\nDone — {changed} file(s) updated.")
    print("Verify each page's nav bar renders correctly before deploying.")


if __name__ == "__main__":
    main()
