// ── NOTIFICATIONS & ALERTS SYSTEM ────────────────────────────────────────────
// Guard against double-loading (script included on multiple pages)
if (typeof window._AS_NOTIF_LOADED !== 'undefined') {
  // Already loaded — skip re-declaration
} else {
window._AS_NOTIF_LOADED = true;


// Per-user storage keys
function _userId() {
  try { const u = JSON.parse(localStorage.getItem('as_user') || '{}'); return u._id || u.id || 'guest'; } catch { return 'guest'; }
}
function _userRole() {
  try { const u = JSON.parse(localStorage.getItem('as_user') || '{}'); return u.role || ''; } catch { return ''; }
}
function _notifKey()        { return 'as_notifications_'  + _userId(); }
function _notifReadKey()    { return 'as_notif_read_'     + _userId(); }
function _notifClearedKey() { return 'as_notif_cleared_'  + _userId(); }

function _getClearedKeys() {
  try { return new Set(JSON.parse(localStorage.getItem(_notifClearedKey())) || []); } catch { return new Set(); }
}
function _addClearedKeys(notifs) {
  const cleared = _getClearedKeys();
  notifs.forEach(n => cleared.add((n.type||'') + '|' + (n.assetId||'')));
  localStorage.setItem(_notifClearedKey(), JSON.stringify([...cleared]));
}
function _wasManuallyClearedKey(type, assetId) {
  return _getClearedKeys().has((type||'') + '|' + (assetId||''));
}

function _getNotifications() {
  try { return JSON.parse(localStorage.getItem(_notifKey())) || []; } catch { return []; }
}
function _saveNotifications(list) {
  localStorage.setItem(_notifKey(), JSON.stringify(list.slice(0, 200)));
}
function _getReadIds() {
  try { return new Set(JSON.parse(localStorage.getItem(_notifReadKey())) || []); } catch { return new Set(); }
}
function _markRead(id) {
  const ids = _getReadIds();
  ids.add(id);
  localStorage.setItem(_notifReadKey(), JSON.stringify([...ids]));
}
function _markAllRead() {
  const notifs = _getNotifications();
  localStorage.setItem(_notifReadKey(), JSON.stringify(notifs.map(n => n.id)));
  updateNotifBadge();
}

function _newNotifId() { return 'N-' + Date.now() + '-' + Math.random().toString(36).slice(2,6); }

// Pushes a notification, or — if a notification of the same type (+assetId,
// for single-asset alerts) was already pushed within the dedup window —
// updates that existing one in place instead of adding a duplicate. This is
// what makes grouped alerts (see runAlertScan below) work correctly: a
// re-scan that finds the underlying count changed (e.g. 14 assets missing
// coordinates → 12) updates the same notification's text and nudges it back
// to unread, rather than either spamming a new one per asset or going stale
// for a full 24h.
function pushNotification({ type, title, body, assetId, icon, color }) {
  // Never re-push something the user explicitly cleared
  if (_wasManuallyClearedKey(type, assetId || '')) return;
  const notifs = _getNotifications();
  const recent = Date.now() - 86400000;
  const idx = notifs.findIndex(n => n.type === type && n.assetId === (assetId||null) && n.ts > recent);

  if (idx !== -1) {
    if (notifs[idx].body !== body) {
      notifs[idx].body  = body;
      notifs[idx].title = title;
      notifs[idx].ts    = Date.now();
      const readIds = _getReadIds();
      if (readIds.has(notifs[idx].id)) {
        readIds.delete(notifs[idx].id);
        localStorage.setItem(_notifReadKey(), JSON.stringify([...readIds]));
      }
      _saveNotifications(notifs);
      updateNotifBadge();
    }
    return;
  }

  notifs.unshift({
    id:      _newNotifId(),
    type,
    title,
    body,
    assetId: assetId || null,
    icon:    icon || 'fa-bell',
    color:   color || 'var(--accent)',
    ts:      Date.now(),
  });
  _saveNotifications(notifs);
  updateNotifBadge();
}

// ── BADGE ─────────────────────────────────────────────────────────────────────
function updateNotifBadge() {
  const notifs = _getNotifications();
  const readIds = _getReadIds();
  const unread = notifs.filter(n => !readIds.has(n.id)).length;

  document.querySelectorAll('.notif-badge').forEach(el => {
    el.textContent = unread > 99 ? '99+' : unread;
    el.style.display = unread > 0 ? '' : 'none';
  });
  document.querySelectorAll('.notif-badge-count').forEach(el => { el.textContent = unread; });
}

// ── NOTIFICATION CENTRE PANEL ─────────────────────────────────────────────────
// Store navigate-after-read target separately to avoid inline JS timing issues
window._notifNavigateTo = null;

function _notifItemClick(notifId, assetId) {
  _markRead(notifId);
  const panel = document.getElementById('notif-panel');
  if (assetId) {
    // Navigate immediately — don't re-render first
    if (panel) panel.remove();
    window.location.href = 'asset-view.html?id=' + encodeURIComponent(assetId);
  } else {
    if (panel) renderNotifPanel(panel);
  }
}

function toggleNotifPanel() {
  const existing = document.getElementById('notif-panel');
  if (existing) { existing.remove(); return; }

  const panel = document.createElement('div');
  panel.id = 'notif-panel';
  panel.style.cssText = [
    'position:fixed', 'top:68px', 'right:20px', 'width:360px', 'max-height:520px',
    'background:#fff', 'border:1px solid var(--border,#E8ECF0)',
    'border-radius:14px', 'box-shadow:0 8px 40px rgba(0,0,0,.15)',
    'z-index:9000', 'display:flex', 'flex-direction:column', 'overflow:hidden',
    "font-family:'Plus Jakarta Sans',sans-serif",
  ].join(';');
  document.body.appendChild(panel);
  renderNotifPanel(panel);

  // Outside-click to close — use capture so it fires before other handlers
  const outsideClose = (e) => {
    const bell = document.getElementById('notif-bell');
    if (!panel.contains(e.target) && (!bell || !bell.contains(e.target))) {
      panel.remove();
      document.removeEventListener('click', outsideClose, true);
    }
  };
  // Delay by one frame so the click that opened it doesn't immediately close it
  setTimeout(() => document.addEventListener('click', outsideClose, true), 0);
}

function renderNotifPanel(panel) {
  if (!panel) return;
  const notifs  = _getNotifications();
  const readIds = _getReadIds();
  const unread  = notifs.filter(n => !readIds.has(n.id)).length;

  panel.innerHTML = `
    <div style="padding:14px 16px;border-bottom:1px solid var(--border,#E8ECF0);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
      <div style="font-size:14px;font-weight:700;color:var(--text,#0B1829)">
        Notifications
        ${unread > 0 ? `<span style="background:#e05555;color:#fff;font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;margin-left:6px">${unread}</span>` : ''}
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${unread > 0 ? `<button onclick="_markAllRead();renderNotifPanel(document.getElementById('notif-panel'))"
          style="background:none;border:none;color:var(--accent,#4A90D9);font-size:11px;cursor:pointer;font-weight:600;font-family:inherit">
          Mark all read</button>` : ''}
        <button onclick="clearAllNotifications()"
          style="background:none;border:none;color:var(--text3,#5A6A7A);font-size:11px;cursor:pointer;font-family:inherit">
          Clear all</button>
      </div>
    </div>
    <div style="overflow-y:auto;flex:1">
      ${!notifs.length
        ? `<div style="text-align:center;padding:40px 20px;color:var(--text3,#5A6A7A);font-size:13px">
            <i class="fa-solid fa-bell-slash" style="font-size:28px;display:block;margin-bottom:10px;opacity:.4"></i>
            No notifications yet
           </div>`
        : notifs.slice(0, 50).map(n => {
            const isRead  = readIds.has(n.id);
            const ago     = _timeAgo(n.ts);
            const color   = n.color || '#4A90D9';
            const hoverBg = 'rgba(74,144,217,.06)';
            const baseBg  = isRead ? 'transparent' : 'rgba(74,144,217,.03)';
            const hasLink = !!n.assetId;
            return `
              <div onclick="_notifItemClick('${n.id}',${n.assetId ? `'${n.assetId}'` : 'null'})"
                style="padding:12px 16px;border-bottom:1px solid var(--border,#E8ECF0);
                  cursor:${hasLink ? 'pointer' : 'default'};display:flex;gap:10px;align-items:flex-start;
                  background:${baseBg};transition:background .12s"
                onmouseover="this.style.background='${hoverBg}'"
                onmouseout="this.style.background='${baseBg}'">
                <div style="width:34px;height:34px;border-radius:9px;background:${color}18;
                  display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">
                  <i class="fa-solid ${n.icon || 'fa-bell'}" style="font-size:13px;color:${color}"></i>
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:${isRead ? '500' : '700'};color:var(--text,#0B1829);margin-bottom:2px;line-height:1.4">
                    ${escHtml(n.title)}
                  </div>
                  <div style="font-size:11px;color:var(--text3,#5A6A7A);line-height:1.5">${escHtml(n.body)}</div>
                  <div style="display:flex;align-items:center;gap:6px;margin-top:5px">
                    <span style="font-size:10px;color:var(--text3,#5A6A7A)">${ago}</span>
                    ${hasLink ? `<span style="font-size:10px;color:var(--accent,#4A90D9);font-weight:600">View asset →</span>` : ''}
                  </div>
                </div>
                ${!isRead ? `<div style="width:8px;height:8px;border-radius:50%;background:var(--accent,#4A90D9);flex-shrink:0;margin-top:6px"></div>` : ''}
              </div>`;
          }).join('')}
    </div>
    <div style="padding:10px 16px;border-top:1px solid var(--border,#E8ECF0);text-align:center;flex-shrink:0">
      <a href="assets.html" style="font-size:12px;color:var(--accent,#4A90D9);font-weight:600;text-decoration:none">
        View all assets →
      </a>
    </div>`;
}

function clearAllNotifications() {
  // Record every current notification so scan won't re-push them
  _addClearedKeys(_getNotifications());
  _saveNotifications([]);
  localStorage.removeItem(_notifReadKey());
  updateNotifBadge();
  const panel = document.getElementById('notif-panel');
  if (panel) renderNotifPanel(panel);
}

function _timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.round(diff/60000) + 'm ago';
  if (diff < 86400000) return Math.round(diff/3600000) + 'h ago';
  if (diff < 604800000) return Math.round(diff/86400000) + 'd ago';
  return new Date(ts).toLocaleDateString('en-NG');
}

// ── AUTO-GENERATE ALERTS (role-filtered) ─────────────────────────────────────
const NOTIF_ROLE_FILTER = {
  INSPECTION_OVERDUE:  ['System Admin','Supervisor','Sub-Head'],
  INSPECTION_DUE:      ['System Admin','Supervisor','Sub-Head','GIS Analyst'],
  CRITICAL_CONDITION:  ['System Admin','Supervisor','Sub-Head','GIS Analyst','Field Agent'],
  MISSING_COORDS:      ['System Admin','GIS Analyst','Field Agent'],
  PENDING_APPROVALS:   ['System Admin','Supervisor','Sub-Head'],
};
function _roleCanSee(type) {
  const allowed = NOTIF_ROLE_FILTER[type];
  if (!allowed) return true;
  const role = _userRole();
  return !role || allowed.includes(role);
}

async function runAlertScan() {
  let list = [];
  try {
    const r = await apiGetAssets({ limit: 2000 });
    list = r.assets || [];
  } catch { list = assets || []; }

  const today = new Date();
  const soon  = new Date(today.getTime() + 7*86400000);

  // Bucket matching assets by alert type instead of pushing one notification
  // per asset. With hundreds of assets sharing a data gap (missing GPS,
  // overdue inspections, etc. — all known, common conditions on this
  // registry), one-notification-per-asset blew straight past the 99+ badge
  // cap on the very first scan. One notification per TYPE, naming the
  // count, stays useful and bounded regardless of registry size.
  const buckets = {
    INSPECTION_OVERDUE: [],
    INSPECTION_DUE:     [],
    CRITICAL_CONDITION: [],
    MISSING_COORDS:     [],
  };

  list.forEach(a => {
    if (a.nextInspection && new Date(a.nextInspection) < today) {
      buckets.INSPECTION_OVERDUE.push(a);
    } else if (a.nextInspection && new Date(a.nextInspection) <= soon) {
      buckets.INSPECTION_DUE.push(a);
    }
    if (a.condition === 'Critical') buckets.CRITICAL_CONDITION.push(a);
    if (!a.lat && !a.location?.coordinates?.[1]) buckets.MISSING_COORDS.push(a);
  });

  const GROUP_DEFS = {
    INSPECTION_OVERDUE: {
      title: 'Inspections Overdue', icon: 'fa-calendar-xmark', color: '#e05555',
      body: (n, first) => n === 1
        ? `${first.name || first.assetId} is overdue for inspection`
        : `${n} assets are overdue for inspection`,
    },
    INSPECTION_DUE: {
      title: 'Inspections Due Soon', icon: 'fa-calendar-clock', color: '#f0a500',
      body: (n, first) => n === 1
        ? `${first.name || first.assetId} inspection due ${(first.nextInspection||'').slice(0,10)}`
        : `${n} assets have inspections due within 7 days`,
    },
    CRITICAL_CONDITION: {
      title: 'Critical Assets', icon: 'fa-triangle-exclamation', color: '#e05555',
      body: (n, first) => n === 1
        ? `${first.name || first.assetId} is in Critical condition — immediate attention required`
        : `${n} assets are in Critical condition — review needed`,
    },
    MISSING_COORDS: {
      title: 'Missing GPS Coordinates', icon: 'fa-location-slash', color: '#5A6A7A',
      body: (n, first) => n === 1
        ? `${first.name || first.assetId} has no coordinates — capture GPS to place on map`
        : `${n} assets have no coordinates — capture GPS to place them on the map`,
    },
  };

  Object.entries(buckets).forEach(([type, matches]) => {
    if (!matches.length || !_roleCanSee(type)) return;
    const def = GROUP_DEFS[type];
    const first = matches[0];
    pushNotification({
      type,
      // Single match still links straight to that asset, same as before;
      // multiple matches link to nothing specific (there's no one asset to
      // navigate to), same as the existing pending-approvals notification.
      assetId: matches.length === 1 ? (first.assetId || first.id) : null,
      title:   def.title,
      body:    def.body(matches.length, first),
      icon:    def.icon, color: def.color,
    });
  });

  // Pending approvals — only for approvers
  if (_roleCanSee('PENDING_APPROVALS')) {
    try {
      const s = await apiApprovalsSummary();
      if (s.pending > 0) {
        pushNotification({
          type: 'PENDING_APPROVALS', assetId: null,
          title: 'Pending Approvals',
          body: s.pending + ' asset capture' + (s.pending !== 1 ? 's' : '') + ' awaiting your review',
          icon: 'fa-stamp', color: '#f0a500',
        });
      }
    } catch {}
  }

  // ── MY_SUBMISSION_DECIDED — tells a submitter what happened to their OWN
  // captures/requests, not just reviewers what's waiting. Nothing in the
  // system notified the actual submitter before this; the only existing
  // approval-related alert (PENDING_APPROVALS above) is for reviewers.
  //
  // This can't just check "is it Approved/Rejected" the way the buckets
  // above check "is it currently Critical" — this system only ever looks
  // at present-moment state, with no stored history of what a user has
  // already been shown. Without a recency window, the very first scan
  // after this ships would notify every user about every decision ever
  // made on their submissions, including ones from months ago they already
  // know about. Restricting to `reviewedAt` within the last 3 days avoids
  // that flood while still catching anything genuinely new. Each decided
  // item gets its OWN notification (not grouped like the buckets above) —
  // "Mosque was approved" and "Guest House was rejected" are two different
  // pieces of information a person needs, not an interchangeable count.
  {
    const RECENT_MS = 3 * 86400000;
    const myId = _userId();

    const myDecidedAssets = list.filter(a =>
      String(a.capturedBy) === myId &&
      ['Approved', 'Rejected'].includes(a.approvalStatus) &&
      a.reviewedAt && (today - new Date(a.reviewedAt)) < RECENT_MS
    );
    myDecidedAssets.forEach(a => {
      const approved = a.approvalStatus === 'Approved';
      pushNotification({
        type: 'MY_ASSET_DECIDED', assetId: a.assetId || a.id,
        title: approved ? 'Capture Approved' : 'Capture Rejected',
        body: `${a.name || a.assetId} was ${approved ? 'approved' : 'rejected'}${a.rejectionReason ? ' — ' + a.rejectionReason : ''}`,
        icon: approved ? 'fa-circle-check' : 'fa-circle-xmark',
        color: approved ? '#2DB87B' : '#e05555',
      });
    });

    try {
      const fr = await apiGetFormRequests();
      const myDecidedForms = (fr.requests || []).filter(r =>
        String(r.submittedBy?._id || r.submittedBy) === myId &&
        ['Approved', 'Rejected'].includes(r.status) &&
        r.reviewedAt && (today - new Date(r.reviewedAt)) < RECENT_MS
      );
      myDecidedForms.forEach(r => {
        const approved = r.status === 'Approved';
        const label = (typeof FORM_LABELS !== 'undefined' && FORM_LABELS[r.formType]) || r.formType;
        pushNotification({
          // assetId doubles as the generic per-item dedup key across this
          // whole notification system — using the form request's own _id
          // here since it isn't tied to an asset.
          type: 'MY_FORM_DECIDED', assetId: r._id,
          title: approved ? 'Form Request Approved' : 'Form Request Rejected',
          body: `${label} was ${approved ? 'approved' : 'rejected'}${r.reviewRemarks ? ' — ' + r.reviewRemarks : ''}`,
          icon: approved ? 'fa-circle-check' : 'fa-circle-xmark',
          color: approved ? '#2DB87B' : '#e05555',
        });
      });
    } catch {}
  }

  updateNotifBadge();
}

// ── INJECT BELL BUTTON INTO HEADER ───────────────────────────────────────────
function injectNotifBell() {
  const header = document.getElementById('header');
  if (!header || document.getElementById('notif-bell')) return;

  const btn = document.createElement('button');
  btn.id = 'notif-bell';
  btn.onclick = toggleNotifPanel;
  btn.title = 'Notifications';
  btn.style.cssText = [
    'position:relative', 'background:#fff', 'border:1px solid var(--border,#E8ECF0)',
    'color:var(--text2,#2C3E50)', 'border-radius:8px', 'width:36px', 'height:36px',
    'display:flex', 'align-items:center', 'justify-content:center',
    'cursor:pointer', 'font-size:14px', 'flex-shrink:0', 'transition:border-color .15s',
  ].join(';');
  btn.onmouseover = () => { btn.style.borderColor = 'var(--accent,#4A90D9)'; btn.style.color = 'var(--accent,#4A90D9)'; };
  btn.onmouseout  = () => { btn.style.borderColor = ''; btn.style.color = ''; };
  btn.innerHTML = `
    <i class="fa-solid fa-bell"></i>
    <span class="notif-badge" style="
      position:absolute;top:-5px;right:-5px;
      background:#e05555;color:#fff;
      font-size:9px;font-weight:700;
      padding:1px 5px;border-radius:10px;
      min-width:16px;text-align:center;
      display:none;line-height:14px;
      font-family:'Plus Jakarta Sans',sans-serif">0</span>`;

  const actions = header.querySelector('.header-actions');
  if (actions) actions.insertBefore(btn, actions.firstChild);
  else header.appendChild(btn);
}

// ── ROLE / DIVISION NAV GATING — handled by app.js, not here ────────────────
// The real frontend app.js (only made available partway through this
// session — earlier work here had to route around not having it) already
// has a complete, more robust applyRoleGates() that processes the exact
// same data-require-role / data-division attributes, plus a hardcoded
// navGates map for a few specific pages, plus button-level disabling for
// delete/edit/create/export actions. An earlier version of this file had
// a duplicate, simpler implementation of just the nav-hiding piece — removed
// once app.js turned out to already cover it, to avoid two independent
// implementations of the same gating logic silently drifting apart over
// time (exactly the class of bug this whole session kept finding).

// ── INIT ──────────────────────────────────────────────────────────────────────
function initNotifications() {
  injectNotifBell();
  updateNotifBadge();
  // Run scan 2 seconds after page load to avoid blocking critical path
  setTimeout(runAlertScan, 2000);
  // Re-scan every 10 minutes
  setInterval(runAlertScan, 600000);

  // Cross-tab/page sync: localStorage writes in one open tab don't trigger
  // anything in another already-open tab on their own — the 'storage' event
  // is how the browser tells other tabs something changed. Without this,
  // two pages open at once (or a page left open while another page's scan
  // runs) can show two different unread counts until one of them reloads or
  // runs its own next scan. Only react to this user's own notification/read
  // keys, not unrelated localStorage writes from elsewhere in the app.
  window.addEventListener('storage', (e) => {
    if (e.key === _notifKey() || e.key === _notifReadKey()) {
      updateNotifBadge();
      const panel = document.getElementById('notif-panel');
      if (panel) renderNotifPanel(panel);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNotifications);
} else {
  setTimeout(initNotifications, 300);
}

} // end _AS_NOTIF_LOADED guard