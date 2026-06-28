"""
import_no_photo.py
==================
Inserts the no_photo_assets.xlsx/csv into MongoDB assetspatial.assets
without photos. Condition set to "Unknown", status "Active".

Usage:
    pip install pymongo pandas openpyxl

    python import_no_photo.py
    python import_no_photo.py --file output/no_photo_assets.xlsx
    python import_no_photo.py --uri "mongodb+srv://user:pass@cluster/assetspatial"
"""

import sys, argparse, logging
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from pymongo import MongoClient
from bson import ObjectId

MONGODB_URI     = "mongodb://localhost:27017"
DB_NAME         = "assetspatial"
COLLECTION_NAME = "assets"

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s", datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)])
log = logging.getLogger("import")

STATE_CODES = {
    'fct':'001','abuja':'001','fct, abuja':'001','fct abuja':'001',
    'abia':'002','adamawa':'003','akwa ibom':'004','akwa-ibom':'004',
    'anambra':'005','bauchi':'006','bayelsa':'007','benue':'008',
    'borno':'009','cross river':'010','cross-river':'010','delta':'011',
    'ebonyi':'012','edo':'013','ekiti':'014','enugu':'015','gombe':'016',
    'imo':'017','jigawa':'018','kaduna':'019','kano':'020','katsina':'021',
    'kebbi':'022','kogi':'023','kwara':'024','lagos':'025','nasarawa':'026',
    'niger':'027','ogun':'028','ondo':'029','osun':'030','oyo':'031',
    'plateau':'032','rivers':'033','river':'033','sokoto':'034',
    'taraba':'035','yobe':'036','zamfara':'037',
}

def branch(state):
    return STATE_CODES.get((state or '').lower().strip(), '001')

def mda_code(name):
    if not name: return 'FGN'
    n = name.upper().strip()
    known = {
        'FEDERAL MINISTRY OF AGRICULTURE': 'FMARD',
        'FEDERAL MINISTRY OF LABOUR': 'FMLE',
        'FEDERAL MINISTRY OF HEALTH': 'FMOH',
        'FEDERAL MINISTRY OF EDUCATION': 'FMOE',
        'FEDERAL MINISTRY OF WORKS': 'FMWH',
        'FEDERAL MINISTRY OF FINANCE': 'FMOF',
        'FEDERAL MINISTRY OF ENVIRONMENT': 'FMENV',
        'FEDERAL MINISTRY OF COMMUNICATION': 'FMCDE',
        'FEDERAL MINISTRY OF POWER': 'FMP',
        'FEDERAL MINISTRY OF MINES': 'FMMSD',
        'FEDERAL MINISTRY OF HOUSING': 'FMHUD',
        'FEDERAL MINISTRY OF DEFENCE': 'FMOD',
        'FEDERAL MINISTRY OF TRANSPORT': 'FMT',
        'FEDERAL MINISTRY OF JUSTICE': 'FMJ',
        'FEDERAL MINISTRY OF FOREIGN AFFAIRS': 'FMFA',
        'FEDERAL MINISTRY OF INDUSTRY': 'FMITI',
        'NIGERIA POSTAL SERVICE': 'NIPOST',
        'NIGERIA COMMUNICATION SATELLITE': 'NIGCOMSAT',
        'NIGERIA COMMUNICATION': 'NCC',
        'NATIONAL INFORMATION TECHNOLOGY': 'NITDA',
        'FEDERAL ROADS SAFETY CORPS': 'FRSC',
        'JOINT ADMISSIONS MATRICULATION BOARD': 'JAMB',
        'ECONOMIC AND FINANCIAL CRIMES': 'EFCC',
        'INDEPENDENT CORRUPT PRACTICES': 'ICPC',
        'INEC': 'INEC',
        'FEDERAL MORTGAGE BANK': 'FMBN',
        'NIGERIA DEPOSIT INSURANCE': 'NDIC',
        'UNIVERSAL BASIC EDUCATION': 'UBEC',
        'BANK OF AGRICULTURE': 'BOA',
        'STRATEGIC GRAINS RESERVE': 'SGR',
        'NATIONAL HEALTH INSURANCE': 'NHIS',
        'NATIONAL PRIMARY HEALTH CARE': 'NPHCDA',
        'POST HEALTH SERVICES': 'PHS',
        'RADIOGRAPHERS REGISTRATION BOARD': 'RRB',
        'COMMUNITY HEALTH PRACTITIONERS': 'CHPRBN',
        'NATIONAL EAR CARE CENTER': 'NECC',
        'INSTITUTE OF PUBLIC ANALYSTS': 'IPAN',
        'NIGERIA QUARANTINE SERVICES': 'NAQS',
        'AGRICULTURAL AND RURAL MANAGEMENT': 'ARMTI',
        'FEDERAL COLLEGE OF AGRICULTURE': 'FCA',
        'NATIONAL ANIMAL PRODUCTION': 'NAPRI',
        'NATIONAL INSTITUTE FOR FRESH WATER': 'NIFFR',
        'NATIONAL INSTITUTE OF OCEANOGRAPHY': 'NIOMR',
        'INSTITUTE FOR AGRICULTURAL RESEARCH': 'IAR',
        'NATIONAL DEFENCE COLLEGE': 'NDC',
        'NIGERIAN DEFENCE ACADEMY': 'NDA',
        'NIGERIAN AIR FORCE': 'NAF',
        'MILITARY PENSIONS BOARD': 'MPB',
        'FEDERAL GOVERNMENT SECRETARIAT': 'FGS',
        'TRADE FAIR COMPLEX': 'TFC',
        'UNIVERSITY OF': 'UNIV',
        'BAYERO UNIVERSITY': 'BUK',
        'AHMADU BELLO UNIVERSITY': 'ABU',
        'FEDERAL POLYTECHNIC': 'FPOLY',
        'FEDERAL GOVERNMENT GIRLS COLLEGE': 'FGGC',
        'FEDERAL GOVERNMENT COLLEGE': 'FGC',
        'FEDERAL TECHNICAL COLLEGE': 'FTC',
        'GASHAKA': 'GGNP',
        'YANKARI': 'YNP',
        'CENTER FOR BLACK AFRICAN': 'CBAAC',
        'SKILL ACQUISITION': 'SAT',
        'STATE OFFICE': 'STOFF',
        'HOTEL AND CATERING': 'HOTCAT',
        'ARABIC LANGUAGE': 'ALV',
        'CONSUMER PROTECTION': 'CPC',
    }
    for k in sorted(known, key=len, reverse=True):
        if k in n:
            return known[k]
    words = [w for w in n.replace('-',' ').split() if len(w) > 1]
    return (''.join(w[0] for w in words) or 'FGN')[:6]

def clean(v):
    if v is None: return None
    s = str(v).strip()
    return None if s.lower() in ('nan','none','','n/a','-') else s

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--file', default='output/no_photo_assets.xlsx')
    parser.add_argument('--uri',  default=MONGODB_URI)
    parser.add_argument('--user', default=None)
    args = parser.parse_args()

    path = Path(args.file)
    if not path.exists():
        # Try csv fallback
        csv = path.with_suffix('.csv')
        if csv.exists():
            path = csv
        else:
            log.error(f"File not found: {path}")
            sys.exit(1)

    log.info(f"Reading {path}")
    df = pd.read_excel(path) if path.suffix in ('.xlsx','.xls') else pd.read_csv(path)
    log.info(f"Loaded {len(df)} rows")

    uploaded_by = ObjectId(args.user) if args.user else ObjectId()
    client = MongoClient(args.uri)
    col    = client[DB_NAME][COLLECTION_NAME]

    # Pre-load highest existing sequence per group from DB so we don't collide
    year    = datetime.now().year
    seq_map = {}

    log.info("Pre-loading existing sequences from DB...")
    existing = col.find(
        {'assetId': {'$regex': f'^FGN-.+-INF-.+-{year}-'}},
        {'assetId': 1}
    )
    for doc in existing:
        aid = doc.get('assetId','')
        parts = aid.split('-')
        if len(parts) >= 6:
            try:
                gkey = f"{parts[1]}-INF-{parts[3]}-{parts[4]}"
                seq_map[gkey] = max(seq_map.get(gkey, 0), int(parts[5]))
            except Exception:
                pass
    log.info(f"  Found {len(seq_map)} existing groups")

    inserted = skipped = errors = 0

    for _, row in df.iterrows():
        mda   = clean(row.get('mda'))
        if not mda:
            continue

        state   = clean(row.get('state'))
        lga     = clean(row.get('lga'))
        address = clean(row.get('address'))
        landmark= clean(row.get('landmark'))
        purpose = clean(row.get('purpose')) or 'Office Building'
        lat     = row.get('lat')
        lng     = row.get('lng')

        try:
            lat = float(lat)
            if lat != lat: lat = None  # nan check
        except: lat = None
        try:
            lng = float(lng)
            if lng != lng: lng = None  # nan check
        except: lng = None

        import math
        geocoded = (lat is not None and lng is not None
                    and math.isfinite(lat) and math.isfinite(lng))

        mc   = mda_code(mda)
        bc   = branch(state)
        gkey = f"{mc}-INF-{bc}-{year}"
        seq_map[gkey] = seq_map.get(gkey, 0) + 1
        seq  = str(seq_map[gkey]).zfill(4)
        aid  = f"FGN-{mc}-INF-{bc}-{year}-{seq}"

        # Skip if assetId already exists
        if col.find_one({'assetId': aid}, {'_id':1}):
            skipped += 1
            continue

        now = datetime.now(timezone.utc)
        doc = {
            '_id':        ObjectId(),
            'assetId':    aid,
            'assetCode':  aid,
            'name':       mda,
            'type':       purpose,
            'geomType':   'Point',
            'location': {
                'type':        'Point',
                'coordinates': [round(lng,7), round(lat,7)] if geocoded else [0.0, 0.0],
            },
            'condition':          'Unknown',
            'material':           None,
            'notes':              landmark or '',
            'typeData':           {},
            'mda':                mda,
            'purpose':            purpose,
            'state':              state,
            'lga':                lga,
            'address':            address,
            'landmark':           landmark,
            'year_commissioned':  None,
            'valuation':          {'currency': 'NGN', 'amount': None},
            'status':             'Active',
            'inspectionInterval': 365,
            'photos':             [],
            'documents':          [],
            'xlDatasets':         [],
            'conditionHistory':   [],
            'maintenanceLogs':    [],
            'capturedBy':         uploaded_by,
            'captureDate':        now,
            'createdAt':          now,
            'updatedAt':          now,
            '__v':                0,
            '_scraperMeta': {
                'scrapedAt':  now.isoformat(),
                'geocoded':   geocoded,
                'imageFound': False,
                'sourceRow':  None,
            }
        }

        try:
            col.update_one({'assetId': aid}, {'$setOnInsert': doc}, upsert=True)
            inserted += 1
            if inserted % 100 == 0:
                log.info(f"  {inserted} inserted so far…")
        except Exception as e:
            log.error(f"  {mda}: {e}")
            errors += 1

    client.close()
    print(f"""
┌──────────────────────────────────────┐
│  Import Complete                     │
├──────────────────────────────────────┤
│  Inserted : {str(inserted).ljust(26)}│
│  Skipped  : {str(skipped).ljust(26)}│
│  Errors   : {str(errors).ljust(26)}│
└──────────────────────────────────────┘
""")

if __name__ == '__main__':
    main()