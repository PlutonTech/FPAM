import type { MeReport } from '../../api/extras';
import { MONTHS } from '../../api/extras';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const d = (v?: string) => (v ? new Date(v).toLocaleDateString('en-NG') : '—');

/** Printable Facility Management Clearance Certificate (same wording as the legacy page). */
export function printClearanceCertificate(r: MeReport, assetName: string, assetId: string) {
  const month = MONTHS[(r.reportMonth || 1) - 1];
  const sat = r.satisfactory !== false;
  const type = r.reportType === 'nhp' ? 'NHP' : r.reportType === 'others' ? 'Other' : 'Secretariat';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Clearance Certificate — ${esc(assetName)} ${esc(month)} ${r.reportYear}</title>
<style>
body{font-family:Georgia,'Times New Roman',serif;color:#0B1829;max-width:760px;margin:30px auto;padding:0 24px}
.hd{text-align:center;border-bottom:3px double #0B2545;padding-bottom:14px;margin-bottom:22px}
.hd .a{font-size:17px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px}
.hd .b{font-size:13px;margin-top:2px}.hd .t{margin-top:14px;font-size:20px;font-weight:bold;letter-spacing:1px;color:#0B2545}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;margin-bottom:22px;font-size:14px}
.k{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#5A6A7A;font-family:system-ui,sans-serif}
.cert{border:1px solid #c5d4e8;border-radius:6px;padding:18px;font-size:15px;line-height:1.7;margin-bottom:18px}
.verdict{font-weight:bold;color:${sat ? '#0f7a4d' : '#a02020'}}
.unsat{margin-top:10px;font-size:13px;color:#a02020}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:40px;font-size:13px}
.sig .line{border-top:1px solid #0B1829;padding-top:6px;margin-top:36px;font-weight:bold}
button{position:fixed;top:14px;right:14px;padding:8px 16px;background:#0B2545;color:#fff;border:0;border-radius:6px;cursor:pointer;font-family:system-ui}
@media print{button{display:none}}
</style></head><body>
<button id="print-btn">Print</button>
<div class="hd"><div class="a">Federal Ministry of Housing and Urban Development</div><div class="b">Headquarters, Mabushi, Abuja</div>
<div class="b">Department of Federal Public Assets Maintenance</div><div class="t">FACILITY MANAGEMENT CLEARANCE CERTIFICATE</div></div>
<div class="grid">
<div><div class="k">Site location</div>${esc(assetName)}<div class="k" style="margin-top:2px">${esc(assetId)}</div></div>
<div><div class="k">Report period</div>${esc(month)} ${r.reportYear} — ${type}</div>
<div><div class="k">Contractor</div>${esc(r.contractorName || '—')}${r.contractorAddress ? `<br><small>${esc(r.contractorAddress)}</small>` : ''}</div>
<div><div class="k">Contract no.</div>${esc(r.contractNo || '—')}${r.contractSum ? `<br><small>₦${Number(r.contractSum).toLocaleString()}</small>` : ''}</div>
</div>
<div class="cert">This is to certify that the above company has <span class="verdict">${sat ? 'SATISFACTORILY' : 'UNSATISFACTORILY'}</span>
carried out all Facility Management works as specified in the Contract document for the Month of ${esc(month)} ${r.reportYear}.
${!sat && r.unsatisfactoryWorks ? `<div class="unsat"><strong>Unsatisfactory works / works not done:</strong><br>${esc(r.unsatisfactoryWorks)}</div>` : ''}
<div style="margin-top:10px;font-size:13px">Overall completion: <strong>${r.overallPercentage || 0}%</strong> · Date of issuance: <strong>${d(r.clearanceDate)}</strong></div></div>
<div class="sig">
<div><div class="k">Chief Resident Architect, FMW&amp;H</div><div class="line">${esc(r.craName || '')}</div>${esc(r.craDesignation || '')}<br>Date: ${d(r.craDate)}</div>
<div><div class="k">Facility Manager</div><div class="line">${esc(r.facilityManagerName || '')}</div>${esc(r.facilityManagerDesig || '')}<br>Date: ${d(r.facilityManagerDate)}</div>
</div></body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('Allow pop-ups for this site to print the certificate.'); return; }
  w.document.write(html); w.document.close();
  // No inline onclick: the dashboard's Content-Security-Policy (inherited by
  // this window) blocks inline scripts, so wire the button from here.
  w.document.getElementById('print-btn')?.addEventListener('click', () => w.print());
}
