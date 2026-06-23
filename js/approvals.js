// ── ASSET APPROVALS ───────────────────────────────────────────────────────────
// Queue of Field Agent (and Sub-Head) captures awaiting review by a
// Sub-Head, Supervisor, or System Admin before they count as part of the
// verified registry. See services/assetService.js (backend) for the
// approval-status rules this page surfaces.

let _approvalsList = [];

async function loadApprovals() {
  const status = document.getElementById('appr-status-filter')?.value || 'Pending';
  const tbody  = document.getElementById('approvals-tbody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="spinner"></div></div></td></tr>`;

  try {
    const r = await apiGetPendingApprovals({ status, limit: 200 });
    _approvalsList = r.assets || [];
  } catch {
    _approvalsList = [];
    toast('Could not load approvals — check connection', 'fa-triangle-exclamation', true);
  }

  renderApprovalsTable(_approvalsList);
  loadApprovalsSummary();
}

async function loadApprovalsSummary() {
  try {
    const s = await apiApprovalsSummary();
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('appr-stat-pending',  s.pending  ?? 0);
    setEl('appr-stat-approved', s.approved ?? 0);
    setEl('appr-stat-rejected', s.rejected ?? 0);
    const badge = document.getElementById('sb-badge-approvals');
    if (badge) badge.textContent = s.pending > 0 ? s.pending : '';
  } catch {
    // Sidebar badge / stat strip just stay blank if this fails — non-critical.
  }
}

function renderApprovalsTable(list) {
  const tbody = document.getElementById('approvals-tbody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <div class="empty-icon"><i class="fa-solid fa-clipboard-check"></i></div>
      <div class="empty-title">Nothing here</div>
      <div class="empty-sub">No captures currently match this filter</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(a => {
    const id        = a.assetId || a._id;
    const submitter  = a.submittedBy?.name || a.capturedBy?.name || '—';
    const submitterRole = a.submittedBy?.role || a.capturedBy?.role || '';
    const captured   = a.captureDate || a.createdAt;
    const statusTag  = { Pending:'tag-warn', Approved:'tag-green', Rejected:'tag-red' }[a.approvalStatus] || 'tag-gray';
    const isPending   = a.approvalStatus === 'Pending';
    return `<tr>
      <td style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text3)">${escHtml(id)}</td>
      <td><strong>${escHtml(a.name)}</strong></td>
      <td><span class="tag ${typeColor(a.type)}">${escHtml(a.type)}</span></td>
      <td style="font-size:12px;color:var(--text2)">${escHtml(submitter)}${submitterRole ? ` <span style="color:var(--text3)">(${escHtml(submitterRole)})</span>` : ''}</td>
      <td style="font-size:11px;color:var(--text3)">${captured ? timeAgo(new Date(captured).getTime()) : '—'}</td>
      <td><span class="tag ${statusTag}">${escHtml(a.approvalStatus || 'Approved')}</span></td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-xs" onclick="window.location.href='asset-view.html?id='+encodeURIComponent('${id}')" title="View detail">
            <i class="fa-solid fa-eye"></i>
          </button>
          ${isPending ? `
          <button class="btn btn-ghost btn-xs" data-require="canApprove" style="color:var(--accent2);border-color:rgba(0,200,100,.3)" onclick="approveCapture('${id}')" title="Approve">
            <i class="fa-solid fa-check"></i>
          </button>
          <button class="btn btn-danger btn-xs" data-require="canApprove" onclick="openRejectModal('${id}')" title="Reject">
            <i class="fa-solid fa-xmark"></i>
          </button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  setTimeout(applyRoleGates, 30);
}

async function approveCapture(id) {
  if (!confirm(`Approve ${id}? It will be added to the verified asset registry.`)) return;
  try {
    await apiApproveAsset(id);
    toast(`${id} approved`, 'fa-circle-check');
  } catch (e) {
    toast(e.message || 'Approval failed', 'fa-circle-xmark', true);
    return;
  }
  loadApprovals();
}

function openRejectModal(id) {
  openModal(`Reject ${id}`,
    `<div class="form-group full">
      <label class="form-label">Reason (shown to the submitting agent)</label>
      <textarea class="form-control" id="reject-reason" placeholder="e.g. GPS coordinates look incorrect — please recapture on site" rows="3"></textarea>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger" onclick="confirmReject('${id}')"><i class="fa-solid fa-xmark"></i> Reject Capture</button>`
  );
}

async function confirmReject(id) {
  const reason = document.getElementById('reject-reason')?.value.trim() || '';
  try {
    await apiRejectAsset(id, reason);
    toast(`${id} rejected`, 'fa-circle-xmark');
  } catch (e) {
    toast(e.message || 'Rejection failed', 'fa-circle-xmark', true);
  }
  closeModal();
  loadApprovals();
}