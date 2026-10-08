'use strict';
// ── MDA PORTAL LOGIC ──────────────────────────────────────────────────────────

let _mdaRequests = [];
let _pickedFormType = null;
let _nrSelectedFiles = [];   // files picked in the New Request modal, uploaded after the request is created

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
  _nrSelectedFiles = [];
  closeModal('picker-modal');
  document.getElementById('nr-title').textContent = FORM_LABELS[formType];
  document.getElementById('nr-fields').innerHTML =
    renderTemplateDownloadLink(formType) + renderFormFields(formType, {}, false) + renderAttachmentPicker(formType);
  openModal('new-request-modal');
}

// "Download Reference Template" — the blank PDF/Word version of this exact
// form, so a filer can check the original layout or fill it out on paper
// first. Plain static link, not a JS-fetched blob like attachments/
// certificates: this file isn't user data and needs no auth, it's a
// reference document served the same way as any other static frontend
// asset (see the comment on FORM_TEMPLATE_FILE in form_field_defs.js for
// why this is a relative link and not a backend route). Hidden entirely
// for any form type that doesn't have a template file configured yet.
function renderTemplateDownloadLink(formType) {
  const path = typeof FORM_TEMPLATE_FILE !== 'undefined' ? FORM_TEMPLATE_FILE[formType] : null;
  if (!path) return '';
  return `
    <div style="grid-column:1/-1;margin-bottom:14px">
      <a href="${path}" target="_blank" rel="noopener" download
        style="display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:var(--blue);text-decoration:none;padding:8px 14px;border:1px solid var(--blue);border-radius:8px">
        <i class="fa-solid fa-file-arrow-down"></i> Download Reference Template (blank PDF)
      </a>
    </div>
  `;
}

// Attachment picker HTML for the New Request modal. Previously there was no
// upload UI anywhere in the MDA submission flow at all — the backend's
// POST /:id/attachments has existed since the beginning, but nothing on
// this page (or the FPAM review page) ever called it. This is the "in"
// half; downloadFormAttachment() further down is the "out" half.
function renderAttachmentPicker(formType) {
  const required = typeof FORM_REQUIRES_ATTACHMENT !== 'undefined' && FORM_REQUIRES_ATTACHMENT[formType];
  return `
    <div style="grid-column:1/-1;margin-top:10px;padding-top:14px;border-top:1px solid var(--border)">
      <label style="font-size:12px;font-weight:600;color:var(--navy);display:block;margin-bottom:6px">
        Supporting Documents ${required ? '<span style="color:var(--danger)">* required</span>' : '<span style="color:var(--text3);font-weight:400">(optional)</span>'}
      </label>
      <input type="file" id="nr-file-input" multiple onchange="onNrFilesPicked(this.files)"
        style="font-size:12.5px;border:1px solid var(--border);border-radius:6px;padding:6px;width:100%">
      <div id="nr-file-list" style="margin-top:8px;font-size:12px;color:var(--text2)"></div>
    </div>
  `;
}

function onNrFilesPicked(fileList) {
  _nrSelectedFiles = Array.from(fileList);
  const listEl = document.getElementById('nr-file-list');
  if (!listEl) return;
  listEl.innerHTML = _nrSelectedFiles.length
    ? _nrSelectedFiles.map(f => `<div><i class="fa-solid fa-paperclip"></i> ${escFileName(f.name)} (${(f.size/1024).toFixed(0)} KB)</div>`).join('')
    : '';
}

function escFileName(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function submitNewRequest(status) {
  if (!_pickedFormType) return;
  const container = document.getElementById('nr-fields');
  const data = collectFormData(_pickedFormType, container);
  const field = FORM_DATA_FIELD[_pickedFormType];

  const required = typeof FORM_REQUIRES_ATTACHMENT !== 'undefined' && FORM_REQUIRES_ATTACHMENT[_pickedFormType];
  if (status !== 'Draft' && required && !_nrSelectedFiles.length) {
    toast('Please attach the completed worksheet before submitting', 'fa-triangle-exclamation', true);
    return;
  }

  try {
    const created = await apiCreateFormRequest({ formType: _pickedFormType, status, [field]: data });
    const requestId = created.request?._id;

    // Upload any picked files now that the request has a real _id. Files
    // are collected first, then uploaded in a batch here rather than
    // one-at-a-time as they're picked, since the request doesn't exist yet
    // at picking time.
    if (requestId && _nrSelectedFiles.length) {
      const results = await Promise.allSettled(
        _nrSelectedFiles.map(f => apiUploadFormAttachment(requestId, f))
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed) {
        toast(`Request submitted, but ${failed} attachment(s) failed to upload — add them from the request detail view`, 'fa-triangle-exclamation', true);
      }
    }

    toast(status === 'Draft' ? 'Saved as draft' : 'Request submitted to FPAM', 'fa-circle-check');
    closeModal('new-request-modal');
    _nrSelectedFiles = [];
    await loadRequests();
  } catch (e) {
    toast('Could not submit: ' + e.message, 'fa-triangle-exclamation', true);
  }
}

// ── VIEW REQUEST ──────────────────────────────────────────────────────────────
let _vrCurrentRequest = null;

async function viewRequest(id) {
  try {
    const r = await apiGetFormRequest(id);
    const req = r.request;
    _vrCurrentRequest = req;
    const field = FORM_DATA_FIELD[req.formType];

    document.getElementById('vr-title').textContent = FORM_LABELS[req.formType];
    document.getElementById('vr-body').innerHTML = `
      ${renderTemplateDownloadLink(req.formType)}
      <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap">
        ${STATUS_TAG[req.status] || ''}
        ${req.certificateIssued ? `<span class="tag tag-green"><i class="fa-solid fa-certificate"></i> Certificate ${req.certificateNumber || ''}</span>` : ''}
      </div>
      ${req.reviewRemarks ? `<div style="background:var(--bg);border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:12.5px"><strong>FPAM Remarks:</strong> ${req.reviewRemarks}</div>` : ''}
      <div class="ff-form-grid">${renderFormFields(req.formType, req[field] || {}, true)}</div>
      ${renderAttachmentSection(req)}
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

// Attachments list + an "add more" upload control, shown on the request
// detail view. Uploading more is allowed any time the request isn't yet in
// a final state (Approved/Rejected) — once FPAM has acted on it, treat the
// submission as closed.
function renderAttachmentSection(req) {
  const attachments = req.attachments || [];
  const canAddMore = !['Approved', 'Rejected'].includes(req.status);

  const list = attachments.length
    ? attachments.map(a => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg);border-radius:8px;margin-bottom:6px">
          <i class="fa-solid fa-paperclip" style="color:var(--text3)"></i>
          <div style="flex:1;min-width:0;font-size:12.5px">
            ${escFileName(a.originalname || a.filename)}${a.label ? ` <span style="color:var(--text3)">— ${escFileName(a.label)}</span>` : ''}
          </div>
          <div style="font-size:10.5px;color:var(--text3)">${a.sizeBytes ? (a.sizeBytes/1024).toFixed(0) + ' KB' : ''}</div>
          <button class="btn btn-ghost btn-xs" title="View in browser" onclick="viewFormAttachment('${req._id}','${a._id}')">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="btn btn-ghost btn-xs" title="Download" onclick="downloadFormAttachment('${req._id}','${a._id}','${escFileName(a.originalname || a.filename)}')">
            <i class="fa-solid fa-download"></i>
          </button>
        </div>`).join('')
    : `<div style="font-size:12px;color:var(--text3)">No supporting documents attached.</div>`;

  return `
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
      <label style="font-size:12px;font-weight:600;color:var(--navy);display:block;margin-bottom:8px">Supporting Documents</label>
      ${list}
      ${canAddMore ? `
        <div style="margin-top:10px">
          <input type="file" id="vr-file-input" multiple onchange="uploadMoreAttachments('${req._id}', this.files)"
            style="font-size:12.5px;border:1px solid var(--border);border-radius:6px;padding:6px;width:100%">
        </div>` : ''}
    </div>
  `;
}

async function uploadMoreAttachments(requestId, fileList) {
  const files = Array.from(fileList);
  if (!files.length) return;
  try {
    await Promise.all(files.map(f => apiUploadFormAttachment(requestId, f)));
    toast('Attachment(s) uploaded', 'fa-circle-check');
    await viewRequest(requestId);   // re-render with the new list
    await loadRequests();           // refresh the background list too
  } catch (e) {
    toast('Upload failed: ' + e.message, 'fa-triangle-exclamation', true);
  }
}

async function viewFormAttachment(requestId, attachmentId) {
  try {
    const blob = await apiFetchFormAttachmentBlob(requestId, attachmentId);
    const url = URL.createObjectURL(blob);
    // Opens inline in a new tab for anything the browser can render natively
    // (PDF, images) — for types it can't (Word, Excel), the browser falls
    // back to its own download prompt on its own; nothing more to do about
    // that client-side, no browser has a built-in Office viewer.
    window.open(url, '_blank');
    // Don't revoke immediately like downloadFormAttachment does — the new
    // tab needs this blob URL to stay valid while it's open. Clean it up
    // after a generous delay instead of leaking it forever.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    toast('Could not open file: ' + e.message, 'fa-triangle-exclamation', true);
  }
}

async function downloadFormAttachment(requestId, attachmentId, filename) {
  try {
    const blob = await apiFetchFormAttachmentBlob(requestId, attachmentId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename || 'attachment';
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast('Download failed: ' + e.message, 'fa-triangle-exclamation', true);
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