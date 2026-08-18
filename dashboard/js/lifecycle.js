// ── ASSET RELATIONSHIPS (Parent-Child) ────────────────────────────────────────
// Stored as { parentId, childIds[] } in localStorage under 'as_relationships'
// and optionally synced to a backend field. Non-destructive — works alongside
// the existing asset model.
//
// NOTE: This file merges what used to be two separate scripts
// (asset_enhancements.js + lifecycle.js). Both declared the same globals
// (REL_KEY, linkAssets, renderRelationshipsTab, etc.), which throws
// "Identifier has already been declared" as soon as both are loaded on the
// same page. Only include THIS file — do not also include asset_enhancements.js.

const REL_KEY = 'as_relationships';

function _getRelationships() {
  try { return JSON.parse(localStorage.getItem(REL_KEY)) || {}; } catch { return {}; }
}
function _saveRelationships(data) {
  localStorage.setItem(REL_KEY, JSON.stringify(data));
}

function linkAssets(parentId, childId) {
  const rels = _getRelationships();
  if (!rels[parentId]) rels[parentId] = [];
  if (!rels[parentId].includes(childId)) rels[parentId].push(childId);
  // Back-link: record parent on child
  if (!rels[`_parent_${childId}`]) rels[`_parent_${childId}`] = parentId;
  _saveRelationships(rels);
}

function unlinkAssets(parentId, childId) {
  const rels = _getRelationships();
  if (rels[parentId]) rels[parentId] = rels[parentId].filter(id => id !== childId);
  delete rels[`_parent_${childId}`];
  _saveRelationships(rels);
}

function getChildren(assetId) {
  const rels = _getRelationships();
  return rels[assetId] || [];
}

function getParent(assetId) {
  const rels = _getRelationships();
  return rels[`_parent_${assetId}`] || null;
}

// ── RELATIONSHIPS TAB RENDERER ────────────────────────────────────────────────
// Renders immediately from localStorage, then enriches with asset names
// fetched from the API in the background. Only fetches the specific parent/
// child IDs needed (not the whole asset collection).
async function renderRelationshipsTab(assetId, containerEl) {
  if (!containerEl) containerEl = document.getElementById('relationships-panel-content');
  if (!containerEl) return;

  // ── Step 1: Render immediately with IDs only (no API wait) ────────────────
  const children = getChildren(assetId);
  const parentId = getParent(assetId);
  _renderRelUI(assetId, containerEl, children, parentId, {});

  // ── Step 2: Fetch asset details in background, re-render with names ───────
  if (!children.length && !parentId) return; // nothing to enrich
  try {
    const ids = [...children, ...(parentId ? [parentId] : [])];
    // Fetch each asset — use Promise.allSettled so one 404 doesn't block others
    const results = await Promise.allSettled(
      ids.map(id => apiGetAsset(id).catch(() => null))
    );
    const assetMap = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) {
        const a = r.value.asset || r.value;
        assetMap[a.assetId || a.id || ids[i]] = a;
      }
    });
    _renderRelUI(assetId, containerEl, children, parentId, assetMap);
  } catch {}
}

function _renderRelUI(assetId, containerEl, children, parentId, assetMap) {
  const parent = parentId ? (assetMap[parentId] || null) : null;

  containerEl.innerHTML = `
    <!-- Parent -->
    <div style="margin-bottom:20px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);font-weight:700;margin-bottom:10px">Parent Asset</div>
      ${parentId
        ? `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--surface2,var(--bg));border:1px solid var(--border);border-radius:8px">
            <i class="fa-solid fa-sitemap" style="color:var(--blue,#4A90D9);font-size:14px"></i>
            <div style="flex:1">
              <div style="font-weight:600;font-size:13px">${escHtml(parent?.name || parentId)}</div>
              <div style="font-size:10px;color:var(--text3);font-family:'Courier New',monospace">${escHtml(parentId)}</div>
            </div>
            <button class="btn btn-ghost btn-xs" onclick="_doUnlinkParent('${assetId}','${parentId}')">
              <i class="fa-solid fa-unlink"></i> Unlink
            </button>
          </div>`
        : `<div style="font-size:12px;color:var(--text3);padding:10px 0">No parent asset linked.
            <button class="btn btn-ghost btn-xs" style="margin-left:10px" onclick="openLinkParentModal('${assetId}')">
              <i class="fa-solid fa-link"></i> Link Parent
            </button>
          </div>`}
    </div>

    <!-- Children -->
    <div style="margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);font-weight:700">
          Child Assets <span style="font-size:12px;font-weight:400;text-transform:none">(${children.length})</span>
        </div>
        <button class="btn btn-ghost btn-xs" onclick="openLinkChildModal('${assetId}')">
          <i class="fa-solid fa-plus"></i> Link Child
        </button>
      </div>
      ${children.length
        ? children.map(cid => {
            const child = assetMap[cid];
            return `<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;background:var(--surface2,var(--bg));border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
              <i class="fa-solid fa-arrow-turn-down-right" style="color:var(--blue,#4A90D9);font-size:12px"></i>
              <div style="flex:1">
                <div style="font-weight:600;font-size:13px">${escHtml(child?.name || cid)}</div>
                <div style="font-size:10px;color:var(--text3)">
                  <span style="font-family:'Courier New',monospace">${escHtml(cid)}</span>
                  ${child ? ` · ${escHtml(child.type||'—')} · <span style="color:${child.condition==='Critical'?'#e05555':child.condition==='Good'?'#2DB87B':'#f0a500'}">${child.condition||'Unassessed'}</span>` : ''}
                </div>
              </div>
              <button class="btn btn-ghost btn-xs" onclick="_doUnlinkChild('${assetId}','${cid}')">
                <i class="fa-solid fa-unlink"></i>
              </button>
            </div>`;
          }).join('')
        : `<div style="font-size:12px;color:var(--text3);padding:8px 0">No child assets linked.</div>`}
    </div>

    <!-- Roll-up summary -->
    ${children.length && Object.keys(assetMap).length ? `
    <div style="background:var(--surface2,var(--bg));border:1px solid var(--border);border-radius:8px;padding:14px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);font-weight:700;margin-bottom:8px">Portfolio Roll-up</div>
      ${_buildRollup(children.map(cid => assetMap[cid]).filter(Boolean))}
    </div>` : ''}`;
}

function _doUnlinkChild(parentId, childId) {
  unlinkAssets(parentId, childId);
  if (typeof toast === 'function') toast('Child unlinked', 'fa-unlink');
  const el = document.getElementById('relationships-panel-content');
  if (el) renderRelationshipsTab(parentId, el);
}

function _doUnlinkParent(assetId, parentId) {
  unlinkAssets(parentId, assetId);
  if (typeof toast === 'function') toast('Parent unlinked', 'fa-unlink');
  const el = document.getElementById('relationships-panel-content');
  if (el) renderRelationshipsTab(assetId, el);
}

// ── LIFECYCLE TAB ──────────────────────────────────────────────────────────────
// asset-view.html calls renderLifecycleTab(assetId, containerEl) when the
// Lifecycle tab is opened, but this function did not exist anywhere in the
// codebase — the call threw a silent ReferenceError, so the tab's spinner
// placeholder was never replaced with real content and just spun forever.
// The backend (routes/asset_extras_routes.js GET/POST .../lifecycle) and the
// API helpers (apiGetLifecycle/apiLifecycleTransition in api_additions.js)
// already worked fine; only this renderer was missing.
const LC_STAGE_COLORS = {
  Draft:                    '#5A6A7A',
  Active:                   '#2DB87B',
  'Under Maintenance':      '#f0a500',
  'Under Review':           '#4A90D9',
  'Scheduled for Disposal': '#e07000',
  Decommissioned:           '#e05555',
};

async function renderLifecycleTab(assetId, containerEl) {
  if (!containerEl) containerEl = document.getElementById('lifecycle-panel-content');
  if (!containerEl) return;

  containerEl.innerHTML = `<div style="text-align:center;padding:40px"><div class="spinner"></div></div>`;

  let data;
  try {
    data = await apiGetLifecycle(assetId);
  } catch (err) {
    console.error('renderLifecycleTab: apiGetLifecycle failed for', assetId, err);
    containerEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3,#5A6A7A);font-size:13px">
      <i class="fa-solid fa-triangle-exclamation" style="font-size:22px;display:block;margin-bottom:10px;opacity:.5"></i>
      Couldn't load lifecycle data.
      <div style="margin-top:6px;font-family:'Courier New',monospace;font-size:11px;color:#e05555">${escHtml(err.message || String(err))}</div>
      <div style="margin-top:10px"><button class="btn btn-ghost btn-xs" onclick="renderLifecycleTab('${assetId}')">Retry</button></div>
    </div>`;
    return;
  }

  const stage   = data.stage || 'Active';
  const color   = LC_STAGE_COLORS[stage] || '#5A6A7A';
  const allowed = data.allowedTransitions || [];
  const history = data.history || [];
  const docs    = data.documents || [];

  containerEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);font-weight:700;margin-bottom:8px">Current Stage</div>
        <span style="display:inline-flex;align-items:center;gap:7px;padding:7px 16px;border-radius:20px;background:${color}18;color:${color};font-weight:700;font-size:13px">
          <span style="width:8px;height:8px;border-radius:50%;background:${color}"></span> ${escHtml(stage)}
        </span>
      </div>
      ${allowed.length
        ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
            ${allowed.map(s => `<button class="btn btn-secondary btn-sm" onclick="openLifecycleTransitionModal('${assetId}','${escHtml(s)}')">
              <i class="fa-solid fa-arrow-right"></i> ${escHtml(s)}
            </button>`).join('')}
          </div>`
        : `<div style="font-size:12px;color:var(--text3)">No further transitions available${stage === 'Decommissioned' ? ' — asset is decommissioned' : ''}</div>`}
    </div>

    <div style="margin-bottom:${docs.length ? '20px' : '0'}">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);font-weight:700;margin-bottom:10px">Stage History</div>
      ${history.length
        ? history.slice().reverse().map(h => `
          <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border,#E8ECF0)">
            <div style="width:8px;height:8px;border-radius:50%;background:${LC_STAGE_COLORS[h.to] || '#4A90D9'};margin-top:5px;flex-shrink:0"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600">${escHtml(h.from || '—')} → ${escHtml(h.to || '—')}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px">${h.at ? new Date(h.at).toLocaleString('en-NG') : ''}${h.by ? ' · ' + escHtml(h.by) : ''}</div>
              ${h.note ? `<div style="font-size:12px;color:var(--text2);margin-top:4px">${escHtml(h.note)}</div>` : ''}
              ${h.document ? `<div style="font-size:11px;color:var(--accent,#4A90D9);margin-top:2px"><i class="fa-solid fa-paperclip"></i> ${escHtml(h.document)}</div>` : ''}
            </div>
          </div>`).join('')
        : `<div style="font-size:12px;color:var(--text3);padding:8px 0">No stage changes recorded yet.</div>`}
    </div>

    ${docs.length ? `
    <div>
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);font-weight:700;margin-bottom:10px">Lifecycle Documents</div>
      ${docs.map(d => `
        <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--surface2,var(--bg));border:1px solid var(--border,#E8ECF0);border-radius:8px;margin-bottom:6px">
          <i class="fa-solid fa-file-lines" style="color:var(--text3)"></i>
          <div style="flex:1;min-width:0;font-size:12px">${escHtml(d.name)} <span style="color:var(--text3)">— ${escHtml(d.stage)}</span></div>
          <div style="font-size:10px;color:var(--text3)">${d.at ? new Date(d.at).toLocaleDateString('en-NG') : ''}</div>
        </div>`).join('')}
    </div>` : ''}`;
}

function openLifecycleTransitionModal(assetId, stage) {
  _miniModal(`Move to "${stage}"`,
    `<div style="margin-bottom:14px">
      <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;color:var(--text2,#2C3E50)">Note (optional)</label>
      <textarea id="lc-transition-note" rows="3" placeholder="Reason for this transition…"
        style="width:100%;padding:9px 13px;border:1px solid var(--border,#E8ECF0);border-radius:8px;font-family:var(--font,'DM Sans',sans-serif);font-size:13px;color:var(--text,#0B1829);background:var(--bg,#F4F6F9);outline:none;resize:vertical;box-sizing:border-box"></textarea>
    </div>
    <div>
      <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;color:var(--text2,#2C3E50)">Document name (optional)</label>
      <input id="lc-transition-doc" placeholder="e.g. Disposal Approval Memo"
        style="width:100%;padding:9px 13px;border:1px solid var(--border,#E8ECF0);border-radius:8px;font-family:var(--font,'DM Sans',sans-serif);font-size:13px;color:var(--text,#0B1829);background:var(--bg,#F4F6F9);outline:none;box-sizing:border-box">
    </div>`,
    async () => {
      const note = document.getElementById('lc-transition-note')?.value.trim() || '';
      const docu = document.getElementById('lc-transition-doc')?.value.trim() || '';
      try {
        await apiLifecycleTransition(assetId, stage, note, docu);
        if (typeof toast === 'function') toast(`Moved to ${stage}`, 'fa-arrow-right');
        if (typeof addAudit === 'function') addAudit('LIFECYCLE_TRANSITION', assetId, null, `Moved to ${stage}`);
        const el = document.getElementById('lifecycle-panel-content');
        if (el) renderLifecycleTab(assetId, el);
      } catch (err) {
        if (typeof toast === 'function') toast(err.message || 'Transition failed', 'fa-triangle-exclamation');
      }
    },
    'Confirm'
  );
}

// ── SEARCHABLE ASSET PICKER (Link Parent / Link Child modals) ────────────────
// Replaces the old "type the raw asset ID" text field with a search box +
// scrollable, clickable results list, reusing the same search index already
// built for the global search bar (buildSearchIndex/enhancedSearch above).
let _linkPickerSelectedId = null;

function _linkPickerRowHtml(a, isSelected) {
  const id = a.assetId || a.id || '';
  return `<div class="link-picker-row" data-id="${escHtml(id)}" onclick="_linkPickerSelect(this.dataset.id)"
    style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;margin-bottom:4px;
      background:${isSelected ? 'var(--blue,#4A90D9)' : 'var(--surface2,var(--bg))'};
      color:${isSelected ? '#fff' : 'inherit'}">
    <div style="flex:1;min-width:0">
      <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(a.name || '—')}</div>
      <div style="font-size:10px;font-family:'Courier New',monospace;${isSelected ? 'color:rgba(255,255,255,.85)' : 'color:var(--text3,#5A6A7A)'}">
        ${escHtml(id)}${a.type ? ' · ' + escHtml(a.type) : ''}
      </div>
    </div>
    ${isSelected ? '<i class="fa-solid fa-check"></i>' : ''}
  </div>`;
}

async function _linkPickerRender() {
  const listEl = document.getElementById('link-picker-list');
  if (!listEl) return;
  const excludeId = listEl.dataset.exclude || null;

  if (!_searchIndexBuilt) {
    listEl.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text3,#5A6A7A);font-size:12px">
      <div class="spinner" style="width:16px;height:16px;border-width:2px;margin:0 auto 8px"></div>Loading assets…</div>`;
    await buildSearchIndex();
  }

  const q = document.getElementById('link-picker-search')?.value || '';
  let results = q.trim() ? enhancedSearch(q) : _searchIndex.map(x => x.a);
  results = results.filter(a => (a.assetId || a.id) !== excludeId).slice(0, 60);

  listEl.innerHTML = results.length
    ? results.map(a => _linkPickerRowHtml(a, (a.assetId || a.id) === _linkPickerSelectedId)).join('')
    : `<div style="padding:16px;text-align:center;color:var(--text3,#5A6A7A);font-size:12px">No matching assets</div>`;
}

function _linkPickerSelect(id) {
  _linkPickerSelectedId = id;
  _linkPickerRender();
  const label = document.getElementById('link-picker-selected-label');
  if (label) label.textContent = 'Selected: ' + id;
  const confirmBtn = document.getElementById('_mini-modal-confirm');
  if (confirmBtn) confirmBtn.disabled = false;
}

function _linkPickerBodyHtml(excludeId) {
  return `<div style="margin-bottom:10px">
      <input id="link-picker-search" type="text" placeholder="Search by name or ID…" oninput="_linkPickerRender()"
        style="width:100%;padding:9px 13px;border:1px solid var(--border,#E8ECF0);border-radius:8px;font-family:var(--font,'DM Sans',sans-serif);font-size:13px;color:var(--text,#0B1829);background:var(--bg,#F4F6F9);outline:none">
    </div>
    <div id="link-picker-list" data-exclude="${escHtml(excludeId)}"
      style="max-height:280px;overflow-y:auto;border:1px solid var(--border,#E8ECF0);border-radius:8px;padding:6px;margin-bottom:8px">
      <div style="padding:16px;text-align:center;color:var(--text3,#5A6A7A);font-size:12px">Loading assets…</div>
    </div>
    <div id="link-picker-selected-label" style="font-size:11px;color:var(--text3,#5A6A7A)">No asset selected</div>`;
}

function openLinkParentModal(assetId) {
  _linkPickerSelectedId = null;
  _miniModal('Link Parent Asset',
    _linkPickerBodyHtml(assetId),
    () => {
      if (!_linkPickerSelectedId) return;
      const parentId = _linkPickerSelectedId;
      linkAssets(parentId, assetId);
      if (typeof toast === 'function') toast(`Linked under ${parentId}`, 'fa-link');
      if (typeof addAudit === 'function') addAudit('ASSET_LINKED', assetId, null, `Linked under ${parentId}`);
      const el = document.getElementById('relationships-panel-content');
      if (el) renderRelationshipsTab(assetId, el);
    },
    'Link'
  );
  const confirmBtn = document.getElementById('_mini-modal-confirm');
  if (confirmBtn) confirmBtn.disabled = true;
  _linkPickerRender();
}

function openLinkChildModal(parentId) {
  _linkPickerSelectedId = null;
  _miniModal('Link Child Asset',
    _linkPickerBodyHtml(parentId),
    () => {
      if (!_linkPickerSelectedId) return;
      _doLinkChild(parentId, _linkPickerSelectedId);
    },
    'Link'
  );
  const confirmBtn = document.getElementById('_mini-modal-confirm');
  if (confirmBtn) confirmBtn.disabled = true;
  _linkPickerRender();
}

function _doLinkChild(parentId, childId) {
  if (!childId) return;
  linkAssets(parentId, childId);
  if (typeof toast === 'function') toast(`Linked ${childId} as child of ${parentId}`, 'fa-link');
  if (typeof addAudit === 'function') addAudit('ASSET_LINKED', parentId, null, `${childId} linked as child`);
  const el = document.getElementById('relationships-panel-content');
  if (el) renderRelationshipsTab(parentId, el);
}

function _buildRollup(children) {
  if (!children.length) return '';
  const conds = { Good:0, Fair:0, Poor:0, Critical:0, Unassessed:0 };
  children.forEach(a => { conds[a.condition||'Unassessed']++; });
  const totalVal = children.reduce((s,a)=>s+(a.valuation?.amount||0),0);
  const worstCond = ['Critical','Poor','Fair','Good','Unassessed'].find(c=>conds[c]>0);
  return `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;text-align:center">
    ${Object.entries(conds).map(([c,n])=>`
      <div style="font-size:11px">
        <div style="font-weight:700;font-size:16px;color:${c==='Good'?'#2DB87B':c==='Critical'?'#e05555':c==='Poor'?'#f07000':c==='Fair'?'#f0a500':'#5A6A7A'}">${n}</div>
        <div style="color:var(--text3)">${c}</div>
      </div>`).join('')}
  </div>
  ${totalVal ? `<div style="margin-top:8px;font-size:12px;color:var(--text2)">Combined Value: <strong>${totalVal>=1e9?(totalVal/1e9).toFixed(1)+'B':totalVal>=1e6?(totalVal/1e6).toFixed(1)+'M':'₦'+totalVal.toLocaleString()}</strong></div>` : ''}
  <div style="margin-top:6px;font-size:12px;color:var(--text2)">Worst Condition: <strong style="color:${worstCond==='Good'?'#2DB87B':worstCond==='Critical'?'#e05555':'#f0a500'}">${worstCond}</strong></div>`;
}

// ── ENHANCED FULL-TEXT SEARCH ─────────────────────────────────────────────────
// Replaces the basic name/id/state search with a comprehensive multi-field search
// that includes notes, address, MDA, sector, LGA, and assetCode.

let _searchIndex = [];
let _searchIndexBuilt = false;

async function buildSearchIndex() {
  if (_searchIndexBuilt) return;
  try {
    const r = await apiGetAssets({ limit: 5000 });
    _searchIndex = (r.assets || []).map(a => ({
      a,
      text: [
        a.assetId||a.id, a.name, a.type, a.condition, a.status,
        a.mda, a.sector, a.state, a.lga, a.address,
        a.notes, a.agent, a.capturedBy?.name, a.assetCode,
        ...(Object.values(a.typeData||{})),
      ].join(' ').toLowerCase(),
    }));
    _searchIndexBuilt = true;
  } catch {
    _searchIndex = (assets||[]).map(a => ({
      a,
      text: [a.assetId||a.id, a.name, a.type, a.state, a.notes, a.mda].join(' ').toLowerCase(),
    }));
  }
}

function enhancedSearch(query) {
  if (!query || !query.trim()) return _searchIndex.map(x => x.a);
  const terms = query.toLowerCase().trim().split(/\s+/);
  return _searchIndex
    .filter(({ text }) => terms.every(t => text.includes(t)))
    .map(x => x.a);
}

// Invalidate index when assets change
function invalidateSearchIndex() {
  _searchIndexBuilt = false;
  _searchIndex = [];
}

// ── GLOBAL SEARCH BAR ENHANCEMENT ────────────────────────────────────────────
// Hooks into the existing global search or search-input fields.
let _gsDebounce = null;

function initEnhancedSearch() {
  // Build index in background
  buildSearchIndex();

  // Hook into search input if on assets page
  const si = document.getElementById('search-input');
  if (si) {
    si.placeholder = 'Search name, ID, MDA, sector, notes, address…';
    si.addEventListener('input', () => {
      clearTimeout(_gsDebounce);
      _gsDebounce = setTimeout(async () => {
        if (!_searchIndexBuilt) await buildSearchIndex();
        const q = si.value.trim();
        if (!q) { if(typeof renderAssets==='function') renderAssets(); return; }

        // Use enhanced search
        const results = enhancedSearch(q);

        // Also try backend text search
        let backendResults = [];
        try {
          const r = await apiSearchAssets(q);
          backendResults = r.assets || r.results || [];
        } catch {}

        // Merge (deduplicate by assetId)
        const seen = new Set();
        const merged = [...results, ...backendResults].filter(a => {
          const id = a.assetId||a.id;
          if (seen.has(id)) return false;
          seen.add(id); return true;
        });

        if (typeof renderAssetsTable === 'function') {
          filteredAssets = merged;
          renderAssetsTable(merged);
        }
      }, 250);
    });
  }
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEnhancedSearch);
} else {
  setTimeout(initEnhancedSearch, 500);
}

// ── PORTABLE MINI-MODAL ───────────────────────────────────────────────────────
// Works on any page regardless of whether app.js's openModal is present.
function _miniModal(title, bodyHtml, onConfirm, confirmLabel = 'Confirm') {
  document.getElementById('_mini-modal-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = '_mini-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:5000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px)';
  overlay.innerHTML = `
    <div style="background:var(--card,#fff);border-radius:14px;width:480px;max-width:95vw;
      box-shadow:0 24px 80px rgba(0,0,0,.25);border:1px solid var(--border,#E8ECF0);overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border,#E8ECF0);display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:15px;font-weight:700;color:var(--text,#0B1829)">${title}</div>
        <button onclick="document.getElementById('_mini-modal-overlay').remove()"
          style="background:none;border:none;color:var(--text3,#5A6A7A);font-size:18px;cursor:pointer;width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center">✕</button>
      </div>
      <div style="padding:18px 20px" id="_mini-modal-body">${bodyHtml}</div>
      <div style="padding:12px 20px;border-top:1px solid var(--border,#E8ECF0);display:flex;justify-content:flex-end;gap:8px">
        <button onclick="document.getElementById('_mini-modal-overlay').remove()"
          style="background:none;border:1px solid var(--border,#E8ECF0);color:var(--text2,#2C3E50);padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">Cancel</button>
        <button id="_mini-modal-confirm"
          style="background:var(--blue,#4A90D9);color:#fff;border:none;padding:8px 18px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">
          ${confirmLabel}
        </button>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  document.getElementById('_mini-modal-confirm').onclick = () => {
    if (onConfirm) onConfirm();
    overlay.remove();
  };
  // Focus first input
  setTimeout(() => overlay.querySelector('input')?.focus(), 50);
}

// ── BACKEND SYNC FOR RELATIONSHIPS ───────────────────────────────────────────
const _origLink = linkAssets;
window.linkAssets = async function(parentId, childId) {
  try {
    if (typeof apiLinkAssets === 'function' && window.AS_BACKEND?.relationships) {
      await apiLinkAssets(parentId, childId);
    }
  } catch {}
  _origLink(parentId, childId);
};

const _origUnlink = unlinkAssets;
window.unlinkAssets = async function(parentId, childId) {
  try {
    if (typeof apiUnlinkAssets === 'function' && window.AS_BACKEND?.relationships) {
      await apiUnlinkAssets(parentId, childId);
    }
  } catch {}
  _origUnlink(parentId, childId);
};

// Override renderRelationshipsTab to load from backend
const _origRenderRel = renderRelationshipsTab;
window.renderRelationshipsTab = async function(assetId, containerEl) {
  // Only attempt backend if route likely exists (backend returns 404 until registered)
  try {
    if (typeof apiGetRelationships === 'function' && window.AS_BACKEND?.relationships) {
      const r = await apiGetRelationships(assetId).catch(() => null);
      if (r && !r.error) {
        const rels = _getRelationships();
        rels[assetId]              = r.childIds || [];
        rels[`_parent_${assetId}`] = r.parentId || null;
        _saveRelationships(rels);
      }
    }
  } catch { /* backend not yet registered — using localStorage */ }
  _origRenderRel(assetId, containerEl);
};

// Override applyBulkUpdate to use backend endpoint
if (typeof applyBulkUpdate !== 'undefined') {
  const _origBulk = applyBulkUpdate;
  window.applyBulkUpdate = async function() {
    const changes = window._bulkChanges || [];
    if (!changes.length) return;
    const applyBtn = document.getElementById('btn-apply-bulk');
    if (applyBtn) { applyBtn.disabled = true; applyBtn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block"></div> Applying…'; }
    try {
      if (typeof apiBulkUpdateAssets === 'function' && window.AS_BACKEND?.bulkUpdate) {
        const r = await apiBulkUpdateAssets(changes);
        if(typeof toast==='function') toast(`${r.updated} assets updated${r.failed?`, ${r.failed} failed`:''}`, 'fa-bolt');
        if(typeof addAudit==='function') addAudit('BULK_UPDATE','MULTIPLE',null,`${r.updated} assets updated via Excel`);
        if(typeof closeModal==='function') closeModal();
        document.getElementById('_mini-modal-overlay')?.remove();
        if(typeof renderAssets==='function') renderAssets();
        invalidateSearchIndex();
        return;
      }
    } catch {}
    _origBulk();
  };
}