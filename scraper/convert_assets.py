"""
Convert old assets.json → AssetSpatial schema → MongoDB
=========================================================
- Only converts assets that have a photo URL (image.source_url present)
- Skips assets with no photo — exports them to output/no_photo_assets.csv
- Database: assetspatial
- Collection: assets
- Photos: photos.files / photos.chunks (GridFS)

Usage:
    pip install pymongo Pillow requests openpyxl

    python convert_assets.py
    python convert_assets.py --uri "mongodb+srv://user:pass@cluster/assetspatial"
    python convert_assets.py --user 6a13fa46903aed268a008af6
"""

import io, sys, json, csv, argparse, logging
from datetime import datetime, timezone
from pathlib import Path

from pymongo import MongoClient
from bson import ObjectId
import gridfs
from PIL import Image
import requests

# ── CONFIG ────────────────────────────────────────────────────────────────────
MONGODB_URI     = "mongodb://localhost:27017"
DB_NAME         = "assetspatial"
COLLECTION_NAME = "assets"
JSON_IN         = Path("output/assets.json")
IMAGES_DIR      = Path("output/images")
OUTPUT_DIR      = Path("output")
NO_PHOTO_CSV    = OUTPUT_DIR / "no_photo_assets.csv"
NO_PHOTO_XLSX   = OUTPUT_DIR / "no_photo_assets.xlsx"

DL_HDR = {"User-Agent": "Mozilla/5.0 Chrome/124"}

# ── LOGGING ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)]
)
log = logging.getLogger("convert")

# ── HELPERS ───────────────────────────────────────────────────────────────────
def make_asset_code(sn):
    year = datetime.now().year
    if sn:
        return f"FGN-FGN-BLD-025-{year}-{int(sn):04d}"
    # No serial number — generate a unique suffix to avoid collisions
    import uuid
    return f"FGN-FGN-BLD-025-{year}-X{uuid.uuid4().hex[:6].upper()}"


def get_image_bytes(old_image, images_dir):
    """
    Try to get image bytes:
    1. From local file in images_dir
    2. From source_url (re-download)
    Returns (bytes, width, height) or None.
    """
    # Try local file first
    filename = old_image.get("filename")
    if filename:
        img_path = images_dir / filename
        if img_path.exists():
            try:
                img = Image.open(img_path).convert("RGB")
                w, h = img.size
                buf = io.BytesIO()
                img.save(buf, "JPEG", quality=88, optimize=True)
                return buf.getvalue(), w, h
            except Exception:
                pass

    # Re-download from source_url
    url = old_image.get("source_url")
    if url:
        try:
            r = requests.get(url, headers=DL_HDR, timeout=30)
            if r.status_code == 200:
                img = Image.open(io.BytesIO(r.content)).convert("RGB")
                w, h = img.size
                if max(w, h) > 1200:
                    ratio = 1200 / max(w, h)
                    img = img.resize((int(w*ratio), int(h*ratio)), Image.LANCZOS)
                    w, h = img.size
                buf = io.BytesIO()
                img.save(buf, "JPEG", quality=88, optimize=True)
                return buf.getvalue(), w, h
        except Exception:
            pass

    return None


def upload_to_gridfs(fs, img_bytes, asset_id, asset_code, uploaded_by_oid):
    """Upload image bytes to GridFS photos bucket, return photos[] subdoc."""
    now      = datetime.now(timezone.utc)
    filename = f"{asset_code}_{int(now.timestamp()*1000)}.jpg"
    file_oid = ObjectId()

    fs.put(
        img_bytes,
        _id=file_oid,
        filename=filename,
        content_type="image/jpeg",
        metadata={
            "assetId":      asset_id,
            "fileType":     "photo",
            "uploadedBy":   str(uploaded_by_oid),
            "mimeType":     "image/jpeg",
            "originalName": filename,
        }
    )
    return {
        "fileId":       file_oid,
        "filename":     filename,
        "originalname": filename,
        "mimeType":     "image/jpeg",
        "contentType":  "image/jpeg",
        "sizeBytes":    len(img_bytes),
        "length":       len(img_bytes),
        "capturedAt":   now,
        "uploadedAt":   now,
        "_id":          ObjectId(),
    }


def transform(old, photo_doc, uploaded_by_oid):
    """Build the full AssetSpatial asset document."""
    asset_id   = old.get("_id")
    sn         = old.get("sn")
    asset_code = make_asset_code(sn)
    now        = datetime.now(timezone.utc)

    coords   = old.get("coordinates", {})
    lat      = coords.get("lat")
    lng      = coords.get("lng")
    geocoded = lat is not None and lng is not None

    photos = [photo_doc] if photo_doc else []

    return {
        "_id":        ObjectId(),   # proper ObjectId — matches your schema
        "assetId":    asset_code,
        "scraperId":  asset_id,       # keep original scraper string id for reference
        "assetCode":  asset_code,
        "name":       old.get("mda", ""),
        "type":       old.get("purpose") or "Office Building",
        "geomType":   "Point",
        "location": {
            "type":        "Point",
            "coordinates": [lng, lat] if geocoded else [0.0, 0.0],
        },
        "condition":          "Unknown",
        "material":           None,
        "notes":              old.get("landmark") or "",
        "typeData":           {},
        "mda":                old.get("mda"),
        "purpose":            old.get("purpose") or "Office Building",
        "state":              old.get("state"),
        "lga":                old.get("lga"),
        "address":            old.get("address"),
        "landmark":           old.get("landmark"),
        "year_commissioned":  old.get("year_commissioned"),
        "valuation": {
            "currency": "NGN",
            "amount":   old.get("valuation"),
        },
        "status":             "Active",
        "inspectionInterval": 365,
        "photos":             photos,
        "documents":          [],
        "xlDatasets":         [],
        "conditionHistory":   [],
        "maintenanceLogs":    [],
        "capturedBy":         uploaded_by_oid,
        "captureDate":        now,
        "createdAt":          now,
        "updatedAt":          now,
        "__v":                0,
        "_scraperMeta": {
            "scrapedAt":      old.get("metadata", {}).get("scraped_at"),
            "geocoded":       geocoded,
            "imageFound":     len(photos) > 0,
            "sourceRow":      sn,
            "imageSourceUrl": old.get("image", {}).get("source_url"),
        }
    }


def write_no_photo_files(no_photo_docs):
    """Write assets without photos to CSV and Excel."""
    fields = ["_id","sn","mda","purpose","state","lga","address",
              "landmark","year_commissioned","valuation","lat","lng"]

    rows = []
    for d in no_photo_docs:
        coords = d.get("coordinates", {})
        rows.append({
            "_id":               d.get("_id"),
            "sn":                d.get("sn"),
            "mda":               d.get("mda"),
            "purpose":           d.get("purpose"),
            "state":             d.get("state"),
            "lga":               d.get("lga"),
            "address":           d.get("address"),
            "landmark":          d.get("landmark"),
            "year_commissioned": d.get("year_commissioned"),
            "valuation":         d.get("valuation"),
            "lat":               coords.get("lat"),
            "lng":               coords.get("lng"),
        })

    # CSV
    with open(NO_PHOTO_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    log.info(f"No-photo CSV → {NO_PHOTO_CSV}  ({len(rows)} rows)")

    # Excel
    try:
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Assets Without Photos"
        ws.append(fields)
        for row in rows:
            ws.append([row.get(f) for f in fields])
        # Auto-width columns
        for col in ws.columns:
            max_len = max((len(str(c.value or "")) for c in col), default=10)
            ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 50)
        wb.save(NO_PHOTO_XLSX)
        log.info(f"No-photo XLSX → {NO_PHOTO_XLSX}  ({len(rows)} rows)")
    except ImportError:
        log.warning("openpyxl not installed — skipping Excel output (pip install openpyxl)")


# ── MAIN ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--uri",    default=MONGODB_URI)
    parser.add_argument("--db",     default=DB_NAME)
    parser.add_argument("--input",  default=str(JSON_IN))
    parser.add_argument("--images", default=str(IMAGES_DIR))
    parser.add_argument("--user",   default=None,
                        help="capturedBy user ObjectId e.g. 6a13fa46903aed268a008af6")
    args = parser.parse_args()

    json_path  = Path(args.input)
    images_dir = Path(args.images)

    if not json_path.exists():
        log.error(f"File not found: {json_path}")
        sys.exit(1)

    with open(json_path, encoding="utf-8") as f:
        all_docs = json.load(f)
    log.info(f"Loaded {len(all_docs)} documents from {json_path}")

    # ── SPLIT: has photo URL vs no photo URL ──────────────────────────────────
    has_photo    = [d for d in all_docs if d.get("image", {}).get("source_url")]
    no_photo     = [d for d in all_docs if not d.get("image", {}).get("source_url")]

    log.info(f"  With photo URL : {len(has_photo)}")
    log.info(f"  No photo URL   : {len(no_photo)} → will be exported to spreadsheet")

    # Write no-photo assets to CSV + Excel immediately
    if no_photo:
        write_no_photo_files(no_photo)

    if not has_photo:
        log.info("No documents with photos to convert. Done.")
        return

    # ── CONNECT TO MONGODB ────────────────────────────────────────────────────
    uploaded_by = ObjectId(args.user) if args.user else ObjectId()
    log.info(f"Connecting to {args.uri}  db={args.db}  capturedBy={uploaded_by}")

    client = MongoClient(args.uri)
    db     = client[args.db]
    col    = db[COLLECTION_NAME]
    fs     = gridfs.GridFS(db, collection="photos")

    inserted = updated = img_ok = img_fail = errors = 0

    for i, old in enumerate(has_photo, 1):
        asset_id   = old.get("_id", f"unknown_{i}")
        mda        = old.get("mda", "")
        sn         = old.get("sn")
        asset_code = make_asset_code(sn)

        log.info(f"[{i:>4}/{len(has_photo)}] {mda[:50]:<50}  {old.get('state','')}")

        try:
            # Get image bytes (local file or re-download)
            old_image = old.get("image", {})
            result    = get_image_bytes(old_image, images_dir)
            photo_doc = None

            if result:
                img_bytes, w, h = result
                photo_doc = upload_to_gridfs(fs, img_bytes, asset_id, asset_code, uploaded_by)
                img_ok += 1
                log.info(f"         ✓ image {w}x{h} → GridFS {photo_doc['filename']}")
            else:
                img_fail += 1
                log.warning(f"         ✗ could not load image")

            new_doc = transform(old, photo_doc, uploaded_by)
            # upsert by scraperId so re-runs don't duplicate
            result  = col.update_one({"scraperId": asset_id}, {"$set": new_doc}, upsert=True)

            if result.upserted_id:
                inserted += 1
            else:
                updated += 1

        except Exception as e:
            log.error(f"  Error on {asset_id}: {e}")
            errors += 1

    client.close()

    print(f"""
┌──────────────────────────────────────────┐
│  Conversion Complete                     │
├──────────────────────────────────────────┤
│  Total in JSON        : {len(all_docs):>5}              │
│  Had photo URL        : {len(has_photo):>5}  ← converted  │
│  No photo URL         : {len(no_photo):>5}  ← exported   │
├──────────────────────────────────────────┤
│  Inserted (new)       : {inserted:>5}              │
│  Updated (existing)   : {updated:>5}              │
│  Images → GridFS      : {img_ok:>5}              │
│  Image load failed    : {img_fail:>5}              │
│  Errors               : {errors:>5}              │
├──────────────────────────────────────────┤
│  DB         : {args.db:<28} │
│  Collection : assets                     │
│  Photos in  : photos.files / chunks      │
├──────────────────────────────────────────┤
│  output/no_photo_assets.csv              │
│  output/no_photo_assets.xlsx             │
└──────────────────────────────────────────┘
""")


if __name__ == "__main__":
    main()