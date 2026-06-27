"""
FPAM Asset Image Scraper
========================
Reads the FPAM Excel inventory, geocodes each asset address,
searches for images via Wikipedia and Wikimedia Commons,
downloads and saves them, then outputs:

  output/
  ├── images/
  │   └── <asset_id>.jpg
  ├── assets.json          ← MongoDB-ready documents
  └── assets_summary.csv   ← Quick-view spreadsheet

Usage:
    pip install requests pandas xlrd Pillow geopy openpyxl
    python fpam_scraper.py

    # Optional: process only N rows (for testing)
    python fpam_scraper.py --limit 50

    # Point to a different Excel file
    python fpam_scraper.py --file path/to/inventory.xls
"""

import os
import re
import io
import sys
import csv
import json
import time
import hashlib
import argparse
import logging
from datetime import datetime
from pathlib import Path

import requests
import pandas as pd
from PIL import Image

# ── CONFIGURATION ─────────────────────────────────────────────────────────────

EXCEL_FILE   = "LOWER_VERSION_Inventory_of_Public_Buildings.xls"
OUTPUT_DIR   = Path("output")
IMAGE_DIR    = OUTPUT_DIR / "images"
JSON_OUT     = OUTPUT_DIR / "assets.json"
CSV_OUT      = OUTPUT_DIR / "assets_summary.csv"

DELAY_SEC    = 0.8          # polite delay between HTTP requests
IMG_MAX_PX   = 1200         # max image dimension (longest side)
IMG_QUALITY  = 88           # JPEG quality
MIN_IMG_W    = 200          # skip images smaller than this
MIN_IMG_H    = 150

# Nominatim geocoding (OpenStreetMap) – no API key needed
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_HDR = {
    "User-Agent": "FPAM-AssetScraper/1.0 (fpam.housing.gov.ng)"
}

# Wikipedia API
WIKI_SEARCH_URL = "https://en.wikipedia.org/w/api.php"
WIKI_IMG_URL    = "https://en.wikipedia.org/w/api.php"

# Wikimedia Commons search
COMMONS_URL = "https://commons.wikimedia.org/w/api.php"

DOWNLOAD_HDR = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 Chrome/124 Safari/537.36")
}

# ── LOGGING ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(OUTPUT_DIR / "scraper.log" if OUTPUT_DIR.exists()
                            else "scraper.log", encoding="utf-8")
    ]
)
log = logging.getLogger("fpam")

# ── HELPERS ───────────────────────────────────────────────────────────────────

def clean(v):
    """Normalise a cell value to clean string or None."""
    if v is None or (isinstance(v, float) and str(v) == "nan"):
        return None
    s = str(v).strip().strip("\xa0")
    return s if s and s.lower() not in ("nan", "none", "-", "n/a") else None


def asset_id(row_data):
    """Deterministic ID from MDA + address."""
    key = f"{row_data.get('mda','')}-{row_data.get('address','')}".lower()
    return "asset_" + hashlib.md5(key.encode()).hexdigest()[:10]


def safe_filename(text, max_len=60):
    """Turn arbitrary text into a safe filename fragment."""
    s = re.sub(r"[^a-zA-Z0-9]+", "_", text).strip("_").lower()
    return s[:max_len]


# ── GEOCODING ─────────────────────────────────────────────────────────────────

_geo_cache = {}

def geocode(address, lga, state, country="Nigeria"):
    """
    Try progressively broader queries until we get a result.
    Returns (lat, lng) floats or (None, None).
    """
    queries = []
    if address:
        queries.append(f"{address}, {state}, {country}")
    if lga and state:
        queries.append(f"{lga}, {state}, {country}")
    if state:
        queries.append(f"{state}, {country}")

    for q in queries:
        if q in _geo_cache:
            return _geo_cache[q]
        try:
            r = requests.get(
                NOMINATIM_URL,
                params={"q": q, "format": "json", "limit": 1, "countrycodes": "ng"},
                headers=NOMINATIM_HDR,
                timeout=10
            )
            results = r.json()
            if results:
                lat = float(results[0]["lat"])
                lng = float(results[0]["lon"])
                _geo_cache[q] = (lat, lng)
                time.sleep(0.3)   # Nominatim rate-limit policy
                return lat, lng
        except Exception:
            pass
        time.sleep(0.3)

    _geo_cache[q] = (None, None)
    return None, None


# ── IMAGE SEARCH ──────────────────────────────────────────────────────────────

def wikipedia_image(query):
    """Search Wikipedia for query, return lead image URL or None."""
    try:
        # Step 1: search
        r = requests.get(
            WIKI_SEARCH_URL,
            params={"action": "query", "list": "search",
                    "srsearch": query, "srlimit": 1, "format": "json"},
            headers=DOWNLOAD_HDR, timeout=12
        )
        hits = r.json().get("query", {}).get("search", [])
        if not hits:
            return None
        title = hits[0]["title"]

        # Step 2: get lead image
        r2 = requests.get(
            WIKI_IMG_URL,
            params={"action": "query", "titles": title,
                    "prop": "pageimages", "piprop": "original",
                    "format": "json"},
            headers=DOWNLOAD_HDR, timeout=12
        )
        pages = r2.json().get("query", {}).get("pages", {})
        for _, page in pages.items():
            src = page.get("original", {}).get("source", "")
            if src and not src.lower().endswith(".svg"):
                return src
    except Exception:
        pass
    return None


def commons_image(query):
    """Search Wikimedia Commons for a relevant photo."""
    try:
        r = requests.get(
            COMMONS_URL,
            params={
                "action": "query",
                "list": "search",
                "srnamespace": "6",   # File namespace
                "srsearch": query + " filetype:bitmap",
                "srlimit": 3,
                "format": "json"
            },
            headers=DOWNLOAD_HDR, timeout=12
        )
        hits = r.json().get("query", {}).get("search", [])
        for hit in hits:
            title = hit["title"]  # e.g. "File:Foo.jpg"
            # get image URL from Commons
            r2 = requests.get(
                COMMONS_URL,
                params={"action": "query", "titles": title,
                        "prop": "imageinfo", "iiprop": "url",
                        "format": "json"},
                headers=DOWNLOAD_HDR, timeout=12
            )
            pages = r2.json().get("query", {}).get("pages", {})
            for _, pg in pages.items():
                ii = pg.get("imageinfo", [{}])
                url = ii[0].get("url", "") if ii else ""
                if url and not url.lower().endswith(".svg"):
                    return url
    except Exception:
        pass
    return None


def find_image(mda, address, lga, state):
    """
    Try multiple search strategies to find a relevant image.
    Returns image URL string or None.
    """
    strategies = []

    # Most specific → least specific
    if mda and state:
        strategies.append(f"{mda} {state} Nigeria")
    if mda:
        strategies.append(f"{mda} Nigeria")
    if address and state:
        strategies.append(f"{address} {state} Nigeria government building")
    if lga and state:
        strategies.append(f"{lga} {state} Nigeria government building")
    if state:
        strategies.append(f"{state} Nigeria government secretariat")

    for q in strategies:
        url = wikipedia_image(q)
        if url:
            return url
        url = commons_image(q)
        if url:
            return url
        time.sleep(DELAY_SEC * 0.5)

    return None


# ── IMAGE DOWNLOAD & PROCESS ──────────────────────────────────────────────────

def download_image(url, dest_path):
    """
    Download image from URL, resize if needed, save as JPEG.
    Returns True on success.
    """
    try:
        r = requests.get(url, headers=DOWNLOAD_HDR, timeout=30)
        if r.status_code != 200:
            return False

        img = Image.open(io.BytesIO(r.content)).convert("RGB")

        # Skip tiny images
        if img.width < MIN_IMG_W or img.height < MIN_IMG_H:
            return False

        # Resize if too large
        w, h = img.size
        if max(w, h) > IMG_MAX_PX:
            ratio = IMG_MAX_PX / max(w, h)
            img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

        img.save(dest_path, "JPEG", quality=IMG_QUALITY, optimize=True)
        return True
    except Exception:
        return False


# ── MAIN ──────────────────────────────────────────────────────────────────────

def load_excel(path):
    """Load and normalise the FPAM Excel file."""
    log.info(f"Loading: {path}")
    df = pd.read_excel(path, engine="xlrd", header=2)
    df.columns = ["sn", "mda", "purpose", "state", "lga",
                  "address", "landmark", "year", "valuation", "gps"]

    # Drop empty/header rows
    df = df[df["mda"].notna()].copy()
    df = df[~df["mda"].astype(str).str.startswith("MDA")].copy()
    df = df[~df["mda"].astype(str).str.upper().str.startswith("BUILDING")].copy()
    df = df.reset_index(drop=True)

    log.info(f"Loaded {len(df)} asset rows from {df['mda'].nunique()} unique MDAs")
    return df


def process(df, limit=None):
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)

    records = []
    total   = len(df) if limit is None else min(limit, len(df))
    success = 0
    no_img  = 0
    no_geo  = 0

    log.info(f"Processing {total} assets…")

    for idx, row in df.head(total).iterrows():
        mda      = clean(row.get("mda"))
        purpose  = clean(row.get("purpose"))
        state    = clean(row.get("state"))
        lga      = clean(row.get("lga"))
        address  = clean(row.get("address"))
        landmark = clean(row.get("landmark"))
        year     = clean(row.get("year"))
        valuation= clean(row.get("valuation"))

        if not mda:
            continue

        # Build record skeleton
        rec = {
            "_id":           None,        # filled below
            "sn":            int(row["sn"]) if str(row.get("sn","")).isdigit() else None,
            "mda":           mda,
            "purpose":       purpose or "Office Building",
            "state":         state,
            "lga":           lga,
            "address":       address,
            "landmark":      landmark,
            "year_commissioned": year,
            "valuation":     valuation,
            "coordinates":   {"lat": None, "lng": None},
            "image": {
                "filename":  None,
                "source_url": None,
                "width":     None,
                "height":    None,
                "scraped_at": None,
            },
            "metadata": {
                "scraped_at":    datetime.utcnow().isoformat() + "Z",
                "geocoded":      False,
                "image_found":   False,
                "search_queries": []
            }
        }
        rec["_id"] = asset_id(rec)

        num = idx + 1
        log.info(f"[{num:>4}/{total}] {(mda or '')[:48]:<48}  {(state or '')}")

        # ── GEOCODE ──────────────────────────────────────────────────────────
        lat, lng = geocode(address, lga, state)
        if lat and lng:
            rec["coordinates"] = {"lat": lat, "lng": lng}
            rec["metadata"]["geocoded"] = True
        else:
            no_geo += 1
            log.debug(f"         No coordinates found")

        # ── IMAGE SEARCH ─────────────────────────────────────────────────────
        img_url = find_image(mda, address, lga, state)

        if img_url:
            fname = rec["_id"] + ".jpg"
            dest  = IMAGE_DIR / fname
            ok    = download_image(img_url, dest)

            if ok:
                # Read back dimensions
                try:
                    with Image.open(dest) as im:
                        w, h = im.size
                except Exception:
                    w = h = None

                rec["image"] = {
                    "filename":   fname,
                    "source_url": img_url,
                    "width":      w,
                    "height":     h,
                    "scraped_at": datetime.utcnow().isoformat() + "Z",
                }
                rec["metadata"]["image_found"] = True
                success += 1
                log.info(f"         ✓ image  {w}×{h}  → {fname}")
            else:
                no_img += 1
                log.debug(f"         ✗ image download failed")
        else:
            no_img += 1
            log.debug(f"         ✗ no image found")

        records.append(rec)
        time.sleep(DELAY_SEC)

    return records, success, no_geo, no_img


def write_outputs(records):
    # ── JSON (MongoDB-ready) ──────────────────────────────────────────────────
    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2, default=str)
    log.info(f"JSON written → {JSON_OUT}  ({len(records)} documents)")

    # ── CSV summary ───────────────────────────────────────────────────────────
    csv_fields = [
        "_id","sn","mda","purpose","state","lga","address","landmark",
        "year_commissioned","valuation","lat","lng","image_filename","image_source_url"
    ]
    with open(CSV_OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=csv_fields, extrasaction="ignore")
        w.writeheader()
        for r in records:
            flat = {**r,
                    "lat":              r["coordinates"].get("lat"),
                    "lng":              r["coordinates"].get("lng"),
                    "image_filename":   r["image"].get("filename"),
                    "image_source_url": r["image"].get("source_url")}
            w.writerow({k: flat.get(k) for k in csv_fields})
    log.info(f"CSV written  → {CSV_OUT}")


def mongo_import_instructions():
    print("""
╔══════════════════════════════════════════════════════════════════╗
║         HOW TO IMPORT INTO YOUR MONGODB DATABASE                ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  1. MONGOIMPORT (command line)                                   ║
║     mongoimport \\                                                ║
║       --uri "mongodb://localhost:27017" \\                        ║
║       --db fpam \\                                                ║
║       --collection assets \\                                      ║
║       --file output/assets.json \\                                ║
║       --jsonArray                                                ║
║                                                                  ║
║  2. MONGOOSE (Node.js / AssetSpatial backend)                    ║
║     const data = require('./output/assets.json');                ║
║     await Asset.insertMany(data, { ordered: false });            ║
║                                                                  ║
║  3. PYTHON (pymongo)                                             ║
║     import json, pymongo                                         ║
║     client = pymongo.MongoClient("mongodb://localhost:27017")    ║
║     db = client["fpam"]                                          ║
║     with open("output/assets.json") as f:                        ║
║         docs = json.load(f)                                      ║
║     db.assets.insert_many(docs)                                  ║
║                                                                  ║
║  Document schema fields:                                         ║
║    _id, sn, mda, purpose, state, lga, address, landmark,        ║
║    year_commissioned, valuation,                                 ║
║    coordinates: { lat, lng },                                    ║
║    image: { filename, source_url, width, height, scraped_at },   ║
║    metadata: { scraped_at, geocoded, image_found }               ║
║                                                                  ║
║  Images are stored in output/images/<_id>.jpg                   ║
║  Upload the images/ folder to your static server and update      ║
║  your asset API to serve them from that path.                    ║
╚══════════════════════════════════════════════════════════════════╝
""")


# ── ENTRY POINT ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FPAM Asset Image Scraper")
    parser.add_argument("--file",  default=EXCEL_FILE, help="Path to Excel file")
    parser.add_argument("--limit", type=int, default=None,
                        help="Max rows to process (omit = all 2,154)")
    parser.add_argument("--delay", type=float, default=DELAY_SEC,
                        help="Delay between requests in seconds (default 0.8)")
    args = parser.parse_args()

    DELAY_SEC = args.delay
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Re-initialise log file now output dir exists
    for h in log.handlers:
        if isinstance(h, logging.FileHandler):
            log.removeHandler(h)
    log.addHandler(logging.FileHandler(OUTPUT_DIR / "scraper.log", encoding="utf-8"))

    df = load_excel(args.file)
    records, success, no_geo, no_img = process(df, limit=args.limit)
    write_outputs(records)

    total = len(records)
    print(f"""
┌─────────────────────────────────────┐
│  FPAM Scraper — Run Complete        │
├─────────────────────────────────────┤
│  Assets processed : {total:>5}           │
│  Images found     : {success:>5}           │
│  No image         : {no_img:>5}           │
│  No coordinates   : {no_geo:>5}           │
├─────────────────────────────────────┤
│  output/assets.json    (MongoDB)    │
│  output/assets_summary.csv          │
│  output/images/*.jpg                │
└─────────────────────────────────────┘""")

    mongo_import_instructions()
