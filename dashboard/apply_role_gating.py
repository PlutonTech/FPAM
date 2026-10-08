#!/usr/bin/env python3
"""
FPAMAS — Apply Role-Gating Attributes to Dashboard Pages
──────────────────────────────────────────────────────────────────────────────
Adds data-require-role="System Admin,Supervisor,Sub-Head,GIS Analyst" to the
"Inspections" and "Form Requests" sidebar nav links (and the dashboard's
"View All" quick-link to Inspections), so app.js's existing applyRoleGates()
hides them from Field Agents.

Safe to run more than once — already-tagged elements are left untouched, and
any HTML file that doesn't contain these specific nav links is simply skipped
with no changes (nothing is assumed about which pages have the sidebar; it
scans every .html file it's pointed at and only touches genuine matches).

USAGE
─────
  python3 apply_role_gating.py /path/to/your/frontend/folder

  Options:
    --dry-run     Show what would change without writing any files
    --role-list   Override the default role list (comma-separated, no spaces
                  around commas needed — quote the whole thing)

EXAMPLES
────────
  python3 apply_role_gating.py .
  python3 apply_role_gating.py ./dashboard --dry-run
  python3 apply_role_gating.py . --role-list "System Admin,Supervisor"
"""

import argparse
import re
import sys
from pathlib import Path

DEFAULT_ROLE_LIST = "System Admin,Supervisor,Sub-Head,GIS Analyst"


def build_patterns(role_list):
    """
    Three independent regex substitutions, each written to match every
    markup variant actually found across this project's pages:
      - plain `class="nav-item"` vs. the self-page's `class="nav-item active"`
      - Inspections already carrying a data-division attribute, or (one page)
        carrying none at all
      - Form Requests never carries any attribute to begin with

    Each substitution is a no-op (produces identical output) if the target
    element already has data-require-role — re-running this script is safe.
    """
    attr = f' data-require-role="{role_list}"'

    patterns = []

    # Inspections nav-item — handles both class="nav-item" and
    # class="nav-item active", and both with/without an existing
    # data-division attribute already present.
    patterns.append((
        re.compile(
            r'(<a class="nav-item(?: active)?" href="inspections\.html")'
            r'(?!\s+data-require-role=)'          # skip if already tagged
            r'((?:\s+data-division="[^"]*")?)'
            r'(>)'
        ),
        lambda m: f'{m.group(1)}{attr}{m.group(2)}{m.group(3)}',
    ))

    # Form Requests nav-item — same class variants, never has any existing
    # attribute in the source markup.
    patterns.append((
        re.compile(
            r'(<a class="nav-item(?: active)?" href="form_requests\.html")'
            r'(?!\s+data-require-role=)'
            r'(>)'
        ),
        lambda m: f'{m.group(1)}{attr}{m.group(2)}',
    ))

    # Dashboard's "View All" quick-link to Inspections.
    patterns.append((
        re.compile(
            r'(<a href="inspections\.html" class="btn btn-ghost btn-xs")'
            r'(?!\s+data-require-role=)'
            r'(>)'
        ),
        lambda m: f'{m.group(1)}{attr}{m.group(2)}',
    ))

    return patterns


def process_file(path: Path, patterns, dry_run: bool):
    original = path.read_text(encoding="utf-8")
    updated = original
    hits = 0

    for regex, replacement in patterns:
        updated, n = regex.subn(replacement, updated)
        hits += n

    if hits == 0:
        return "unchanged", 0

    if not dry_run:
        path.write_text(updated, encoding="utf-8")

    return "updated", hits


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("folder", help="Folder containing your .html pages (scanned recursively)")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing files")
    parser.add_argument("--role-list", default=DEFAULT_ROLE_LIST, help="Comma-separated role list to gate with")
    args = parser.parse_args()

    root = Path(args.folder)
    if not root.is_dir():
        print(f"✗ Not a directory: {root}")
        sys.exit(1)

    patterns = build_patterns(args.role_list)
    html_files = sorted(root.rglob("*.html"))

    if not html_files:
        print(f"No .html files found under {root}")
        sys.exit(0)

    print("──────────────────────────────────────────────────")
    print("  FPAMAS — Role Gating Attribute Applier")
    if args.dry_run:
        print("  MODE: DRY RUN (no files written)")
    print(f"  Role list: {args.role_list}")
    print("──────────────────────────────────────────────────\n")

    updated_count = 0
    total_hits = 0

    for f in html_files:
        status, hits = process_file(f, patterns, args.dry_run)
        rel = f.relative_to(root)
        if status == "updated":
            print(f"  ✓ {rel} — {hits} attribute(s) added")
            updated_count += 1
            total_hits += hits
        # Files with zero matches (no sidebar, or already fully tagged) are
        # silently skipped rather than printed — with dozens of unrelated
        # pages possibly in the same folder (login.html, about.html, etc.)
        # a clean summary is more useful than a wall of "no match" lines.

    print(f"\n{updated_count} file(s) updated, {total_hits} attribute(s) added total.")
    if args.dry_run:
        print("Dry run — no files were actually written. Re-run without --dry-run to apply.")


if __name__ == "__main__":
    main()
