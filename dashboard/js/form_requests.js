'use strict';
// ── FPAM FORM REQUESTS LOGIC ──────────────────────────────────────────────────

let _allRequests = [];
let _currentReviewReq = null;
let _pickedFormTypeFpam = null;
let _nrSelectedFilesFpam = [];   // files picked in the FPAM-side New Request modal

document.addEventListener('DOMContentLoaded', async () => {
  buildFormTypeGrid();
  await populateMdaSelect('filter-mda');
  await populateMdaSelect('nr-mda', '');
  await loadRequests();
  populateFormTypeFilter();
});

function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function openModal(id) { document.getElementById(id).classList.add('open'); }

function populateFormTypeFilter() {
  const sel = document.getElementById('filter-form-type');
  sel.innerHTML += Object.keys(FORM_LABELS).map(ft => `<option value="${ft}">${FORM_LABELS[ft]}</option>`).join('');
}

// ── LOAD & RENDER LIST ─────────────────────────────────────────────────────────
async function loadRequests() {
  const el = document.getElementById('requests-list');
  const mda = document.getElementById('filter-mda').value;
  const status = document.getElementById('filter-status').value;
  const formType = document.getElementById('filter-form-type').value;

  const params = {};
  if (mda) params.mda = mda;
  if (status) params.status = status;
  if (formType) params.formType = formType;

  try {
    const r = await apiGetFormRequests(params);
    _allRequests = r.requests || [];
    renderList();
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><div>Could not load requests: ${e.message}</div></div>`;
  }
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
  if (!_allRequests.length) {
    el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-folder-open"></i><div>No requests match these filters</div></div>`;
    return;
  }
  el.innerHTML = _allRequests.map(r => `
    <div class="req-row" onclick="openReview('${r._id}')">
      <div class="req-icon"><i class="fa-solid ${FORM_ICONS[r.formType] || 'fa-file'}"></i></div>
      <div>
        <div class="req-title">${FORM_LABELS[r.formType] || r.formType}</div>
        <div class="req-sub">${r.mda} &middot; ${r.submittedBy?.name || 'Unknown'} &middot; ${new Date(r.submittedAt || r.createdAt).toLocaleDateString()}</div>
      </div>
      <div class="req-meta">
        ${r.certificateIssued ? '<span class="tag tag-green"><i class="fa-solid fa-certificate"></i> Cert Issued</span>' : ''}
        ${STATUS_TAG[r.status] || ''}
        <i class="fa-solid fa-chevron-right" style="color:var(--text3);font-size:12px"></i>
      </div>
    </div>
  `).join('');
}

// ── NEW REQUEST (on behalf of any MDA) ─────────────────────────────────────────
function openNewRequestPicker() { openModal('picker-modal'); }

function buildFormTypeGrid() {
  document.getElementById('form-type-grid').innerHTML = Object.keys(FORM_LABELS).map(ft => `
    <div class="form-type-card" onclick="pickFormTypeFpam('${ft}')">
      <i class="fa-solid ${FORM_ICONS[ft]}"></i>
      <div>${FORM_LABELS[ft]}</div>
    </div>
  `).join('');
}

function pickFormTypeFpam(formType) {
  _pickedFormTypeFpam = formType;
  _nrSelectedFilesFpam = [];
  closeModal('picker-modal');
  document.getElementById('nr-title').textContent = FORM_LABELS[formType];
  document.getElementById('nr-fields').innerHTML =
    renderTemplateDownloadLink(formType) + renderFormFields(formType, {}, false) + renderAttachmentPickerFpam(formType);
  openModal('new-request-modal');
}

// Same shape as mda_portal.js's renderAttachmentPicker/onNrFilesPicked —
// duplicated rather than shared since these are two independent pages.
function renderAttachmentPickerFpam(formType) {
  const required = typeof FORM_REQUIRES_ATTACHMENT !== 'undefined' && FORM_REQUIRES_ATTACHMENT[formType];
  return `
    <div style="grid-column:1/-1;margin-top:10px;padding-top:14px;border-top:1px solid var(--border)">
      <label style="font-size:12px;font-weight:600;color:var(--navy);display:block;margin-bottom:6px">
        Supporting Documents ${required ? '<span style="color:var(--danger)">* required</span>' : '<span style="color:var(--text3);font-weight:400">(optional)</span>'}
      </label>
      <input type="file" id="nr-file-input-fpam" multiple onchange="onNrFilesPickedFpam(this.files)"
        style="font-size:12.5px;border:1px solid var(--border);border-radius:6px;padding:6px;width:100%">
      <div id="nr-file-list-fpam" style="margin-top:8px;font-size:12px;color:var(--text2)"></div>
    </div>
  `;
}

function onNrFilesPickedFpam(fileList) {
  _nrSelectedFilesFpam = Array.from(fileList);
  const listEl = document.getElementById('nr-file-list-fpam');
  if (!listEl) return;
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  listEl.innerHTML = _nrSelectedFilesFpam.length
    ? _nrSelectedFilesFpam.map(f => `<div><i class="fa-solid fa-paperclip"></i> ${esc(f.name)} (${(f.size/1024).toFixed(0)} KB)</div>`).join('')
    : '';
}

async function submitNewRequest() {
  if (!_pickedFormTypeFpam) return;
  const mda = document.getElementById('nr-mda').value;
  if (!mda) { toast('Select an MDA', 'fa-triangle-exclamation', true); return; }

  const required = typeof FORM_REQUIRES_ATTACHMENT !== 'undefined' && FORM_REQUIRES_ATTACHMENT[_pickedFormTypeFpam];
  if (required && !_nrSelectedFilesFpam.length) {
    toast('Please attach the completed PDF/document before submitting', 'fa-triangle-exclamation', true);
    return;
  }

  const data = collectFormData(_pickedFormTypeFpam, document.getElementById('nr-fields'));
  const field = FORM_DATA_FIELD[_pickedFormTypeFpam];

  try {
    const created = await apiCreateFormRequest({ formType: _pickedFormTypeFpam, mda, status: 'Submitted', [field]: data });
    const requestId = created.request?._id;

    if (requestId && _nrSelectedFilesFpam.length) {
      const results = await Promise.allSettled(
        _nrSelectedFilesFpam.map(f => apiUploadFormAttachment(requestId, f))
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed) {
        toast(`Request created, but ${failed} attachment(s) failed to upload`, 'fa-triangle-exclamation', true);
      }
    }

    toast('Request created', 'fa-circle-check');
    closeModal('new-request-modal');
    _nrSelectedFilesFpam = [];
    await loadRequests();
  } catch (e) {
    toast('Could not create request: ' + e.message, 'fa-triangle-exclamation', true);
  }
}

// ── REVIEW ────────────────────────────────────────────────────────────────────
// "Download Reference Template" — same static-link approach as
// mda_portal.js's copy of this function (kept separate since these are two
// independent pages with no shared JS file between them). See the comment
// on FORM_TEMPLATE_FILE in form_field_defs.js for why this is a plain
// relative link rather than a backend route.
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

// Read-only viewer for whatever the MDA attached — the reviewer's job here
// is downloading and checking the document, not uploading. Same underlying
// GET /:id/attachments/:attachmentId route mda_portal.js uses to download.
function renderReviewAttachments(req) {
  const attachments = req.attachments || [];
  if (!attachments.length) {
    return `<div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);font-size:12px;color:var(--text3)">No supporting documents attached.</div>`;
  }
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return `
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
      <label style="font-size:12px;font-weight:600;color:var(--navy);display:block;margin-bottom:8px">Supporting Documents</label>
      ${attachments.map(a => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg);border-radius:8px;margin-bottom:6px">
          <i class="fa-solid fa-paperclip" style="color:var(--text3)"></i>
          <div style="flex:1;min-width:0;font-size:12.5px">
            ${esc(a.originalname || a.filename)}${a.label ? ` <span style="color:var(--text3)">— ${esc(a.label)}</span>` : ''}
          </div>
          <div style="font-size:10.5px;color:var(--text3)">${a.sizeBytes ? (a.sizeBytes/1024).toFixed(0) + ' KB' : ''}</div>
          <button class="btn btn-ghost btn-xs" title="View in browser" onclick="viewReviewAttachment('${req._id}','${a._id}')">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="btn btn-ghost btn-xs" title="Download" onclick="downloadReviewAttachment('${req._id}','${a._id}','${esc(a.originalname || a.filename)}')">
            <i class="fa-solid fa-download"></i>
          </button>
        </div>`).join('')}
    </div>
  `;
}

async function viewReviewAttachment(requestId, attachmentId) {
  try {
    const blob = await apiFetchFormAttachmentBlob(requestId, attachmentId);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    toast('Could not open file: ' + e.message, 'fa-triangle-exclamation', true);
  }
}

async function downloadReviewAttachment(requestId, attachmentId, filename) {
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

async function openReview(id) {
  try {
    const r = await apiGetFormRequest(id);
    _currentReviewReq = r.request;
    const field = FORM_DATA_FIELD[_currentReviewReq.formType];

    document.getElementById('rv-title').textContent = `${FORM_LABELS[_currentReviewReq.formType]} — ${_currentReviewReq.mda}`;
    document.getElementById('rv-form-fields').innerHTML =
      renderTemplateDownloadLink(_currentReviewReq.formType)
      + renderFormFields(_currentReviewReq.formType, _currentReviewReq[field] || {}, true)
      + renderReviewAttachments(_currentReviewReq);
    document.getElementById('rv-remarks').value = _currentReviewReq.reviewRemarks || '';

    const footer = document.getElementById('rv-footer');
    footer.innerHTML = `
      <button class="btn btn-ghost" onclick="closeModal('review-modal')">Close</button>
      <button class="btn btn-secondary" onclick="reviewAction('UnderReview')">Mark Under Review</button>
      <button class="btn btn-danger" onclick="reviewAction('Rejected')"><i class="fa-solid fa-xmark"></i> Reject</button>
      <button class="btn btn-secondary" onclick="reviewAction('Deferred')"><i class="fa-solid fa-clock"></i> Defer</button>
      <button class="btn btn-success" onclick="reviewAction('Approved')"><i class="fa-solid fa-check"></i> Approve</button>
      ${_currentReviewReq.status === 'Approved' && !_currentReviewReq.certificateIssued
        ? `<button class="btn btn-primary" onclick="issueCertificate()"><i class="fa-solid fa-certificate"></i> Issue Certificate</button>`
        : ''}
      ${_currentReviewReq.certificateIssued
        ? `<button class="btn btn-primary" onclick="regenerateCertificatePdf()"><i class="fa-solid fa-file-pdf"></i> View/Reprint Certificate</button>`
        : ''}
    `;

    openModal('review-modal');
  } catch (e) {
    toast('Could not load request: ' + e.message, 'fa-triangle-exclamation', true);
  }
}

async function reviewAction(status) {
  if (!_currentReviewReq) return;
  const remarks = document.getElementById('rv-remarks').value;
  try {
    await apiUpdateFormRequest(_currentReviewReq._id, { status, reviewRemarks: remarks });
    toast(`Marked ${status}`, 'fa-circle-check');
    closeModal('review-modal');
    await loadRequests();
  } catch (e) {
    toast('Could not update: ' + e.message, 'fa-triangle-exclamation', true);
  }
}

// ── CERTIFICATE PDF (jsPDF) — matches your M&E clearance certificate style:
// navy federal letterhead treatment, formal wording, signature line. ────────
function buildCertificatePdf(req) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const navy = [11, 37, 69];
  const blue = [74, 144, 217];

  // Header band
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageW, 38, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('FEDERAL MINISTRY OF HOUSING AND URBAN DEVELOPMENT', pageW / 2, 16, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Federal Public Assets Maintenance Department (FPAM)', pageW / 2, 24, { align: 'center' });
  doc.setDrawColor(...blue);
  doc.setLineWidth(0.8);
  doc.line(pageW/2 - 35, 29, pageW/2 + 35, 29);
  doc.setFontSize(9);
  doc.text('CERTIFICATE OF COMPLIANCE', pageW / 2, 34, { align: 'center' });

  doc.setTextColor(11, 24, 41);
  let y = 55;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Certificate of Certification', pageW / 2, y, { align: 'center' });

  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11.5);
  const body = [
    'This is to certify that',
    '',
    req.mda,
    '',
    `has been reviewed by the Federal Public Assets Maintenance Department (FPAM) in respect of`,
    `${FORM_LABELS[req.formType]}`,
    '',
    'and has been found to be in compliance with the National Public Buildings Maintenance Policy',
    '(NPBMP) and the provisions of Executive Order No. 11.',
  ];
  body.forEach(line => {
    if (line === req.mda) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text(line, pageW / 2, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11.5);
    } else {
      doc.text(line, pageW / 2, y, { align: 'center', maxWidth: 160 });
    }
    y += line ? 8 : 4;
  });

  y += 14;
  doc.setFontSize(10);
  doc.text(`Certificate No: ${req.certificateNumber || ''}`, 30, y);
  doc.text(`Date Issued: ${new Date().toLocaleDateString('en-NG')}`, pageW - 30, y, { align: 'right' });

  y += 30;
  doc.line(30, y, 90, y);
  doc.line(pageW - 90, y, pageW - 30, y);
  y += 5;
  doc.setFontSize(9);
  doc.text('FPAM Director / Head of Certification', 60, y, { align: 'center' });
  doc.text('Official Stamp / Seal', pageW - 60, y, { align: 'center' });

  return doc;
}

async function issueCertificate() {
  if (!_currentReviewReq) return;
  try {
    const doc = buildCertificatePdf(_currentReviewReq);
    const blob = doc.output('blob');

    await apiIssueCertificate(_currentReviewReq._id, blob, _currentReviewReq.certificateNumber);

    toast('Certificate issued', 'fa-certificate');
    doc.save(`FPAM-Certificate-${_currentReviewReq.mda}.pdf`);   // also gives the officer a local copy to print
    closeModal('review-modal');
    await loadRequests();
  } catch (e) {
    toast('Could not issue certificate: ' + e.message, 'fa-triangle-exclamation', true);
  }
}

function regenerateCertificatePdf() {
  if (!_currentReviewReq) return;
  const doc = buildCertificatePdf(_currentReviewReq);
  doc.save(`FPAM-Certificate-${_currentReviewReq.mda}.pdf`);
}

// ── TOAST fallback ────────────────────────────────────────────────────────────
function toast(msg, icon, isError) {
  if (typeof window._appToast === 'function') return window._appToast(msg, icon, isError);
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${isError?'#e05555':'#0B2545'};color:#fff;padding:12px 20px;border-radius:8px;font-size:13px;z-index:999;display:flex;align-items:center;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,.2)`;
  el.innerHTML = `<i class="fa-solid ${icon||'fa-circle-info'}"></i> ${msg}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}