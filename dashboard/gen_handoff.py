"""
Generate AssetSpatial — Technical Handoff & Platform Documentation PDF
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib import colors
import datetime

OUTPUT = '/mnt/user-data/outputs/AssetSpatial_Handoff_Documentation.pdf'

# ── Colours ───────────────────────────────────────────────────────────────────
NAVY   = colors.HexColor('#0B2545')
BLUE   = colors.HexColor('#4A90D9')
BLUE2  = colors.HexColor('#EBF3FB')
WHITE  = colors.white
GRAY   = colors.HexColor('#F4F6F9')
BORDER = colors.HexColor('#E8ECF0')
TEXT   = colors.HexColor('#2C3E50')
TEXT3  = colors.HexColor('#5A6A7A')
GREEN  = colors.HexColor('#2DB87B')
WARN   = colors.HexColor('#f0a500')
RED    = colors.HexColor('#e05555')

# ── Styles ────────────────────────────────────────────────────────────────────
def styles():
    base = ParagraphStyle('base', fontName='Helvetica', fontSize=10,
                          textColor=TEXT, leading=15, alignment=TA_JUSTIFY)
    return {
        'base': base,
        'h1': ParagraphStyle('h1', parent=base, fontName='Helvetica-Bold',
                             fontSize=20, textColor=NAVY, leading=26,
                             spaceBefore=18, spaceAfter=4, alignment=TA_LEFT),
        'h2': ParagraphStyle('h2', parent=base, fontName='Helvetica-Bold',
                             fontSize=14, textColor=NAVY, leading=18,
                             spaceBefore=14, spaceAfter=4),
        'h3': ParagraphStyle('h3', parent=base, fontName='Helvetica-Bold',
                             fontSize=11, textColor=BLUE, leading=16,
                             spaceBefore=10, spaceAfter=2),
        'body': ParagraphStyle('body', parent=base),
        'body_sm': ParagraphStyle('body_sm', parent=base, fontSize=9, leading=13),
        'code': ParagraphStyle('code', fontName='Courier', fontSize=8.5,
                               textColor=NAVY, leading=12, leftIndent=8,
                               backColor=GRAY, spaceBefore=2, spaceAfter=2),
        'label': ParagraphStyle('label', fontName='Helvetica-Bold', fontSize=8,
                                textColor=TEXT3, leading=12,
                                alignment=TA_LEFT),
        'center': ParagraphStyle('center', parent=base, alignment=TA_CENTER),
        'white': ParagraphStyle('white', fontName='Helvetica-Bold', fontSize=11,
                                textColor=WHITE, leading=15),
        'white_sm': ParagraphStyle('white_sm', fontName='Helvetica', fontSize=9,
                                   textColor=colors.HexColor('#A0B8D8'), leading=13),
        'caption': ParagraphStyle('caption', fontName='Helvetica', fontSize=8,
                                  textColor=TEXT3, leading=12, alignment=TA_CENTER),
    }

S = styles()

def hr(): return HRFlowable(width='100%', thickness=1, color=BORDER, spaceAfter=4, spaceBefore=4)
def gap(n=6): return Spacer(1, n)

def section_header(title, sub=''):
    rows = [[Paragraph(title, S['white'])]]
    if sub:
        rows.append([Paragraph(sub, S['white_sm'])])
    t = Table(rows, colWidths=[165*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), NAVY),
        ('TOPPADDING',    (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING',   (0,0), (-1,-1), 14),
        ('RIGHTPADDING',  (0,0), (-1,-1), 14),
        ('ROUNDEDCORNERS', [6]),
    ]))
    return [gap(10), t, gap(8)]

def info_table(rows, col_w=None):
    col_w = col_w or [55*mm, 110*mm]
    data = [[Paragraph(f'<b>{k}</b>', S['body_sm']),
             Paragraph(v, S['body_sm'])] for k, v in rows]
    t = Table(data, colWidths=col_w)
    t.setStyle(TableStyle([
        ('GRID',          (0,0), (-1,-1), 0.4, BORDER),
        ('BACKGROUND',    (0,0), (0,-1),  BLUE2),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (-1,-1), 8),
        ('RIGHTPADDING',  (0,0), (-1,-1), 8),
        ('ROWBACKGROUNDS',(0,0), (-1,-1), [WHITE, GRAY]),
    ]))
    return t

def code_block(text):
    return Paragraph(text.replace('\n', '<br/>').replace(' ', '&nbsp;'), S['code'])

def bullet(text, indent=0):
    prefix = '&nbsp;' * (indent * 4)
    return Paragraph(f'{prefix}&#8226; &nbsp;{text}', S['body'])

def numbered(n, text):
    return Paragraph(f'<b>{n}.</b> &nbsp;{text}', S['body'])

# ── Page header/footer ────────────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    # Header bar
    canvas.setFillColor(NAVY)
    canvas.rect(0, h - 18*mm, w, 18*mm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont('Helvetica-Bold', 9)
    canvas.drawString(15*mm, h - 11*mm, 'AssetSpatial')
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(colors.HexColor('#A0B8D8'))
    canvas.drawString(15*mm, h - 16*mm, 'Technical Handoff Documentation — FPAM / FMHUD')
    canvas.setFillColor(WHITE)
    canvas.drawRightString(w - 15*mm, h - 11*mm, f'Page {doc.page}')
    # Footer
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, w, 10*mm, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor('#A0B8D8'))
    canvas.setFont('Helvetica', 7.5)
    canvas.drawString(15*mm, 3.5*mm, 'CONFIDENTIAL — For internal development use only')
    canvas.drawRightString(w - 15*mm, 3.5*mm,
                           f'Generated: {datetime.datetime.now().strftime("%d %B %Y")}')
    canvas.restoreState()

# ── BUILD ─────────────────────────────────────────────────────────────────────
doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    topMargin=22*mm, bottomMargin=14*mm,
    leftMargin=15*mm, rightMargin=15*mm,
)

story = []

# ══════════════════════════════════════════════════════════════════════
# COVER
# ══════════════════════════════════════════════════════════════════════
def cover_page():
    items = []
    items.append(gap(30))
    # Ministry header
    items.append(Paragraph(
        'FEDERAL MINISTRY OF HOUSING AND URBAN DEVELOPMENT',
        ParagraphStyle('cov1', fontName='Helvetica-Bold', fontSize=13,
                       textColor=BLUE, alignment=TA_CENTER, leading=18)))
    items.append(Paragraph(
        'Federal Public Assets Maintenance (FPAM) Directorate',
        ParagraphStyle('cov2', fontName='Helvetica', fontSize=10,
                       textColor=TEXT3, alignment=TA_CENTER, leading=14, spaceAfter=4)))
    items.append(gap(20))
    # Title box
    title_data = [[Paragraph('AssetSpatial', ParagraphStyle('t', fontName='Helvetica-Bold',
                   fontSize=38, textColor=WHITE, alignment=TA_CENTER, leading=44))],
                  [Paragraph('Federal Public Asset Management Platform',
                   ParagraphStyle('t2', fontName='Helvetica-Bold', fontSize=14,
                   textColor=BLUE, alignment=TA_CENTER, leading=18))],
                  [Paragraph('Technical Handoff &amp; Platform Documentation',
                   ParagraphStyle('t3', fontName='Helvetica', fontSize=11,
                   textColor=colors.HexColor('#A0B8D8'), alignment=TA_CENTER, leading=15))]]
    title_t = Table(title_data, colWidths=[165*mm])
    title_t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), NAVY),
        ('TOPPADDING',    (0,0), (0,0),   22),
        ('BOTTOMPADDING', (0,-1),(-1,-1), 22),
        ('TOPPADDING',    (0,1), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-2), 4),
        ('LEFTPADDING',   (0,0), (-1,-1), 18),
        ('RIGHTPADDING',  (0,0), (-1,-1), 18),
        ('ROUNDEDCORNERS', [8]),
    ]))
    items.append(title_t)
    items.append(gap(24))
    # Meta table
    meta = info_table([
        ('Version',         '1.0 — July 2026'),
        ('Status',          'Fully built and running locally. Assets & Condition + M&E divisions complete.'),
        ('Backend',         'Node.js/Express — Port 3001 — MongoDB 7 — GridFS — Bull — Socket.io'),
        ('Frontend',        'Vanilla HTML/CSS/JS — 16 app pages — Leaflet — Chart.js — Font Awesome 6.5'),
        ('Auth',            'JWT (Bearer token) — localStorage key: as_token'),
        ('Default Admin',   'admin@assetspatial.gov.ng / ChangeMe123!'),
        ('Classification',  'CONFIDENTIAL — Internal Development Use Only'),
    ])
    items.append(meta)
    items.append(gap(20))
    items.append(Paragraph(
        'This document is the complete technical reference for the AssetSpatial platform. '
        'It is structured to allow a new developer or AI assistant to fully understand the '
        'platform\'s purpose, architecture, data models, and build status, and to continue '
        'development of the remaining three FPAM divisions without re-explaining prior work.',
        ParagraphStyle('intro', fontName='Helvetica', fontSize=9.5,
                       textColor=TEXT3, alignment=TA_JUSTIFY, leading=14)))
    items.append(PageBreak())
    return items

story += cover_page()

# ══════════════════════════════════════════════════════════════════════
# 1. PLATFORM PURPOSE & MANDATE
# ══════════════════════════════════════════════════════════════════════
story += section_header('1. Platform Purpose & Mandate',
                        'Why AssetSpatial exists and what it must do')
story.append(Paragraph(
    'AssetSpatial is a full-stack web platform commissioned by the <b>Facility and Property '
    'Asset Management (FPAM) Directorate</b> of the <b>Federal Ministry of Housing and Urban '
    'Development (FMHUD)</b>. Its primary mandate is the digitisation of Nigeria\'s federal '
    'public asset management framework — replacing paper-based records with a centralised, '
    'real-time registry covering all 36 states and the FCT Abuja.', S['body']))
story.append(gap())
story.append(Paragraph(
    'The platform is grounded in the <b>National Public Buildings Maintenance Order, 2022</b> '
    '(Federal Republic of Nigeria Official Gazette No. 84, Vol. 109, B1087–B1089, Government '
    'Notice No. 120), which mandates the institutionalisation of a maintenance culture across '
    'all federal assets and infrastructure. FPAM is expressly empowered to coordinate, monitor, '
    'and enforce compliance with this order across all MDAs.', S['body']))
story.append(gap(10))

story.append(Paragraph('1.1 What MDAs Must Do', S['h2']))
story += [numbered(1, 'Designate a Maintenance Desk Officer to liaise with FPAM'),
          numbered(2, 'Develop and submit a comprehensive Maintenance Schedule for all physical assets'),
          numbered(3, 'Budget for maintenance activities in annual submissions'),
          numbered(4, 'Grant FPAM access for periodic compliance inspections and reviews')]
story.append(gap())

story.append(Paragraph('1.2 What AssetSpatial Digitises', S['h2']))
story.append(Paragraph(
    'Every workflow the FPAM Directorate manages manually — asset capture, condition assessment, '
    'M&E progress reporting, clearance certification, inspection scheduling, maintenance logging, '
    'and compliance tracking — is implemented as a digital module in this platform. '
    'The goal is a live national asset register where every federal building, land parcel, '
    'utility, environmental asset, and equipment item is tracked from creation to decommissioning.',
    S['body']))
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 2. THE FIVE FPAM DIVISIONS
# ══════════════════════════════════════════════════════════════════════
story += section_header('2. The Five FPAM Operational Divisions',
                        'Platform is organised around these five divisions. Each user belongs to one.')

div_data = [
    ['#', 'Division', 'Status', 'Primary Function'],
    ['1', 'Assets, Inventory &\nCondition Assessment', 'BUILT', 'Asset registry, GPS capture, condition scoring,\nphotos, maps, lifecycle tracking'],
    ['2', 'Monitoring &\nEvaluation (M&E)', 'BUILT', 'Monthly progress reports (Secretariat & NHP),\nclearance certificates, KPI tracking'],
    ['3', 'Planning & Design', 'NEXT', 'Project proposals, design documents,\nsite plans, budget estimates, approvals'],
    ['4', 'Rehabilitation &\nRestoration', 'NEXT', 'Work orders, contractor assignments,\nrepair history, before/after photos'],
    ['5', 'Building Training &\nMaintenance', 'NEXT', 'Training schedules, staff certifications,\nSOP documents, compliance tracking'],
]
dt = Table(div_data, colWidths=[8*mm, 42*mm, 18*mm, 97*mm])
dt.setStyle(TableStyle([
    ('BACKGROUND',    (0,0), (-1,0),  NAVY),
    ('TEXTCOLOR',     (0,0), (-1,0),  WHITE),
    ('FONTNAME',      (0,0), (-1,0),  'Helvetica-Bold'),
    ('FONTSIZE',      (0,0), (-1,-1), 8.5),
    ('GRID',          (0,0), (-1,-1), 0.4, BORDER),
    ('ROWBACKGROUNDS',(0,1), (-1,-1), [WHITE, GRAY]),
    ('VALIGN',        (0,0), (-1,-1), 'TOP'),
    ('TOPPADDING',    (0,0), (-1,-1), 6),
    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ('LEFTPADDING',   (0,0), (-1,-1), 6),
    # Status colours
    ('TEXTCOLOR',     (2,1), (2,2),   GREEN),
    ('FONTNAME',      (2,1), (2,2),   'Helvetica-Bold'),
    ('TEXTCOLOR',     (2,3), (2,5),   WARN),
    ('FONTNAME',      (2,3), (2,5),   'Helvetica-Bold'),
]))
story.append(dt)
story.append(gap(10))

story.append(Paragraph('2.1 The Two-Axis Permission System', S['h2']))
story.append(Paragraph(
    'Every user has two attributes: <b>Role</b> (what level of action they can perform) and '
    '<b>Division</b> (which part of the platform they can see). This creates a clean access '
    'control matrix without complex per-page permission logic.', S['body']))
story.append(gap(6))

perm_data = [
    ['Role', 'Division Access', 'Capabilities'],
    ['System Admin', 'All (cross-division)', 'Full access — users, settings, audit, all assets, all divisions'],
    ['Supervisor',   'All (cross-division)', 'Review & approve anything, issue clearances, view all reports'],
    ['Sub-Head',     'Assigned division',    'Approve field captures within their division'],
    ['Field Agent',  'Assigned division',    'Capture assets, fill and submit forms only'],
    ['GIS Analyst',  'Deferred (ignore)',    'Spatial analysis — role exists in schema but not yet active'],
]
pt = Table(perm_data, colWidths=[32*mm, 38*mm, 95*mm])
pt.setStyle(TableStyle([
    ('BACKGROUND',    (0,0), (-1,0),  NAVY),
    ('TEXTCOLOR',     (0,0), (-1,0),  WHITE),
    ('FONTNAME',      (0,0), (-1,0),  'Helvetica-Bold'),
    ('FONTSIZE',      (0,0), (-1,-1), 8.5),
    ('GRID',          (0,0), (-1,-1), 0.4, BORDER),
    ('ROWBACKGROUNDS',(0,1), (-1,-1), [WHITE, GRAY]),
    ('VALIGN',        (0,0), (-1,-1), 'TOP'),
    ('TOPPADDING',    (0,0), (-1,-1), 5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('LEFTPADDING',   (0,0), (-1,-1), 6),
]))
story.append(pt)
story.append(gap(8))
story.append(Paragraph(
    '<b>Implementation:</b> Division filtering runs in <b>js/app.js</b> inside '
    '<b>applyRoleGates()</b>. Nav items carry <b>data-division</b> attributes. System Admins '
    'and Supervisors bypass division filtering entirely. Per-user permission overrides in the DB '
    'are ignored for System Admin (role defaults are always absolute).', S['body_sm']))
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 3. TECHNICAL ARCHITECTURE
# ══════════════════════════════════════════════════════════════════════
story += section_header('3. Technical Architecture', 'Stack, folder structure, and how the pieces connect')

story.append(Paragraph('3.1 Backend Stack', S['h2']))
story.append(info_table([
    ('Runtime',         'Node.js v20 LTS — npm run dev starts nodemon'),
    ('Framework',       'Express.js 4.x — all routes mounted under /api/'),
    ('Database',        'MongoDB 7 (Mongoose ODM) — mongodb://localhost:27017/assetspatial'),
    ('File Storage',    'GridFS via MongoDB — photos, documents, Excel files per asset'),
    ('Cache / Queues',  'Redis optional (graceful fallback) + Bull queues for OCR and Excel processing'),
    ('Realtime',        'Socket.io 4.x — live asset updates, notifications'),
    ('Auth',            'JWT (jsonwebtoken) — Bearer token in Authorization header'),
    ('AI',              'Anthropic claude-sonnet-4-6 — portfolio analysis in ai_insights.js'),
    ('Entry point',     'src/app.js — all routes imported and mounted here'),
]))
story.append(gap(10))

story.append(Paragraph('3.2 Backend Folder Structure', S['h2']))
story.append(code_block(
'src/\n'
'  app.js                 — Express entry, all route mounts\n'
'  config/                — .env, database connection\n'
'  models/                — Mongoose schemas (Asset.js, User.js, etc.)\n'
'  routes/                — One file per feature\n'
'    assets.js            — Core CRUD for assets\n'
'    me_routes.js         — M&E reports + clearance certificates\n'
'    asset_extras_routes.js — Relationships, lifecycle, bulk update\n'
'    asset_approval_routes.js\n'
'    inspection_routes.js\n'
'    analytics_routes.js\n'
'    photos.js / documents.js / excel.js\n'
'    auth.js / users.js / audit.js / settings.js\n'
'    mda_routes.js / ocr.js / export.js / spatial.js\n'
'  middleware/             — auth.js, resolvePermissions.js, auditMiddleware.js\n'
'  services/               — analyticsService.js, assetService.js, etc.\n'
'  queues/                 — Bull queue workers'
))
story.append(gap(10))

story.append(Paragraph('3.3 Frontend Stack', S['h2']))
story.append(info_table([
    ('Framework',     'None — vanilla HTML/CSS/JS. No React, no Vue, no build step.'),
    ('CSS',           'css/main.css — shared design system (navy #0B2545, blue #4A90D9, bg #F4F6F9)'),
    ('Fonts',         'DM Sans (primary), Space Grotesk/Syne (legacy pages), Space Mono (monospace)'),
    ('Icons',         'Font Awesome 6.5 — no emojis anywhere in the UI'),
    ('Maps',          'Leaflet 1.9 — CDN — asset map with clustering and spatial filters'),
    ('Charts',        'Chart.js 4.4 — CDN — analytics and dashboard mini charts'),
    ('PDF export',    'jsPDF 2.x — CDN — report and asset PDF generation'),
    ('API base',      'https://fpambacend.onrender.com/api — set in js/api.js as API_BASE constant'),
    ('Auth storage',  'localStorage: as_token (JWT), as_user (user object JSON)'),
]))
story.append(gap(10))

story.append(Paragraph('3.4 Frontend Folder Structure', S['h2']))
story.append(code_block(
'(frontend root)/\n'
'  *.html              — 16 app pages + public pages\n'
'  css/main.css        — shared styles\n'
'  js/\n'
'    api.js            — All API helper functions (apiGetAsset, apiAddMaintenance, etc.)\n'
'    app.js            — Shared init: auth guard, theme, nav, role gates, user badge\n'
'    notifications.js  — Socket.io real-time notifications\n'
'    asset_detail.js   — Asset detail modal used in assets.html\n'
'    dashboard.js      — Dashboard KPIs and charts\n'
'    assets.js         — Asset registry list and filters\n'
'    capture.js        — Field capture form\n'
'    analytics.js      — Analytics charts\n'
'    users.js          — User management\n'
'    [page].js         — One JS module per page\n'
'    assetCodeIndex.js — Asset coding utility (works in Node + browser)\n'
'  docs/               — PDF downloads (enforcement letter, manual, forms)'
))
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 4. ALL API ROUTES
# ══════════════════════════════════════════════════════════════════════
story += section_header('4. All Backend API Routes',
                        'Complete route list as registered in src/app.js')

route_data = [
    ['Mount Path', 'File', 'Key Endpoints'],
    ['/api/auth',              'routes/auth.js',                'POST /login, POST /logout, GET /me'],
    ['/api/assets (M&E first)','routes/me_routes.js',           'GET|POST /:id/me-reports, PATCH /:id/me-reports/:rid, GET /me-reports/all'],
    ['/api/assets',            'routes/assets.js',              'GET / (list), POST /, GET|PUT|DELETE /:id, GET /search'],
    ['/api/assets',            'routes/export.js',              'GET / (CSV/Excel export), GET /bulk'],
    ['/api/assets',            'routes/asset_extras_routes.js', 'GET /:id/relationships, GET /:id/lifecycle, POST /bulk-update'],
    ['/api/assets/spatial',    'routes/spatial.js',             'GET /near, GET /bbox, POST /within'],
    ['/api/assets/:id/photos', 'routes/photos.js',              'GET|POST|DELETE /:fileId'],
    ['/api/assets/:id/documents','routes/documents.js',         'GET|POST|DELETE /:fileId'],
    ['/api/assets/:id/excel',  'routes/excel.js',               'GET|POST|DELETE /:fileId'],
    ['/api/assets/:id/inspections','routes/inspection_routes.js','GET|POST, GET|PUT|DELETE /:id'],
    ['/api/analytics',         'routes/analytics_routes.js',    'GET /dashboard, /condition-breakdown, /by-type, /by-state'],
    ['/api/ocr',               'routes/ocr.js',                 'POST /scan, GET /jobs/:jobId'],
    ['/api/users',             'routes/users.js',               'GET|POST /, GET|PUT|DELETE /:id, POST /:id/reset-password'],
    ['/api/users/role-config', 'routes/role_config_routes.js',  'GET|PUT /:role, POST /reset'],
    ['/api/audit',             'routes/audit.js',               'GET /, GET /:id'],
    ['/api/settings',          'routes/settings.js',            'GET|PUT /'],
    ['/api/mdas',              'routes/mda_routes.js',          'GET|POST /, GET|PUT /:id — auto-seeds 31 federal MDAs'],
    ['/api/assets/files',      'routes/files_route.js',         'Cross-asset file database listing'],
]
rt = Table(route_data, colWidths=[48*mm, 50*mm, 67*mm])
rt.setStyle(TableStyle([
    ('BACKGROUND',    (0,0), (-1,0),  NAVY),
    ('TEXTCOLOR',     (0,0), (-1,0),  WHITE),
    ('FONTNAME',      (0,0), (-1,0),  'Helvetica-Bold'),
    ('FONTSIZE',      (0,0), (-1,-1), 7.5),
    ('GRID',          (0,0), (-1,-1), 0.4, BORDER),
    ('ROWBACKGROUNDS',(0,1), (-1,-1), [WHITE, GRAY]),
    ('VALIGN',        (0,0), (-1,-1), 'TOP'),
    ('TOPPADDING',    (0,0), (-1,-1), 5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('LEFTPADDING',   (0,0), (-1,-1), 5),
    ('FONTNAME',      (0,1), (0,1),   'Helvetica-Bold'),
    ('TEXTCOLOR',     (0,1), (0,1),   RED),
]))
story.append(rt)
story.append(gap(8))
story.append(Paragraph(
    '<b>CRITICAL — Route ordering:</b> me_routes.js MUST be mounted before assets.js. '
    'The assets router has a catch-all GET /:id that swallows /:id/me-reports if '
    'me_routes is mounted after it. This is already correct in src/app.js.', S['body_sm']))
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 5. DATA MODELS
# ══════════════════════════════════════════════════════════════════════
story += section_header('5. Key Data Models', 'Mongoose schemas — src/models/')

story.append(Paragraph('5.1 Asset (models/Asset.js)', S['h2']))
story.append(Paragraph(
    'The central document. Every division attaches its own data layer to this record. '
    'Never create division-centric siloed records — always use the asset as the root.', S['body']))
story.append(gap(4))
story.append(code_block(
'assetId:         String  — FGN-{MDA}-{TYPE}-{BRANCH}-{YEAR}-{SEQ} format\n'
'name, type, condition, status, state, lga, zone, sector, mda\n'
'location:        GeoJSON Point {type:"Point", coordinates:[lng,lat]}\n'
'photos:          [GridFS file refs]\n'
'documents:       [GridFS file refs]\n'
'excelFiles:      [GridFS file refs]\n'
'maintenanceLogs: [{date, desc, tech, cost, meReportId, meReportLink}]\n'
'meReports:       [meReportSchema]  — M&E monthly progress reports\n'
'valuation:       {amount, currency, method, assessedAt}\n'
'lifecycle:       [{status, changedAt, changedBy, notes}]\n'
'inspections:     (linked via inspection_routes.js)\n'
'relationships:   [{assetId, type, direction}]\n'
'typeData:        Mixed — flexible type-specific fields\n'
'capturedBy:      ref User\n'
'approvalStatus:  enum [Pending, Approved, Rejected]'
))
story.append(gap(8))

story.append(Paragraph('5.2 Asset Coding System', S['h2']))
story.append(Paragraph('Format: <b>FGN-{MDA}-{TYPE}-{BRANCH}-{YEAR}-{SEQ}</b>', S['body']))
story.append(gap(4))
story.append(info_table([
    ('FGN',    'Federal Government of Nigeria prefix — always FGN'),
    ('{MDA}',  'Ministry/Dept/Agency short code — e.g. FMHUD, FMITI, FMOE'),
    ('{TYPE}', 'INF=Infrastructure, LND=Land, UTL=Utility, ENV=Environmental, EQP=Equipment'),
    ('{BRANCH}','001=FCT/HQ, 002-037=States alphabetically (Abia=002 ... Zamfara=037)'),
    ('{YEAR}', '4-digit capture year — e.g. 2026'),
    ('{SEQ}',  '4-digit zero-padded sequence — e.g. 0001. Find max from DB, not by createdAt sort.'),
], col_w=[25*mm, 140*mm]))
story.append(gap(4))
story.append(Paragraph(
    'The assetCodeIndex.js utility works in both Node.js and browser without modification. '
    'Always detect MongoDB ObjectIds by regex /^[a-f\\d]{24}$/i, never by string prefix, '
    'since FGN- IDs need {assetId: id} queries not {_id: id}.', S['body_sm']))
story.append(gap(8))

story.append(Paragraph('5.3 User (models/User.js)', S['h2']))
story.append(code_block(
'name, email, password (select:false)\n'
'role:     enum [Field Agent, Sub-Head, Supervisor, GIS Analyst, System Admin]\n'
'division: enum [All, Assets & Condition, Monitoring & Evaluation,\n'
'                Planning & Design, Rehabilitation & Restoration,\n'
'                Building Training & Maintenance]\n'
'          default: "Assets & Condition"\n'
'          System Admin and Supervisor always get "All"\n'
'zone:     enum of 6 geopolitical zones\n'
'states:   [String] — geographic scope for field agents\n'
'permissions: {canCreate, canEdit, canDelete, canExport, canViewAll,\n'
'              canManageUsers, canViewAudit, canManageSettings, canApprove}\n'
'             NOTE: ignored for System Admin — role defaults are absolute\n'
'isActive, stats: {assetsCreated, totalActions, lastActiveAt}'
))
story.append(gap(8))

story.append(Paragraph('5.4 M&E Report (embedded in Asset.meReports)', S['h2']))
story.append(code_block(
'contractNo, contractorName, contractorAddress, contractSum\n'
'contractPeriod, commencementDate, completionPeriod, reportLocation\n'
'reportType:  enum ["secretariat", "nhp"]\n'
'reportMonth: 1-12,  reportYear: Number\n'
'tasks:       [{label: String, percentage: 0-100}]\n'
'             Secretariat: 10 tasks  |  NHP: 9 tasks\n'
'overallPercentage: 0-100\n'
'labourRating, materialsRating, progressRating, workmanshipRating:\n'
'             enum [Very Good, Good, Fair, Poor]\n'
'otherComments, craName, craDesignation, craDate\n'
'clearanceIssued: Boolean, clearanceDate, satisfactory: Boolean\n'
'unsatisfactoryWorks, facilityManagerName, facilityManagerDesig, facilityManagerDate\n'
'status: enum [Draft, Submitted, Cleared, Not Cleared]\n'
'submittedBy: ref User,  submittedAt: Date'
))
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 6. ALL FRONTEND PAGES
# ══════════════════════════════════════════════════════════════════════
story += section_header('6. All Frontend Pages', '16 app pages + public pages')

page_data = [
    ['Page', 'File', 'JS Module', 'Division', 'Notes'],
    ['Dashboard',     'dashboard.html',   'dashboard.js',     'All',      'KPIs, charts, activity feed, asset stats'],
    ['Live Map',      'map.html',         'map.js+map_spatial.js','All',  'Leaflet clustering, spatial filter, GeoJSON'],
    ['Asset Registry','assets.html',      'asset_detail.js+assets.js','Assets','List, search, filter, bulk ops, detail modal'],
    ['Asset Detail',  'asset-view.html',  'asset_detail.js',  'All',      '10 tabs: Overview/Photos/Location/Maintenance/etc'],
    ['Field Capture', 'capture.html',     'capture.js',       'Assets',   'GPS form, photo upload, asset code generation'],
    ['Approvals',     'approvals.html',   'approvals.js',     'Sup+',     'Sub-Head/Supervisor/Admin only'],
    ['Inspections',   'inspections.html', 'inspections.js',   'Assets',   'Schedule, conduct, record condition inspections'],
    ['M&E Reports',   'me.html',          'inline script',    'M&E',      'Progress reports, clearance certs, stats bar'],
    ['Analytics',     'analytics.html',   'analytics.js',     'All',      'Charts: by type/state/condition/time'],
    ['Users',         'users.html',       'users.js',         'Admin',    'CRUD, role+division assignment, permission overrides'],
    ['OCR Scanner',   'ocr.html',         'ocr.js',           'All',      'Bull queue, AI extraction, job polling'],
    ['Excel Import',  'excel.html',       'excel.js',         'All',      'Bulk asset import from Excel/CSV'],
    ['File Database', 'filedb.html',      'inline script',    'All',      'Cross-asset GridFS file browser (44KB inline)'],
    ['Audit Log',     'audit.html',       'audit.js',         'Admin+',   'Full platform action audit trail'],
    ['Settings',      'settings.html',    'settings.js',      'Admin',    'Platform config, branding, role defaults'],
    ['Guidelines',    'guidelines.html',  'inline script',    'All',      'FPAM manual, enforcement letter, PDF downloads'],
]
pgt = Table(page_data, colWidths=[28*mm, 35*mm, 30*mm, 20*mm, 52*mm])
pgt.setStyle(TableStyle([
    ('BACKGROUND',    (0,0), (-1,0),  NAVY),
    ('TEXTCOLOR',     (0,0), (-1,0),  WHITE),
    ('FONTNAME',      (0,0), (-1,0),  'Helvetica-Bold'),
    ('FONTSIZE',      (0,0), (-1,-1), 7.5),
    ('GRID',          (0,0), (-1,-1), 0.4, BORDER),
    ('ROWBACKGROUNDS',(0,1), (-1,-1), [WHITE, GRAY]),
    ('VALIGN',        (0,0), (-1,-1), 'TOP'),
    ('TOPPADDING',    (0,0), (-1,-1), 4),
    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ('LEFTPADDING',   (0,0), (-1,-1), 5),
]))
story.append(pgt)
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 7. WHAT IS BUILT VS WHAT REMAINS
# ══════════════════════════════════════════════════════════════════════
story += section_header('7. Build Status — What Is Done vs What Remains',
                        'Exact state as of July 2026')

story.append(Paragraph('7.1 Completed', S['h2']))
for item in [
    'Full asset registry with FGN-coded asset IDs, condition scoring, photo/document storage, lifecycle tracking',
    'Field capture with GPS, photo upload, approval workflow (Field Agent -> Sub-Head -> Supervisor)',
    'M&E division module: monthly progress reports (Secretariat + NHP variants), clearance certificates',
    'Clearance certificates written to asset maintenance log; viewable inline in asset-view.html without redirect',
    'Two-axis permission system (Role x Division) fully implemented in User.js, users.js, app.js',
    'Sidebar nav with division scoping — data-division attributes, runtime filtering by user division',
    'Divisions nav section — M&E and Assets active, Planning/Rehab/Training dimmed with "Soon" badge',
    'Guidelines page with full FPAM maintenance manual content + downloadable PDFs',
    'Analytics, audit log, OCR scanner, Excel importer, File DB, PDF merger all functional',
    'fix_all_navbars.py script — single canonical nav across all 16 pages',
    'migrate_me_maintenance.js — backfills maintenance log entries for already-cleared M&E reports',
]:
    story.append(bullet(item))
story.append(gap(8))

story.append(Paragraph('7.2 Remaining — Three Divisions to Build', S['h2']))

for num, div, desc, features in [
    ('3', 'Planning & Design', 
     'Handles project proposals, site plans, design documentation, and approval workflows before physical work begins.',
     ['Asset-linked planning records (planningRecords array on Asset model)',
      'New page: planning.html with project proposal form',
      'Fields: projectTitle, scope, designDocuments (GridFS), siteplan (GridFS), estimatedCost, priority, status',
      'Workflow: Draft -> Submitted -> Under Review -> Approved/Rejected',
      'Supervisor/Admin can approve; approved plans link to Rehab division for execution',
      'Asset tab: "Planning" tab in asset-view.html showing linked planning records']),
    ('4', 'Rehabilitation & Restoration',
     'Handles maintenance work orders, contractor assignments, repair history, and before/after photo documentation.',
     ['Asset-linked work orders (workOrders array on Asset model)',
      'New page: rehab.html with work order form',
      'Fields: workOrderNo, type (Corrective/Preventive/Emergency), priority, contractorName, '
      'contractorPhone, startDate, endDate, estimatedCost, actualCost, status, photos (GridFS)',
      'Workflow: Raised -> Assigned -> In Progress -> Completed -> Verified',
      'Links to Planning record that triggered the rehab (linkedPlanId)',
      'Asset tab: "Rehabilitation" tab in asset-view.html',
      'Supervisor can verify completion; generates a completion certificate']),
    ('5', 'Building Training & Maintenance',
     'Handles staff training schedules, FPAM certifications, SOP document management, and training compliance.',
     ['New page: training.html',
      'Training sessions: {title, trainer, date, duration, attendees[], topics[], certifications[]}',
      'SOP documents: linked to asset type via GridFS',
      'Staff certification tracking: {staffId, certType, issueDate, expiryDate, status}',
      'Training compliance dashboard: % of MDA staff certified per quarter',
      'Integrates with Users model — certification status shown on user profile']),
]:
    story.append(KeepTogether([
        Paragraph(f'Division {num}: {div}', S['h3']),
        Paragraph(desc, S['body']),
        gap(4),
    ] + [bullet(f, indent=1) for f in features] + [gap(8)]))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 8. CRITICAL KNOWN ISSUES
# ══════════════════════════════════════════════════════════════════════
story += section_header('8. Critical Known Issues & Coding Rules',
                        'Must-know before touching any file')

issues = [
    ('Route ordering', 
     'me_routes.js MUST be mounted before assets.js in src/app.js. '
     'The assets router catch-all GET /:id swallows /:id/me-reports otherwise.'),
    ('assetQuery helper', 
     'Always detect ObjectIds by regex: /^[a-f\\d]{24}$/i.test(id). '
     'Never use id.startsWith("AST-") — new FGN- IDs break this. '
     'Non-ObjectId => {assetId: id}, ObjectId => {_id: id}.'),
    ('validateBeforeSave', 
     'Always use asset.save({validateBeforeSave:false}) in all M&E and division routes. '
     'Legacy assets have enum values (type: "Office Building", condition: "Unknown") '
     'not in current schema — full validation fails on save.'),
    ('Nested backticks in script blocks',
     'Never use backtick template literals inside win.document.write() or any string '
     'that ends up inside a <script> tag. Use string concatenation (+) instead. '
     '</style>, </body>, </html> inside JS strings must be escaped as <\\/style> etc.'),
    ('Duplicate JS declarations',
     'Never use const/let for globals that api.js also declares. '
     'Page shims must use window.x = instead of const x = to avoid SyntaxErrors.'),
    ('MongoDB ID generation',
     'When generating sequence numbers, find the true maximum numeric suffix via '
     'aggregation — never sort by createdAt. Bulk imports with backdated timestamps '
     'cause duplicate key errors otherwise.'),
    ('Photo upload 201 != success',
     'The photo upload route returns HTTP 201 even when the asset is not found. '
     'Always check response body for error strings, not just HTTP status.'),
    ('Pagination cap',
     'Backend caps asset list at ~200 records per request. '
     'Use parallel-fetch with limit/skip params for full dataset operations.'),
    ('System Admin permissions',
     'Per-user permission overrides in MongoDB are ignored for System Admin. '
     'getUserPerms() in app.js returns pure ROLE_DEFAULTS for this role. '
     'This prevents a bad DB state from locking out the admin.'),
    ('Live Server vs localhost:3001',
     'All API calls must go through js/api.js which sets API_BASE = https://fpambacend.onrender.com/api. '
     'Never use relative fetch URLs — Live Server serves on a different port (e.g. 64547).'),
]

for title, desc in issues:
    story.append(KeepTogether([
        Paragraph(f'<b>{title}</b>', S['body']),
        Paragraph(desc, S['body_sm']),
        gap(6),
    ]))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 9. HOW TO ADD A NEW DIVISION MODULE
# ══════════════════════════════════════════════════════════════════════
story += section_header('9. How to Add a New Division Module',
                        'Step-by-step pattern to follow for Planning, Rehab, or Training')

steps = [
    ('Add subdocument schema to Asset.js',
     'Define a new sub-schema (e.g. planningRecordSchema) and add it as an array '
     'field on assetSchema (e.g. planningRecords: [planningRecordSchema]). '
     'Add validateBeforeSave: false to all save() calls in the new route.'),
    ('Create the route file',
     'Copy me_routes.js as a template. Change the path patterns from /me-reports to '
     '/planning-records (or whatever). Fix assetQuery to use the ObjectId regex. '
     'Mount it in app.js BEFORE assetsRoute.'),
    ('Create the HTML page',
     'Copy me.html as a template. Update the page title, header, and active nav item. '
     'Replace the report form with the new division\'s form fields. '
     'Keep the same stats bar, modal, and API patterns.'),
    ('Add division nav link',
     'Update the DIVISIONS list in fix_all_navbars.py: change the href from "#" to '
     'the new page filename and set built=True. Run the script to update all pages.'),
    ('Update app.js division filtering',
     'The data-division attribute on the new nav item handles filtering automatically. '
     'No changes to applyRoleGates() needed — it reads data-division at runtime.'),
    ('Add an asset-view.html tab',
     'Find the av-tab-bar div in asset-view.html and add a new button. '
     'Add a corresponding tab panel div. Add a case to loadTabContent() to render it. '
     'The render function should call GET /api/assets/:id/planning-records.'),
    ('Create users with the new division',
     'In users.html, the Division dropdown already has all 5 divisions. '
     'Create a test Field Agent user assigned to the new division to verify access control.'),
    ('Run fix_all_navbars.py',
     'Run: python fix_all_navbars.py --fix\n'
     'This updates all 16 pages with the new nav including the active division link.'),
]

for i, (title, desc) in enumerate(steps, 1):
    story.append(KeepTogether([
        Table([[
            Paragraph(str(i), ParagraphStyle('sn', fontName='Helvetica-Bold',
                      fontSize=12, textColor=WHITE, alignment=TA_CENTER)),
            Paragraph(f'<b>{title}</b><br/>{desc}', S['body_sm']),
        ]], colWidths=[10*mm, 155*mm], style=TableStyle([
            ('BACKGROUND',    (0,0), (0,0),   NAVY),
            ('VALIGN',        (0,0), (-1,-1),  'TOP'),
            ('TOPPADDING',    (0,0), (-1,-1),  6),
            ('BOTTOMPADDING', (0,0), (-1,-1),  6),
            ('LEFTPADDING',   (0,0), (0,0),    0),
            ('RIGHTPADDING',  (0,0), (0,0),    0),
            ('LEFTPADDING',   (1,0), (1,0),    8),
            ('GRID',          (0,0), (-1,-1),  0.4, BORDER),
        ])),
        gap(5),
    ]))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 10. DEPLOYMENT & ENVIRONMENT
# ══════════════════════════════════════════════════════════════════════
story += section_header('10. Deployment & Environment', 'Local dev and production configuration')

story.append(info_table([
    ('Local Backend',   'https://fpambacend.onrender.com — npm run dev (nodemon in src/)'),
    ('Local Frontend',  'VS Code Live Server or any static file server'),
    ('Production API',  'https://fpambacend.onrender.com/api (Render deployment)'),
    ('Production Web',  'https://fpam.vercel.app (Vercel deployment)'),
    ('Planned Domain',  'https://fpam.fmhud.gov.ng'),
    ('Database (local)','mongodb://localhost:27017/assetspatial'),
    ('Default Admin',   'admin@assetspatial.gov.ng / ChangeMe123!'),
    ('Node version',    'v20.19.6'),
    ('MongoDB version', '7.x'),
    ('Redis',           'Optional — platform runs without it (graceful fallback)'),
]))
story.append(gap(10))

story.append(Paragraph('10.1 Key Environment Variables (src/config/.env)', S['h2']))
story.append(code_block(
'MONGO_URI=mongodb://localhost:27017/assetspatial\n'
'JWT_SECRET=your_jwt_secret_here\n'
'PORT=3001\n'
'NODE_ENV=development\n'
'MAX_DOCUMENT_SIZE_MB=50\n'
'ANTHROPIC_API_KEY=sk-ant-...  (for AI insights)\n'
'REDIS_URL=redis://localhost:6379  (optional)'
))
story.append(gap(10))

story.append(Paragraph('10.1 One-Time Migration Scripts', S['h2']))
story.append(info_table([
    ('migrate_me_maintenance.js',
     'Backfills maintenanceLogs entries for M&E reports that were Cleared before '
     'the maintenance log write was added to me_routes.js. Run once from backend root.'),
    ('fix_all_navbars.py',
     'Replaces sidebar nav on all 16 HTML pages with canonical version. '
     'Run whenever a new nav item is added. Safe to run multiple times.'),
], col_w=[55*mm, 110*mm]))
story.append(gap(10))

# Footer note
story.append(KeepTogether([
    hr(),
    gap(4),
    Paragraph(
        '<b>AssetSpatial — Technical Handoff Documentation</b><br/>'
        'Federal Public Assets Maintenance (FPAM) Directorate · '
        'Federal Ministry of Housing and Urban Development (FMHUD)<br/>'
        'CONFIDENTIAL — For internal development use only · '
        f'Generated {datetime.datetime.now().strftime("%d %B %Y")}',
        ParagraphStyle('foot', fontName='Helvetica', fontSize=8,
                       textColor=TEXT3, alignment=TA_CENTER, leading=13)),
]))

# ── Build ─────────────────────────────────────────────────────────────────────
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print('Done.')
