// ── ASSET REGISTRY ──────────────────────────────────────────────────────────
let allAssets = [];
let _lastAssessed = '';        // full result set for the current filter (across all backend pages)
let filteredAssets = [];   // allAssets after client-side search/geom/mda filtering
let selectedAssetIds = new Set();

const ASSETS_PAGE_SIZE = 50;  // rows shown per page in the table
let currentPage = 1;

// Canonical list of Nigeria's 36 states + FCT (matches the #filter-state dropdown).
// Used to validate the freeform `state` field before it's counted in the stats
// bar — bulk imports can leave typos, blanks, or non-state text in that column,
// which previously inflated the "States" count with garbage values.
const NIGERIA_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Gombe','Imo','Jigawa','Kaduna',
  'Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo',
  'Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara','FCT'];

const _NIGERIA_STATES_LOOKUP = new Map(NIGERIA_STATES.map(s => [s.toLowerCase(), s]));

// Returns the canonical state name if `raw` matches a real Nigerian state
// (trimmed, case-insensitive), otherwise null so it gets excluded from counts.
function normalizeNigeriaState(raw) {
  if (!raw) return null;
  return _NIGERIA_STATES_LOOKUP.get(String(raw).trim().toLowerCase()) || null;
}

// The backend hard-caps any single request at 200 records (assetService.js
// listAssets: Math.min(200, limit)), so a 1000+ asset database needs multiple
// requests to retrieve in full. This fetches page 1 to learn the total page
// count, then fires the remaining pages in parallel.
async function fetchAllAssets(baseParams = {}) {
  const BACKEND_PAGE_LIMIT = 200;
  const SAFETY_MAX_PAGES   = 50; // hard ceiling: 50 * 200 = 10,000 assets

  const first = await apiGetAssets({ ...baseParams, page: 1, limit: BACKEND_PAGE_LIMIT });
  let combined = first.assets || [];
  const totalPages = Math.min(first.pages || 1, SAFETY_MAX_PAGES);

  if (totalPages > 1) {
    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        apiGetAssets({ ...baseParams, page: i + 2, limit: BACKEND_PAGE_LIMIT })
      )
    );
    rest.forEach(r => { combined = combined.concat(r.assets || []); });
  }
  return combined;
}

async function renderAssets() {
  currentPage = 1;
  try {
    // Pass assessed as a backend filter — avoids fetching 2600+ assets when filtering
    const assessed = document.getElementById('filter-assessed')?.value || '';
    const params   = {};
    if (assessed) params.assessed = assessed;
    allAssets = await fetchAllAssets(params);
    filteredAssets = [...allAssets];
  } catch (err) {
    allAssets = [...assets];
    filteredAssets = [...allAssets];
    toast(isNetworkError(err) ? 'Offline — showing locally cached assets' : `Could not load assets: ${err.message}`,
          'fa-triangle-exclamation', true);
  }
  applyFiltersAndRender();
}

function renderAssetsTable(list) {
  // ── STATS BAR ──────────────────────────────────────────────────────────────
  // Runs unconditionally (even when the filtered list is empty) so the bar
  // always reflects the current filter, not just the current page.
  const uniqueStates = [...new Set(filteredAssets.map(a => normalizeNigeriaState(a.state)).filter(Boolean))].sort();
  const uniqueLgas   = [...new Set(filteredAssets.map(a => a.lga).filter(Boolean))].sort();
  const goodCount    = filteredAssets.filter(a => a.condition === 'Good').length;
  const critCount    = filteredAssets.filter(a => a.condition === 'Critical').length;
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('stat-bar-total',    filteredAssets.length);
  setEl('stat-bar-states',   uniqueStates.length);
  setEl('stat-bar-lgas',     uniqueLgas.length);
  setEl('stat-bar-good',     goodCount);
  setEl('stat-bar-critical', critCount);
  const listEl = document.getElementById('stat-bar-states-list');
  if (listEl) listEl.textContent = uniqueStates.length ? uniqueStates.join(' · ') : '';

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / ASSETS_PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * ASSETS_PAGE_SIZE;
  const pageItems = list.slice(start, start + ASSETS_PAGE_SIZE);

  const tbody = document.getElementById('assets-tbody');
  if (!total) {
    tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state">
      <div class="empty-icon"><i class="fa-solid fa-layer-group"></i></div>
      <div class="empty-title">No assets found</div>
      <div class="empty-sub">Adjust filters or capture a new asset</div>
    </div></td></tr>`;
    renderAssetsPagination(0, 0, 0);
    return;
  }

  const canEditRow   = typeof can !== 'function' || can('canEdit');
  const canDeleteRow = typeof can !== 'function' || can('canDelete');
  tbody.innerHTML = pageItems.map(a => {
    const id = a.assetId || a.id;
    const geom = a.geomType || a.geom || '—';
    const agent = a.agent || a.capturedBy?.name || '—';
    const assessed = a.assessed || 'Unassessed';
    const stateLga = [a.state, a.lga].filter(Boolean).join(' / ') || '—';
    const rawDate  = a.createdAt || a.date || a.captureDate;
    const captured = rawDate && !isNaN(new Date(rawDate)) ? new Date(rawDate).toLocaleDateString() : (rawDate || '—');
    return `<tr>
      <td style="width:36px"><input type="checkbox" class="asset-row-check" data-id="${id}" onchange="onAssetRowCheck()" ${selectedAssetIds.has(id)?'checked':''}></td>
      <td style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text3)">${escHtml(id)}${a.assetCode && a.assetCode !== id ? `<div style="font-size:9px;opacity:.75">${escHtml(a.assetCode)}</div>` : ''}</td>
      <td><strong>${escHtml(a.name)}</strong>${a.mda ? `<div style="font-size:10px;color:var(--text3)">${escHtml(a.mda)}</div>` : ''}</td>
      <td><span class="tag ${typeColor(a.type)}">${escHtml(a.type)}</span></td>
      <td>${geomIcon(geom)} <span style="font-size:11px;color:var(--text3);margin-left:2px">${geom}</span></td>
      <td><span class="tag ${condColor(a.condition)}">${escHtml(a.condition)}</span></td>
      <td style="font-size:12px;color:var(--text2)">${escHtml(stateLga)}</td>
      <td><span class="tag ${assessed==='Unassessed'?'tag-gray':'tag-green'}">${escHtml(assessed)}</span></td>
      <td>${typeof calcRiskScore !== 'undefined' ? riskBadge(calcRiskScore(a)) : ''}</td>
      <td style="font-size:12px;color:var(--text3)">${escHtml(captured)}<div style="font-size:10px">${escHtml(agent)}</div></td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-xs" onclick="window.location.href='asset-view.html?id='+encodeURIComponent('${id}')" title="View detail">
            <i class="fa-solid fa-eye"></i>
          </button>
          ${canEditRow ? `<button class="btn btn-ghost btn-xs" onclick="openEditAssetById('${escHtml(id)}')" title="Edit">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>` : ''}
          ${canDeleteRow ? `<button class="btn btn-danger btn-xs" onclick="deleteAsset('${escHtml(id)}')" title="Delete">
            <i class="fa-solid fa-trash"></i>
          </button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  renderAssetsPagination(start + 1, Math.min(start + ASSETS_PAGE_SIZE, total), total);
  // Header checkbox reflects only the rows on this page.
  const selAll = document.getElementById('sel-all');
  if (selAll) {
    const ids = pageItems.map(a => a.assetId || a.id);
    selAll.checked = ids.length > 0 && ids.every(i => selectedAssetIds.has(i));
  }
}

// ── PAGINATION CONTROLS ───────────────────────────────────────────────────────
function renderAssetsPagination(from, to, total) {
  const info  = document.getElementById('page-info');
  const pager = document.getElementById('pagination');
  if (info) info.textContent = total ? `Showing ${from}–${to} of ${total} assets` : 'Showing 0 assets';
  if (!pager) return;

  const totalPages = Math.max(1, Math.ceil(total / ASSETS_PAGE_SIZE));
  if (totalPages <= 1) { pager.innerHTML = ''; return; }

  const pageBtn = (label, page, disabled, active) =>
    `<button class="btn btn-ghost btn-xs" style="${active ? 'background:var(--blue,#4A90D9);color:#fff;' : ''}" ${disabled ? 'disabled' : ''} onclick="goToAssetsPage(${page})">${label}</button>`;

  let html = pageBtn('<i class="fa-solid fa-angle-left"></i>', currentPage - 1, currentPage === 1, false);

  const window_ = 1;
  const pagesToShow = new Set([1, totalPages]);
  for (let p = currentPage - window_; p <= currentPage + window_; p++) {
    if (p >= 1 && p <= totalPages) pagesToShow.add(p);
  }
  let prev = 0;
  [...pagesToShow].sort((a, b) => a - b).forEach(p => {
    if (p - prev > 1) html += `<span style="padding:0 6px;color:var(--text3)">…</span>`;
    html += pageBtn(String(p), p, false, p === currentPage);
    prev = p;
  });

  html += pageBtn('<i class="fa-solid fa-angle-right"></i>', currentPage + 1, currentPage === totalPages, false);
  pager.innerHTML = html;
}

function goToAssetsPage(p) {
  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / ASSETS_PAGE_SIZE));
  currentPage = Math.min(Math.max(1, p), totalPages);
  renderAssetsTable(filteredAssets);
}

function applyFiltersAndRender() {
  currentPage = 1;
  const q        = (document.getElementById('search-input')?.value || '').trim().toLowerCase();
  const type     = document.getElementById('filter-type')?.value     || '';
  const cond     = document.getElementById('filter-cond')?.value     || '';
  const assessed = document.getElementById('filter-assessed')?.value || '';
  const geom     = document.getElementById('filter-geom')?.value     || '';
  const state    = document.getElementById('filter-state')?.value    || '';
  const mda      = document.getElementById('filter-mda')?.value      || '';
  const sort     = document.getElementById('filter-sort')?.value     || 'newest';
  const photosFirst = document.getElementById('filter-photos-first')?.checked;

  filteredAssets = allAssets.filter(a => {
    if (q && !(
      (a.name    ||'').toLowerCase().includes(q) ||
      (a.assetId ||'').toLowerCase().includes(q) ||
      (a.assetCode||'').toLowerCase().includes(q) ||
      (a.mda     ||'').toLowerCase().includes(q) ||
      (a.address ||'').toLowerCase().includes(q) ||
      (a.state   ||'').toLowerCase().includes(q) ||
      (a.lga     ||'').toLowerCase().includes(q) ||
      (a.type    ||'').toLowerCase().includes(q) ||
      (a.notes   ||'').toLowerCase().includes(q)
    )) return false;
    if (type     && a.type                           !== type)     return false;
    if (cond     && a.condition                      !== cond)     return false;
    if (assessed && (a.assessed||'Unassessed')       !== assessed) return false;
    if (geom     && (a.geomType||a.geom)             !== geom)     return false;
    // Normalised the same way as the stats bar, so "lagos " / "Abuja" still match.
    if (state    && normalizeNigeriaState(a.state)   !== normalizeNigeriaState(state)) return false;
    if (mda      && a.mda                            !== mda)      return false;
    return true;
  });

  const COND_RANK = { Good:0, Fair:1, Poor:2, Critical:3, Unknown:4 };
  const photoCount = a => a.photos?.length || a.photoCount || 0;
  if (photosFirst) {
    filteredAssets.sort((a, b) => photoCount(b) - photoCount(a));
  } else {
    filteredAssets.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      switch (sort) {
        case 'oldest':      return ta - tb;
        case 'newest':      return tb - ta;
        case 'name_az':     return (a.name||'').localeCompare(b.name||'');
        case 'name_za':     return (b.name||'').localeCompare(a.name||'');
        case 'state_az':    return (a.state||'').localeCompare(b.state||'');
        case 'cond_best':   return (COND_RANK[a.condition]??4) - (COND_RANK[b.condition]??4);
        case 'cond_worst':  return (COND_RANK[b.condition]??4) - (COND_RANK[a.condition]??4);
        case 'photos_most': return photoCount(b) - photoCount(a);
        default:            return tb - ta;
      }
    });
  }
  renderAssetsTable(filteredAssets);
}

function filterAssets() {
  // assessed changes need a backend re-fetch; other filters work client-side
  const assessed = document.getElementById('filter-assessed')?.value || '';
  if (assessed !== (_lastAssessed || '')) {
    _lastAssessed = assessed;
    renderAssets();
  } else {
    applyFiltersAndRender();
  }
}
function clearFilters() {
  ['search-input','filter-type','filter-cond','filter-geom','filter-state','filter-mda'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const photosFirst = document.getElementById('filter-photos-first');
  if (photosFirst) photosFirst.checked = false;
  const sortSel = document.getElementById('filter-sort');
  if (sortSel) sortSel.value = 'oldest';
  const assessedSel = document.getElementById('filter-assessed');
  if (assessedSel) assessedSel.value = '';
  renderAssets();
}

// ── ASSET DETAIL ──────────────────────────────────────────────────────────────
// ── DELETE ────────────────────────────────────────────────────────────────────
async function deleteAsset(id) {
  if (!confirm(`Delete asset ${id}? This cannot be undone.`)) return;
  try {
    await apiDeleteAsset(id);
    toast('Asset deleted', 'fa-trash');
  } catch (err) {
    if (!isNetworkError(err)) { toast(`Delete failed: ${err.message}`, 'fa-circle-xmark', true); return; }
    assets = assets.filter(a => (a.assetId||a.id) !== id);
    saveLocal();
    toast('Offline — deleted locally only', 'fa-trash');
  }
  selectedAssetIds.delete(id);
  updateBulkBar();
  addAudit('ASSET_DELETED', id, null, 'Asset removed');
  renderAssets();
  if (typeof renderDashboard === 'function') renderDashboard();
}

// ── EDIT ──────────────────────────────────────────────────────────────────────
function findLoadedAsset(id) {
  return allAssets.find(x => (x.assetId || x.id) === id) || (assets || []).find(x => (x.assetId || x.id) === id);
}
function openEditAssetById(id) {
  const a = findLoadedAsset(id);
  if (a) openEditAsset(a);
}
// Option lists that keep the asset's current value even if it's a legacy one.
const _withCurrent = (list, v) => (v && !list.includes(v) ? [v, ...list] : list);
const EDIT_TYPES = ['Infrastructure','Land / Property','Utility','Environmental','Equipment','Monument','Administrative Office','Residential','Hospital','School','Laboratory','Warehouse','Court','Security Facility'];
const EDIT_SECTORS = ['Administration & Governance','Defence & Security','Education','Health','Infrastructure & Works','Energy & Power','Agriculture & Food Security','Water Resources','Transportation','Finance & Economy','Justice & Legal Affairs','Environment','Communications & Digital','Social Development','Science & Technology','Trade & Investment','Petroleum & Mineral Resources','Labour & Employment','Foreign Affairs','Culture, Tourism & Sports'];

function openEditAsset(a) {
  const id = a.assetId || a.id;
  openModal('Edit Asset',
    `<div class="form-grid">
      <div class="form-group full"><label class="form-label">Name</label><input class="form-control" id="edit-name" value="${escHtml(a.name)}"></div>
      <div class="form-group"><label class="form-label">Condition</label>
        <select class="form-control" id="edit-cond">
          <option value="" ${a.condition ? '' : 'selected'}>— Not set —</option>
          ${['Good','Fair','Poor','Critical'].map(c=>`<option ${a.condition===c?'selected':''}>${c}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Type</label>
        <select class="form-control" id="edit-type">
          ${_withCurrent(EDIT_TYPES, a.type).map(t=>`<option ${a.type===t?'selected':''}>${escHtml(t)}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Assessment</label>
        <select class="form-control" id="edit-assessed">
          ${['Assessed','Unassessed'].map(v=>`<option ${(a.assessed||'Unassessed')===v?'selected':''}>${v}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Status</label>
        <select class="form-control" id="edit-status">
          ${['Active','Under Maintenance','Decommissioned','Disputed','Recovered'].map(s=>`<option ${(a.status||'Active')===s?'selected':''}>${s}</option>`).join('')}
        </select></div>
      <div class="form-group full"><label class="form-label">MDA / Agency</label>
        <select class="form-control" id="edit-mda"><option value="">— Select MDA —</option></select></div>
      <div class="form-group full"><label class="form-label">Sector</label>
        <select class="form-control" id="edit-sector">
          <option value="">— None —</option>
          ${_withCurrent(EDIT_SECTORS, a.sector).map(t=>`<option ${a.sector===t?'selected':''}>${escHtml(t)}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">State</label><input class="form-control" id="edit-state" value="${escHtml(a.state||'')}"></div>
      <div class="form-group"><label class="form-label">LGA</label><input class="form-control" id="edit-lga" value="${escHtml(a.lga||'')}"></div>
      <div class="form-group full"><label class="form-label">Address</label><input class="form-control" id="edit-address" value="${escHtml(a.address||'')}"></div>
      <div class="form-group full"><label class="form-label">Notes</label><textarea class="form-control" id="edit-notes">${escHtml(a.notes||'')}</textarea></div>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveEditedAsset('${id}')"><i class="fa-solid fa-save"></i> Save Changes</button>`
  );
  populateMdaSelect('edit-mda', a.mda || '');
}

async function saveEditedAsset(id) {
  const prev = findLoadedAsset(id) || {};
  const data = {
    name:      document.getElementById('edit-name')?.value.trim(),
    type:      document.getElementById('edit-type')?.value,
    assessed:  document.getElementById('edit-assessed')?.value,
    sector:    document.getElementById('edit-sector')?.value || '',
    address:   document.getElementById('edit-address')?.value,
    condition: document.getElementById('edit-cond')?.value || null,
    status:    document.getElementById('edit-status')?.value,
    mda:       document.getElementById('edit-mda')?.value || '',
    state:     document.getElementById('edit-state')?.value,
    lga:       document.getElementById('edit-lga')?.value,
    notes:     document.getElementById('edit-notes')?.value,
  };
  if (!data.name) { toast('Name is required', 'fa-triangle-exclamation', true); return; }
  // Send only what changed — re-sending an untouched legacy value (e.g. an old
  // type no longer allowed) would fail validation and block the whole save.
  const before = { name: prev.name, type: prev.type, assessed: prev.assessed || 'Unassessed', sector: prev.sector || '',
    address: prev.address || '', condition: prev.condition || null, status: prev.status || 'Active', mda: prev.mda || '',
    state: prev.state || '', lga: prev.lga || '', notes: prev.notes || '' };
  Object.keys(data).forEach(k => { if ((data[k] ?? '') === (before[k] ?? '')) delete data[k]; });
  if (!Object.keys(data).length) { closeModal(); return; }
  // Lets the backend record the change in conditionHistory.
  if ('condition' in data && prev.condition) data.previousCondition = prev.condition;
  try {
    await apiUpdateAsset(id, data);
    toast('Asset updated', 'fa-circle-check');
  } catch (err) {
    // Keep the modal open so the user can correct e.g. a duplicate name.
    if (!isNetworkError(err)) { toast(`Save failed: ${err.message}`, 'fa-circle-xmark', true); return; }
    const a = assets.find(x => (x.assetId||x.id) === id);
    if (a) Object.assign(a, data);
    saveLocal();
    toast('Offline — saved locally only', 'fa-circle-check');
  }
  addAudit('ASSET_UPDATED', id, null, `${data.name} updated`);
  closeModal();
  renderAssets();
}

// ── BULK ACTIONS ──────────────────────────────────────────────────────────────
function onAssetRowCheck() {
  document.querySelectorAll('.asset-row-check').forEach(c => {
    if (c.checked) selectedAssetIds.add(c.dataset.id); else selectedAssetIds.delete(c.dataset.id);
  });
  updateBulkBar();
}
function toggleSelectAllAssets(checked) {
  document.querySelectorAll('.asset-row-check').forEach(c => {
    c.checked = checked;
    if (checked) selectedAssetIds.add(c.dataset.id); else selectedAssetIds.delete(c.dataset.id);
  });
  updateBulkBar();
}
function updateBulkBar() {
  const n = selectedAssetIds.size;
  // assets.html uses #sel-toolbar (shown via the .open class) + #sel-count.
  document.getElementById('sel-toolbar')?.classList.toggle('open', n > 0);
  const countEl = document.getElementById('sel-count');
  if (countEl) countEl.textContent = n + ' selected';
  const bar = document.getElementById('bulk-action-bar');
  if (bar) bar.classList.toggle('visible', n > 0);
  const bulkCount = document.getElementById('bulk-count');
  if (bulkCount) bulkCount.textContent = n + ' selected';
}
function clearBulkSelection() {
  selectedAssetIds.clear();
  document.querySelectorAll('.asset-row-check').forEach(c => c.checked = false);
  const selAll = document.getElementById('sel-all');
  if (selAll) selAll.checked = false;
  updateBulkBar();
}

async function bulkDelete() {
  if (!selectedAssetIds.size) return;
  if (!confirm(`Delete ${selectedAssetIds.size} assets? This cannot be undone.`)) return;
  let done = 0; const failures = [];
  for (const id of [...selectedAssetIds]) {
    try { await apiDeleteAsset(id); done++; selectedAssetIds.delete(id); }
    catch (err) { failures.push(`${id}: ${err.message}`); }
  }
  addAudit('BULK_DELETE', 'MULTIPLE', null, `${done} assets deleted`);
  updateBulkBar();
  renderAssets();
  if (failures.length) {
    toast(`${done} deleted, ${failures.length} failed — ${failures[0]}`, 'fa-circle-xmark', true);
  } else {
    toast(`${done} asset${done === 1 ? '' : 's'} deleted`, 'fa-trash');
  }
}

function bulkSetCondition() {
  if (!selectedAssetIds.size) return;
  openModal(`Set Condition — ${selectedAssetIds.size} asset${selectedAssetIds.size === 1 ? '' : 's'}`,
    `<div class="form-group full"><label class="form-label">New condition</label>
      <select class="form-control" id="bulk-cond">
        ${['Good','Fair','Poor','Critical'].map(c => `<option>${c}</option>`).join('')}
      </select></div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="bulk-cond-apply" onclick="applyBulkCondition()"><i class="fa-solid fa-save"></i> Apply</button>`
  );
}

async function applyBulkCondition() {
  const cond = document.getElementById('bulk-cond')?.value;
  if (!cond) return;
  const btn = document.getElementById('bulk-cond-apply');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Applying…'; }
  let done = 0, skipped = 0; const failures = [];
  for (const id of [...selectedAssetIds]) {
    const prev = findLoadedAsset(id)?.condition;
    if (prev === cond) { skipped++; continue; }
    try {
      await apiUpdateAsset(id, { condition: cond, ...(prev ? { previousCondition: prev } : {}) });
      done++;
    } catch (err) { failures.push(`${id}: ${err.message}`); }
  }
  addAudit('BULK_UPDATE', 'MULTIPLE', null, `${done} assets set to ${cond}`);
  closeModal();
  renderAssets();
  const msg = `${done} updated${skipped ? `, ${skipped} already ${cond}` : ''}`;
  if (failures.length) toast(`${msg}, ${failures.length} failed — ${failures[0]}`, 'fa-circle-xmark', true);
  else toast(msg, 'fa-circle-check');
}

function bulkExportCSV() {
  downloadExport('csv', [...selectedAssetIds]);
}

// ── STANDALONE PAGE FUNCTIONS ─────────────────────────────────────────────────

// loadAssets = entry point for assets.html
const loadAssets = renderAssets;

// sortBy — click table headers to sort
let _sortField = 'createdAt';
let _sortDir   = 1;  // 1 = ascending (oldest first)

function sortBy(field) {
  if (_sortField === field) { _sortDir *= -1; } else { _sortField = field; _sortDir = -1; }
  const COND_RANK = { Good:0, Fair:1, Poor:2, Critical:3 };
  const key = a => {
    if (field === 'condition') return COND_RANK[a.condition] ?? 4;           // severity, not alphabet
    if (field === 'createdAt') return a.createdAt ? new Date(a.createdAt).getTime() : 0;
    if (field === 'assetId')   return a.assetId || a.id || '';
    return a[field] ?? '';
  };
  filteredAssets.sort((a, b) => {
    const va = key(a), vb = key(b);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * _sortDir;
    // numeric:true -> AST-999 sorts before AST-1001
    return String(va).localeCompare(String(vb), undefined, { numeric: true }) * _sortDir;
  });
  currentPage = 1;
  renderAssetsTable(filteredAssets);
}

// Exports what the registry is showing: the backend applies the same filters.
// (Free-text search is client-side only, so when it's active we export the
// exact matching IDs instead.)
function exportAssets(fmt) {
  const q = (document.getElementById('search-input')?.value || '').trim();
  if (q) { downloadExport(fmt, filteredAssets.map(a => a.assetId || a.id)); return; }
  const filters = {};
  const pick = (id, key) => { const v = document.getElementById(id)?.value; if (v) filters[key] = v; };
  pick('filter-type', 'type'); pick('filter-cond', 'condition'); pick('filter-assessed', 'assessed');
  pick('filter-geom', 'geomType'); pick('filter-state', 'state'); pick('filter-mda', 'mda');
  downloadExport(fmt, null, filters);
}

// Bulk bar for assets.html (uses sel-toolbar + sel-count)
function toggleSelectAll(checked) { toggleSelectAllAssets(checked); }
function clearSelection() { clearBulkSelection(); }
function bulkExport(fmt) { downloadExport(fmt, [...selectedAssetIds]); }

// ── PERCENTAGE EXPORT (Assessed / Unassessed) ─────────────────────────────────
// Lets a user export e.g. "20% of Assessed assets" — computes how many assets
// that is, picks that many (sorted alphabetically for reproducibility), shows
// a preview with sample asset names, then exports that exact set via the
// existing /assets/export/bulk endpoint (downloadExport handles the fetch).
let _peIds = [];        // asset IDs currently staged for percentage export
let _peSelection = [];  // full asset objects for the staged selection

function _peAnchor() {
  // Prefer inserting right next to the existing "Assessed" filter so this
  // reads as part of the filter bar. Falls back to just above the table.
  const filterAssessed = document.getElementById('filter-assessed');
  if (filterAssessed) {
    return filterAssessed.closest('.filters-row, .filter-row, .filter-bar, .filters, .toolbar, form') || filterAssessed.parentElement;
  }
  const tbody = document.getElementById('assets-tbody');
  if (tbody) {
    const table = tbody.closest('table');
    return table ? table.parentElement : tbody.parentElement;
  }
  return null;
}

function initPercentExportUI() {
  if (document.getElementById('percent-export-panel')) return; // already injected
  const anchor = _peAnchor();
  if (!anchor || !anchor.parentElement) return; // page structure not ready — skip silently

  const panel = document.createElement('div');
  panel.id = 'percent-export-panel';
  panel.style.cssText = 'background:#fff;border:1px solid var(--border,#dde3ec);border-radius:8px;'
    + 'padding:14px 18px;margin:14px 0;display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px';
  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px;color:var(--navy,#0B2545);margin-right:4px">
      <i class="fa-solid fa-percent"></i> Percentage Export
    </div>
    <div>
      <label style="display:block;font-size:11px;color:#5A6A7A;margin-bottom:4px">Data set</label>
      <select id="pe-assessed" class="form-control" style="min-width:150px">
        <option value="Assessed">Assessed assets</option>
        <option value="Unassessed">Unassessed assets</option>
        <option value="">All assets</option>
      </select>
    </div>
    <div>
      <label style="display:block;font-size:11px;color:#5A6A7A;margin-bottom:4px">Percentage to export</label>
      <div style="display:flex;align-items:center;gap:8px">
        <input id="pe-percent" type="number" min="1" max="100" value="20" class="form-control" style="width:80px">
        <span style="font-size:13px;color:#5A6A7A">%</span>
      </div>
    </div>
    <button type="button" class="btn btn-outline btn-sm" id="pe-preview-btn" onclick="previewPercentExport()">
      <i class="fa-solid fa-magnifying-glass"></i> Preview &amp; Export
    </button>
    <span id="pe-hint" style="font-size:11.5px;color:#5A6A7A"></span>
  `;
  anchor.insertAdjacentElement('afterend', panel);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPercentExportUI);
} else {
  initPercentExportUI();
}

async function previewPercentExport() {
  const assessedVal = document.getElementById('pe-assessed')?.value ?? '';
  const pctRaw       = document.getElementById('pe-percent')?.value;
  const hint         = document.getElementById('pe-hint');
  const btn          = document.getElementById('pe-preview-btn');
  let pct = Math.round(Number(pctRaw));
  if (!Number.isFinite(pct) || pct < 1) pct = 1;
  if (pct > 100) pct = 100;
  const pctEl = document.getElementById('pe-percent');
  if (pctEl) pctEl.value = pct;

  const label = assessedVal === 'Assessed' ? 'Assessed' : assessedVal === 'Unassessed' ? 'Unassessed' : 'All';

  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading…'; }
  if (hint) hint.textContent = '';

  let list = [];
  try {
    const params = assessedVal ? { assessed: assessedVal } : {};
    list = await fetchAllAssets(params);
  } catch {
    list = allAssets.filter(a => !assessedVal || (a.assessed || 'Unassessed') === assessedVal);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Preview &amp; Export'; }
  }

  const total = list.length;
  if (!total) {
    if (hint) hint.textContent = `No ${label.toLowerCase()} assets found.`;
    toast(`No ${label.toLowerCase()} assets found`, 'fa-circle-info');
    return;
  }

  const count = Math.max(1, Math.round((pct / 100) * total));
  const sorted = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  _peSelection = sorted.slice(0, count);
  _peIds = _peSelection.map(a => a.assetId || a.id);

  if (hint) hint.textContent = `≈ ${count} of ${total} ${label.toLowerCase()} assets`;

  const SAMPLE_SHOW = 10;
  const sampleRows = _peSelection.slice(0, SAMPLE_SHOW).map(a => {
    const id = escHtml(a.assetId || a.id || '—');
    const nm = escHtml(a.name || 'Unnamed asset');
    const cond = escHtml(a.condition || 'Unknown');
    return `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--border,#eef1f5)">
      <div style="min-width:0"><div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nm}</div>
      <div style="font-family:'Space Mono',monospace;font-size:10px;color:#5A6A7A">${id}</div></div>
      <span class="tag ${condColor ? condColor(a.condition) : ''}" style="flex-shrink:0;align-self:center">${cond}</span>
    </div>`;
  }).join('');
  const moreCount = _peSelection.length - SAMPLE_SHOW;

  openModal(
    `Export ${pct}% of ${label} Assets`,
    `<div style="margin-bottom:14px">
      <div style="font-size:24px;font-weight:700;color:var(--navy,#0B2545)">${count.toLocaleString()} <span style="font-size:14px;font-weight:400;color:#5A6A7A">of ${total.toLocaleString()} ${label.toLowerCase()} assets (${pct}%)</span></div>
      <div style="font-size:11px;color:#5A6A7A;margin-top:4px">Sorted alphabetically — the first ${count.toLocaleString()} will be exported.</div>
    </div>
    <div style="max-height:320px;overflow-y:auto;border:1px solid var(--border,#dde3ec);border-radius:6px;padding:0 12px">
      ${sampleRows || '<div style="padding:12px 0;color:#5A6A7A;font-size:12px">No preview available.</div>'}
      ${moreCount > 0 ? `<div style="padding:8px 0;font-size:11.5px;color:#5A6A7A">+ ${moreCount.toLocaleString()} more asset${moreCount === 1 ? '' : 's'}</div>` : ''}
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-outline" onclick="exportPercentSelection('json')"><i class="fa-solid fa-file-code"></i> JSON</button>
     <button class="btn btn-outline" onclick="exportPercentSelection('geojson')"><i class="fa-solid fa-map"></i> GeoJSON</button>
     <button class="btn btn-outline" onclick="exportPercentSelection('xlsx')"><i class="fa-solid fa-file-excel"></i> XLSX</button>
     <button class="btn btn-outline" onclick="exportPercentSelection('pdf')"><i class="fa-solid fa-file-pdf"></i> PDF</button>
     <button class="btn btn-primary" onclick="exportPercentSelection('csv')"><i class="fa-solid fa-file-csv"></i> CSV</button>`
  );
}

function exportPercentSelection(fmt) {
  if (!_peIds.length) { toast('Nothing staged to export', 'fa-triangle-exclamation', true); return; }
  downloadExport(fmt, _peIds);
  if (typeof addAudit === 'function') {
    addAudit('PERCENT_EXPORT', 'MULTIPLE', null, `${_peIds.length} assets exported as ${fmt.toUpperCase()} (percentage export)`);
  }
  toast(`Exporting ${_peIds.length} assets as ${fmt.toUpperCase()}`, 'fa-download');
  closeModal();
}