import type { Asset } from '../../types';
import { formatDate, riskScore } from '../../lib/assets';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Printable list of assets whose next inspection date has passed. */
export function openDeferredMaintenanceReport(assets: Asset[]) {
  const today = Date.now();
  const overdue = assets
    .filter(a => a.nextInspection && new Date(a.nextInspection).getTime() < today)
    .map(a => ({ a, days: Math.round((today - new Date(a.nextInspection!).getTime()) / 86400000), risk: riskScore(a) }))
    .sort((x, y) => y.days - x.days);

  const rows = overdue.map(({ a, days, risk }) => `<tr>
    <td>${esc(a.assetId)}</td><td>${esc(a.name)}</td><td>${esc(a.mda || '—')}</td><td>${esc(a.state || '—')}</td>
    <td>${esc(a.condition || '—')}</td><td>${esc(formatDate(a.nextInspection))}</td><td><b>${days}</b></td><td>${risk}</td></tr>`).join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Deferred Maintenance Report</title>
<style>body{font-family:system-ui,sans-serif;font-size:13px;color:#0B1829;padding:32px}
h1{font-size:20px;margin-bottom:4px}.sub{color:#5A6A7A;margin-bottom:18px}
table{width:100%;border-collapse:collapse;font-size:12px}th{background:#a02020;color:#fff;text-align:left;padding:8px;font-size:10px;text-transform:uppercase}
td{padding:8px;border-bottom:1px solid #E8ECF0}button{position:fixed;top:16px;right:16px;padding:8px 16px;background:#e05555;color:#fff;border:0;border-radius:6px;cursor:pointer}
@media print{button{display:none}}</style></head><body>
<button onclick="print()">Print</button>
<h1>Deferred Maintenance Report</h1>
<div class="sub">Generated ${esc(new Date().toLocaleString('en-NG'))} · ${overdue.length} overdue of ${assets.length} assets</div>
${overdue.length ? `<table><thead><tr><th>ID</th><th>Name</th><th>MDA</th><th>State</th><th>Condition</th><th>Due</th><th>Days overdue</th><th>Risk</th></tr></thead><tbody>${rows}</tbody></table>`
  : '<p>No assets are overdue for inspection.</p>'}
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Allow pop-ups for this site to open the report.'); return; }
  win.document.write(html);
  win.document.close();
}
