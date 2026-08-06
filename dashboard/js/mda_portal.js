'use strict';
// ── MDA PORTAL LOGIC ──────────────────────────────────────────────────────────

let _mdaRequests = [];
let _pickedFormType = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = getCurrentUser ? getCurrentUser() : JSON.parse(localStorage.getItem('as_user') || 'null');
  if (!user || user.role !== 'MDA Agent') {
    // Wrong role landed here, or not logged in at all — send to login.
    window.location.href = 'login.html';
    return;
  }
  document.getElementById('hdr-mda-name').textContent = user.mda || 'No MDA Assigned';
  await loadRequests();
  buildFormTypeGrid();
});

function doLogout() {
  (typeof apiLogout === 'function' ? apiLogout() : Promise.resolve())
    .finally(() => { localStorage.removeItem('as_token'); window.location.href = 'login.html'; });
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function openModal(id) { document.getElementById(id).classList.add('open'); }

// ── LOAD & RENDER LIST ─────────────────────────────────────────────────────────
async function loadRequests() {
  const el = document.getElementById('requests-list');
  try {
    const r = await apiGetFormRequests();
    _mdaRequests = r.requests || [];
    renderStats();
    renderList();
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><div>Could not load requests: ${e.message}</div></div>`;
  }
}

function renderStats() {
  const total = _mdaRequests.length;
  const pending = _mdaRequests.filter(r => ['Submitted','UnderReview'].includes(r.status)).length;
  const approved = _mdaRequests.filter(r => r.status === 'Approved').length;
  const certs = _mdaRequests.filter(r => r.certificateIssued).length;

  document.getElementById('stat-row').innerHTML = `
    <div class="stat-card"><div class="stat-n">${total}</div><div class="stat-l">Total Requests</div></div>
    <div class="stat-card"><div class="stat-n">${pending}</div><div class="stat-l">Pending Review</div></div>
    <div class="stat-card"><div class="stat-n" style="color:var(--success)">${approved}</div><div class="stat-l">Approved</div></div>
    <div class="stat-card"><div class="stat-n" style="color:var(--blue)">${certs}</div><div class="stat-l">Certificates Issued</div></div>
  `;
}

const STATUS_TAG = {
  Draft:       '<span class="tag tag-gray">Draft</span>',
  Submitted:   '<span class="tag tag-blue">Submitted</span>',
  UnderReview: '<span class="tag tag-warn">Under Review</span>',
  Approved:    '<span class="tag tag-green">Approved</span>',
  Deferred:    '<span class="tag tag-warn">Deferred</span>',
  Rejected:    '<span class="tag tag-red">Rejected</span>',
};

function renderList() {
  const el = document.getElementById('requests-list');
  if (!_mdaRequests.length) {
    el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-folder-open"></i><div>No requests yet</div><div style="font-size:12px;margin-top:6px">Click "New Request" to submit your first form</div></div>`;
    return;
  }
  el.innerHTML = _mdaRequests.map(r => `
    <div class="req-row" onclick="viewRequest('${r._id}')">
      <div class="req-icon"><i class="fa-solid ${FORM_ICONS[r.formType] || 'fa-file'}"></i></div>
      <div>
        <div class="req-title">${FORM_LABELS[r.formType] || r.formType}</div>
        <div class="req-sub">Submitted ${new Date(r.submittedAt || r.createdAt).toLocaleDateString()}</div>
      </div>
      <div class="req-meta">
        ${r.certificateIssued ? '<span class="tag tag-green"><i class="fa-solid fa-certificate"></i> Cert Issued</span>' : ''}
        ${STATUS_TAG[r.status] || ''}
        <i class="fa-solid fa-chevron-right" style="color:var(--text3);font-size:12px"></i>
      </div>
    </div>
  `).join('');
}

// ── NEW REQUEST FLOW ─────────────────────────────────────────────────────────
function openNewRequestPicker() { openModal('picker-modal'); }

function buildFormTypeGrid() {
  const grid = document.getElementById('form-type-grid');
  grid.innerHTML = Object.keys(FORM_LABELS).map(ft => `
    <div class="form-type-card" onclick="pickFormType('${ft}')">
      <i class="fa-solid ${FORM_ICONS[ft]}"></i>
      <div>${FORM_LABELS[ft]}</div>
    </div>
  `).join('');
}

function pickFormType(formType) {
  _pickedFormType = formType;
  closeModal('picker-modal');
  document.getElementById('nr-title').textContent = FORM_LABELS[formType];
  document.getElementById('nr-fields').innerHTML = renderFormFields(formType, {}, false);
  openModal('new-request-modal');
}

async function submitNewRequest(status) {
  if (!_pickedFormType) return;
  const container = document.getElementById('nr-fields');
  const data = collectFormData(_pickedFormType, container);
  const field = FORM_DATA_FIELD[_pickedFormType];

  try {
    await apiCreateFormRequest({ formType: _pickedFormType, status, [field]: data });
    toast(status === 'Draft' ? 'Saved as draft' : 'Request submitted to FPAM', 'fa-circle-check');
    closeModal('new-request-modal');
    await loadRequests();
  } catch (e) {
    toast('Could not submit: ' + e.message, 'fa-triangle-exclamation', true);
  }
}

// ── VIEW REQUEST ──────────────────────────────────────────────────────────────
async function viewRequest(id) {
  try {
    const r = await apiGetFormRequest(id);
    const req = r.request;
    const field = FORM_DATA_FIELD[req.formType];

    document.getElementById('vr-title').textContent = FORM_LABELS[req.formType];
    document.getElementById('vr-body').innerHTML = `
      <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap">
        ${STATUS_TAG[req.status] || ''}
        ${req.certificateIssued ? `<span class="tag tag-green"><i class="fa-solid fa-certificate"></i> Certificate ${req.certificateNumber || ''}</span>` : ''}
      </div>
      ${req.reviewRemarks ? `<div style="background:var(--bg);border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:12.5px"><strong>FPAM Remarks:</strong> ${req.reviewRemarks}</div>` : ''}
      <div class="ff-form-grid">${renderFormFields(req.formType, req[field] || {}, true)}</div>
    `;

    const footer = document.getElementById('vr-footer');
    footer.innerHTML = `<button class="btn btn-ghost" onclick="closeModal('view-request-modal')">Close</button>`
      + (req.certificateIssued
        ? `<button class="btn btn-primary" onclick="downloadCertificate('${req._id}')"><i class="fa-solid fa-download"></i> Download Certificate</button>`
        : '');

    openModal('view-request-modal');
  } catch (e) {
    toast('Could not load request: ' + e.message, 'fa-triangle-exclamation', true);
  }
}

async function downloadCertificate(requestId) {
  try {
    const req = _mdaRequests.find(r => r._id === requestId) || (await apiGetFormRequest(requestId)).request;
    const blob = await apiFetchCertificateBlob(requestId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${req.certificateNumber || 'certificate'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast('Download failed: ' + e.message, 'fa-triangle-exclamation', true);
  }
}

// ── TOAST (self-contained, in case app.js's isn't loaded on this page) ────────
function toast(msg, icon, isError) {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${isError?'#e05555':'#0B2545'};color:#fff;padding:12px 20px;border-radius:8px;font-size:13px;z-index:999;display:flex;align-items:center;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,.2)`;
  el.innerHTML = `<i class="fa-solid ${icon||'fa-circle-info'}"></i> ${msg}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}