'use strict';
// ── INVENTORY TAB ─────────────────────────────────────────────────────────────
// Renders the Inventory tab on asset-view.html, wired the same way as
// renderMaintenanceTab / renderDocumentsTab in asset_detail.js.
//
// Include after api.js:
//   <script src="js/inventory_grid.js"></script>
// Then in asset-view.html's loadTabContent():
//   if (name === 'inventory') renderInventoryTab(id, a);
//
// Add the tab button + panel to asset-view.html (see integration notes).

const CATEGORY_ORDER = ['MECHANICAL', 'ELECTRICAL', 'STRUCTURAL', 'OTHER'];
const CATEGORY_LABELS = {
  MECHANICAL: 'Mechanical', ELECTRICAL: 'Electrical',
  STRUCTURAL: 'Structural', OTHER: 'Other',
};

let _invAssetId  = null;
let _invItems    = [];
let _invDrafts   = [];   // pending import preview rows, before commit
let _invFilename = '';

// ── PERMISSION HELPER ─────────────────────────────────────────────────────────
// Gates every mutating control (add/edit/delete/import) on canEditInventory.
// Falls back to true if can() isn't loaded (e.g. page doesn't include app.js
// yet) so this never silently hides everything during a partial rollout —
// the backend routes are the real enforcement point regardless.
function _invCanEdit() {
  return typeof can === 'function' ? can('canEditInventory') : true;
}

// ── API HELPERS ───────────────────────────────────────────────────────────────
async function apiGetInventory(assetId) {
  return apiFetch(`/assets/${assetId}/inventory`);
}
async function apiAddInventoryItem(assetId, item) {
  return apiFetch(`/assets/${assetId}/inventory`, { method: 'POST', body: item });
}
async function apiUpdateInventoryItem(assetId, itemId, item) {
  return apiFetch(`/assets/${assetId}/inventory/${itemId}`, { method: 'PUT', body: item });
}
async function apiDeleteInventoryItem(assetId, itemId) {
  return apiFetch(`/assets/${assetId}/inventory/${itemId}`, { method: 'DELETE' });
}
async function apiImportInventoryPreview(assetId, file) {
  const fd = new FormData();
  fd.append('file', file);
  const token = localStorage.getItem('as_token');
  const res = await fetch(`${API_BASE}/assets/${assetId}/inventory/import-preview`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Import preview failed');
  return res.json();
}
async function apiImportInventoryCommit(assetId, items, sourceFilename) {
  return apiFetch(`/assets/${assetId}/inventory/import-commit`, {
    method: 'POST',
    body: { items, sourceFilename },
  });
}

// ── MAIN RENDER ───────────────────────────────────────────────────────────────
async function renderInventoryTab(assetId, asset) {
  _invAssetId = assetId;
  const el = document.getElementById('inventory-panel-content');
  if (!el) return;
  el.innerHTML = `<div style="text-align:center;padding:40px"><div class="spinner"></div></div>`;

  try {
    const r = await apiGetInventory(assetId);
    _invItems = r.items || [];
    _renderInventoryBody();
  } catch (e) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <div class="empty-title">Could not load inventory</div>
      <div class="empty-sub">${escHtml(e.message)}</div>
    </div>`;
  }
}

function _invStats() {
  const total = _invItems.length;
  const defects = _invItems.filter(i => i.hasDefect).length;
  const byCat = {};
  _invItems.forEach(i => { byCat[i.category] = (byCat[i.category] || 0) + 1; });
  return { total, defects, byCat };
}

function _renderInventoryBody() {
  const el = document.getElementById('inventory-panel-content');
  if (!el) return;
  const stats = _invStats();
  const canEdit = _invCanEdit();

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px">
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div class="inv-stat-pill"><b>${stats.total}</b> items</div>
        <div class="inv-stat-pill" style="${stats.defects ? 'background:#FDECEC;color:#C0392B' : ''}"><b>${stats.defects}</b> flagged defective</div>
        ${CATEGORY_ORDER.filter(c => stats.byCat[c]).map(c =>
          `<div class="inv-stat-pill">${CATEGORY_LABELS[c]}: <b>${stats.byCat[c]}</b></div>`
        ).join('')}
        ${!canEdit ? `<div class="inv-stat-pill" style="background:var(--bg);color:var(--text3)"><i class="fa-solid fa-lock" style="margin-right:4px"></i>Read-only</div>` : ''}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${canEdit ? `
          <label class="btn btn-secondary btn-sm" style="cursor:pointer">
            <i class="fa-solid fa-file-import"></i> Import Excel
            <input type="file" accept=".xlsx,.xls" style="display:none" onchange="handleInventoryImportFile(this.files[0])">
          </label>
        ` : ''}
        <button class="btn btn-secondary btn-sm" onclick="downloadInventoryExport()">
          <i class="fa-solid fa-file-export"></i> Export
        </button>
        ${canEdit ? `
          <button class="btn btn-primary btn-sm" onclick="addInventoryRow()">
            <i class="fa-solid fa-plus"></i> Add Item
          </button>
        ` : ''}
      </div>
    </div>

    <div id="inv-import-status"></div>

    ${_invItems.length ? _renderInventoryTable() : `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-solid fa-boxes-stacked"></i></div>
        <div class="empty-title">No inventory recorded yet</div>
        <div class="empty-sub">${canEdit ? 'Add items manually or import an existing condition-assessment sheet' : 'Nothing has been recorded for this asset yet'}</div>
      </div>
    `}

    <style>
      .inv-stat-pill { font-size:11px; font-weight:600; padding:5px 12px; border-radius:20px; background:var(--bg); border:1px solid var(--border); color:var(--text2); }
      .inv-table { width:100%; border-collapse:collapse; font-size:12px; }
      .inv-table th { text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:var(--text3); font-weight:700; padding:8px 6px; border-bottom:2px solid var(--border); white-space:nowrap; }
      .inv-table td { padding:5px 6px; border-bottom:1px solid var(--border); vertical-align:top; }
      .inv-table input, .inv-table select { width:100%; border:1px solid transparent; background:transparent; font-size:12px; padding:3px 4px; border-radius:4px; font-family:var(--font); color:var(--text); }
      .inv-table input:hover, .inv-table select:hover { border-color:var(--border); }
      .inv-table input:focus, .inv-table select:focus { border-color:var(--blue); outline:none; background:var(--card); }
      .inv-cat-header td { background:var(--bg); font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:var(--text2); padding:8px 6px; }
      .inv-defect-yes { color:#C0392B; font-weight:700; }
      .inv-defect-no { color:var(--text3); }
    </style>
  `;
}

function _renderInventoryTable() {
  const grouped = {};
  CATEGORY_ORDER.forEach(c => grouped[c] = []);
  _invItems.forEach(i => (grouped[i.category] || grouped.OTHER).push(i));

  const rows = [];
  CATEGORY_ORDER.forEach(cat => {
    if (!grouped[cat].length) return;
    rows.push(`<tr class="inv-cat-header"><td colspan="10">${CATEGORY_LABELS[cat]} (${grouped[cat].length})</td></tr>`);
    grouped[cat].forEach(item => rows.push(_renderInventoryRow(item)));
  });

  return `
    <div style="overflow-x:auto">
      <table class="inv-table">
        <thead>
          <tr>
            <th>Int/Ext</th><th>Room</th><th>Floor</th><th>Item</th><th>Description</th>
            <th>Qty</th><th>Not Func.</th><th>Defect?</th><th>Comment</th><th></th>
          </tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
}

function _renderInventoryRow(item) {
  const id = item._id;
  const canEdit = _invCanEdit();

  // Read-only rendering: plain cells, no inputs, no delete button. Kept as a
  // fully separate branch (rather than `disabled` attributes) so screen
  // readers and the DOM itself never expose form controls a user isn't
  // permitted to submit — matches how data-require hides elements elsewhere.
  if (!canEdit) {
    return `<tr data-item-id="${id}">
      <td>${item.location === 'EXTERNAL' ? 'External' : 'Internal'}</td>
      <td>${escHtml(item.roomName)}</td>
      <td>${escHtml(item.floorLevel)}</td>
      <td>${escHtml(item.item)}</td>
      <td>${escHtml(item.description)}</td>
      <td>${item.quantity || 0}</td>
      <td>${item.quantityNotFunctioning || 0}</td>
      <td class="${item.hasDefect ? 'inv-defect-yes' : 'inv-defect-no'}">${item.hasDefect ? 'Y' : 'N'}</td>
      <td>${escHtml(item.comment)}</td>
      <td></td>
    </tr>`;
  }

  return `<tr data-item-id="${id}">
    <td><select onchange="updateInventoryField('${id}','location',this.value)">
      <option value="INTERNAL" ${item.location==='INTERNAL'?'selected':''}>Internal</option>
      <option value="EXTERNAL" ${item.location==='EXTERNAL'?'selected':''}>External</option>
    </select></td>
    <td><input value="${escAttr(item.roomName)}" onchange="updateInventoryField('${id}','roomName',this.value)"></td>
    <td><input value="${escAttr(item.floorLevel)}" onchange="updateInventoryField('${id}','floorLevel',this.value)"></td>
    <td><input value="${escAttr(item.item)}" onchange="updateInventoryField('${id}','item',this.value)"></td>
    <td><input value="${escAttr(item.description)}" onchange="updateInventoryField('${id}','description',this.value)"></td>
    <td><input type="number" min="0" style="width:56px" value="${item.quantity||0}" onchange="updateInventoryField('${id}','quantity',this.value)"></td>
    <td><input type="number" min="0" style="width:56px" value="${item.quantityNotFunctioning||0}" onchange="updateInventoryField('${id}','quantityNotFunctioning',this.value)"></td>
    <td><select class="${item.hasDefect?'inv-defect-yes':'inv-defect-no'}" onchange="updateInventoryField('${id}','hasDefect',this.value==='true')">
      <option value="false" ${!item.hasDefect?'selected':''}>N</option>
      <option value="true" ${item.hasDefect?'selected':''}>Y</option>
    </select></td>
    <td><input value="${escAttr(item.comment)}" onchange="updateInventoryField('${id}','comment',this.value)"></td>
    <td><button class="btn btn-ghost btn-xs" title="Delete" onclick="deleteInventoryRow('${id}')"><i class="fa-solid fa-trash" style="color:#C0392B"></i></button></td>
  </tr>`;
}

// ── ROW ACTIONS ───────────────────────────────────────────────────────────────
// Each of these front-loads a client-side permission check purely for a fast,
// friendly error — the backend's requirePerm('canEditInventory') on every
// mutating route is the actual enforcement and cannot be bypassed from here.
async function updateInventoryField(itemId, field, value) {
  if (!_invCanEdit()) { toast('You do not have permission to edit inventory', 'fa-lock', true); return; }
  try {
    await apiUpdateInventoryItem(_invAssetId, itemId, { [field]: value });
    const item = _invItems.find(i => i._id === itemId);
    if (item) item[field] = value;
    toast('Saved');
  } catch (e) {
    toast('Save failed: ' + e.message, 'fa-triangle-exclamation', true);
  }
}

async function deleteInventoryRow(itemId) {
  if (!_invCanEdit()) { toast('You do not have permission to edit inventory', 'fa-lock', true); return; }
  if (!confirm('Delete this inventory item?')) return;
  try {
    await apiDeleteInventoryItem(_invAssetId, itemId);
    _invItems = _invItems.filter(i => i._id !== itemId);
    _renderInventoryBody();
    toast('Item deleted');
  } catch (e) {
    toast('Delete failed: ' + e.message, 'fa-triangle-exclamation', true);
  }
}

async function addInventoryRow() {
  if (!_invCanEdit()) { toast('You do not have permission to edit inventory', 'fa-lock', true); return; }
  try {
    const r = await apiAddInventoryItem(_invAssetId, {
      location: 'INTERNAL', category: 'OTHER', item: 'New item',
      description: '', quantity: 1, quantityNotFunctioning: 0,
      hasDefect: false, comment: '',
    });
    _invItems.push(r.item);
    _renderInventoryBody();
  } catch (e) {
    toast('Could not add item: ' + e.message, 'fa-triangle-exclamation', true);
  }
}

async function downloadInventoryExport() {
  const token = localStorage.getItem('as_token');
  const res = await fetch(`${API_BASE}/assets/${_invAssetId}/inventory/export`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) { toast('Export failed', 'fa-triangle-exclamation', true); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${_invAssetId}_inventory.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── IMPORT FLOW ───────────────────────────────────────────────────────────────
async function handleInventoryImportFile(file) {
  if (!file) return;
  if (!_invCanEdit()) { toast('You do not have permission to edit inventory', 'fa-lock', true); return; }
  const statusEl = document.getElementById('inv-import-status');
  if (statusEl) statusEl.innerHTML = `<div style="padding:10px;font-size:12px;color:var(--text2)"><div class="spinner" style="display:inline-block;width:14px;height:14px;margin-right:8px"></div>Parsing "${escHtml(file.name)}"…</div>`;

  try {
    const r = await apiImportInventoryPreview(_invAssetId, file);
    _invDrafts = r.drafts || [];
    _invFilename = file.name;
    if (!_invDrafts.length) {
      statusEl.innerHTML = `<div class="empty-state" style="padding:20px">
        <div class="empty-title">No rows recognized</div>
        <div class="empty-sub">${(r.warnings||[]).map(escHtml).join('<br>') || 'Check the sheet has a matching header row.'}</div>
      </div>`;
      return;
    }
    _renderImportPreviewModal(r);
  } catch (e) {
    statusEl.innerHTML = `<div style="padding:10px;color:#C0392B;font-size:12px">${escHtml(e.message)}</div>`;
  }
}

function _renderImportPreviewModal(result) {
  const overlay = document.createElement('div');
  overlay.id = 'inv-import-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:600;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px)';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  const rowsHtml = _invDrafts.map((d, idx) => `
    <tr data-idx="${idx}">
      <td>${idx + 1}</td>
      <td><select onchange="_invDrafts[${idx}].category=this.value">
        ${CATEGORY_ORDER.map(c => `<option value="${c}" ${d.category===c?'selected':''}>${CATEGORY_LABELS[c]}</option>`).join('')}
      </select></td>
      <td><input value="${escAttr(d.roomName)}" onchange="_invDrafts[${idx}].roomName=this.value"></td>
      <td><input value="${escAttr(d.item)}" onchange="_invDrafts[${idx}].item=this.value"></td>
      <td><input value="${escAttr(d.description)}" onchange="_invDrafts[${idx}].description=this.value"></td>
      <td><input type="number" style="width:50px" value="${d.quantity}" onchange="_invDrafts[${idx}].quantity=this.value"></td>
      <td>${d.hasDefect ? '<span style="color:#C0392B;font-weight:700">Y</span>' : 'N'}</td>
      <td><button class="btn btn-ghost btn-xs" onclick="_invDrafts.splice(${idx},1);document.getElementById('inv-import-modal').remove();_renderImportPreviewModal({drafts:_invDrafts,warnings:[]})"><i class="fa-solid fa-xmark"></i></button></td>
    </tr>`).join('');

  overlay.innerHTML = `
    <div style="background:var(--card);border-radius:14px;width:920px;max-width:95vw;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.2)">
      <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:16px;font-weight:700">Review Import — ${escHtml(result.filename||_invFilename)}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">${_invDrafts.length} rows parsed. Review and edit before committing.</div>
        </div>
        <button onclick="document.getElementById('inv-import-modal').remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text3)"><i class="fa-solid fa-xmark"></i></button>
      </div>
      ${(result.warnings||[]).length ? `<div style="padding:10px 22px;background:#FFF8E1;font-size:12px;color:#8a6d00">${result.warnings.map(escHtml).join('<br>')}</div>` : ''}
      <div style="padding:16px 22px;overflow:auto;flex:1">
        <table class="inv-table" style="width:100%">
          <thead><tr><th>#</th><th>Category</th><th>Room</th><th>Item</th><th>Description</th><th>Qty</th><th>Defect</th><th></th></tr></thead>
          <tbody id="inv-import-rows">${rowsHtml}</tbody>
        </table>
      </div>
      <div style="padding:14px 22px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-ghost" onclick="document.getElementById('inv-import-modal').remove()">Cancel</button>
        <button class="btn btn-primary" onclick="commitInventoryImport()"><i class="fa-solid fa-check"></i> Import ${_invDrafts.length} Items</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

async function commitInventoryImport() {
  try {
    const r = await apiImportInventoryCommit(_invAssetId, _invDrafts, _invFilename);
    toast(`Imported ${r.inserted} items`);
    document.getElementById('inv-import-modal')?.remove();
    _invDrafts = [];
    await renderInventoryTab(_invAssetId, null);
  } catch (e) {
    toast('Import failed: ' + e.message, 'fa-triangle-exclamation', true);
  }
}

// ── SMALL HELPERS (in case not already globally defined on this page) ────────
function escAttr(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }