import { useState } from 'react';

import * as assetsApi from '../../api/assets';
import { errorMessage } from '../../api/client';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { ConditionTag } from '../../components/Tags';
import type { Asset } from '../../types';
import { ASSESSED, CONDITIONS, SECTORS, STATUSES } from '../../lib/assets';

const ENUMS: Record<string, readonly string[]> = { condition: CONDITIONS, status: STATUSES, sector: SECTORS, assessed: ASSESSED };

interface Row {
  assetId: string; condition: string; status: string; sector: string; assessed: string;
  notes: string; captureDate: string;
}
interface Change extends Row { current: Asset }

/** Case-insensitive match to the canonical enum spelling; null = invalid. */
function canonical(field: string, raw: string): string | null {
  if (!raw) return '';
  return ENUMS[field].find(v => v.toLowerCase() === raw.trim().toLowerCase()) ?? null;
}

async function readRows(file: File): Promise<Record<string, string>[]> {
  // SheetJS handles .xlsx/.xls and CSV (including quoted commas) alike.
  // Loaded on demand — it's ~400 KB and only needed here.
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  return raw.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [
    k.toLowerCase().trim(),
    v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').trim(),
  ])));
}

export default function BulkUpdateModal({ all, onClose, onDone }: { all: Asset[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [notFound, setNotFound] = useState<string[]>([]);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [parseError, setParseError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onFile(file?: File) {
    if (!file) return;
    setParseError(''); setChanges(null);
    try {
      const rows = await readRows(file);
      const lookup = new Map<string, Asset>();
      all.forEach(a => { lookup.set(a.assetId, a); if (a.assetCode) lookup.set(a.assetCode, a); });

      const bad: string[] = [], missing: string[] = [], out: Change[] = [];
      rows.forEach((r, i) => {
        const line = i + 2;
        const id = r.assetid || r['asset id'] || r.asset_id || r.assetcode || r['asset code'] || r.id || '';
        if (!id) { bad.push(`Row ${line}: missing assetId`); return; }
        const row: Row = { assetId: id, condition: '', status: '', sector: '', assessed: '',
          notes: r.notes || '', captureDate: r.capturedate || r['capture date'] || '' };
        for (const f of Object.keys(ENUMS) as (keyof Row)[]) {
          const v = canonical(f, r[f] || '');
          if (v === null) { bad.push(`Row ${line}: invalid ${f} "${r[f]}"`); return; }
          row[f] = v;
        }
        if (row.captureDate && isNaN(new Date(row.captureDate).getTime())) { bad.push(`Row ${line}: invalid captureDate`); return; }
        const current = lookup.get(id);
        if (!current) { missing.push(id); return; }
        const changed =
          (row.condition && row.condition !== current.condition) ||
          (row.status && row.status !== current.status) ||
          (row.sector && row.sector !== current.sector) ||
          (row.assessed && row.assessed !== (current.assessed || 'Unassessed')) ||
          (row.notes && row.notes !== current.notes) || !!row.captureDate;
        if (changed) out.push({ ...row, current });
      });
      setChanges(out); setNotFound(missing); setInvalid(bad);
    } catch (err) { setParseError(errorMessage(err)); }
  }

  async function apply() {
    if (!changes?.length) return;
    setBusy(true);
    let done = 0; const failures: string[] = [];
    for (const c of changes) {
      // Blank cells are left out entirely, so they never clear existing values.
      const payload: Record<string, unknown> = {};
      if (c.condition) {
        payload.condition = c.condition;
        if (c.current.condition && c.current.condition !== c.condition) payload.previousCondition = c.current.condition;
      }
      if (c.status) payload.status = c.status;
      if (c.sector) payload.sector = c.sector;
      if (c.assessed) payload.assessed = c.assessed;
      if (c.notes) payload.notes = c.notes;
      if (c.captureDate) payload.captureDate = c.captureDate;
      try { await assetsApi.updateAsset(c.current.assetId, payload); done++; }
      catch (err) { failures.push(`${c.assetId}: ${errorMessage(err)}`); }
    }
    if (failures.length) {
      console.warn('[bulk update] failures', failures);
      toast(`${done} updated, ${failures.length} failed — ${failures[0]}`, 'error');
    } else toast(`${done} assets updated`);
    onDone();
  }

  return (
    <Modal wide title="Bulk update from Excel / CSV" onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      {!!changes?.length && (
        <button className="btn btn-primary" onClick={apply} disabled={busy}>
          <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-bolt'}`} /> Apply {changes.length} update{changes.length === 1 ? '' : 's'}
        </button>
      )}
    </>}>
      <div className="card" style={{ padding: 14, marginBottom: 14, fontSize: 12, color: 'var(--text2)' }}>
        <strong>File format.</strong> Required column: <code>assetId</code> (or <code>assetCode</code>).
        Optional: <code>condition</code>, <code>status</code>, <code>sector</code>, <code>assessed</code>, <code>notes</code>, <code>captureDate</code>.
        Blank cells leave the existing value unchanged.
      </div>
      <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
        <i className="fa-solid fa-file-excel" /> Choose Excel / CSV file
        <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => onFile(e.target.files?.[0])} />
      </label>

      {parseError && <div className="form-error">Could not read file: {parseError}</div>}

      {changes && (
        <div style={{ marginTop: 16 }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <span className="tag tag-blue">{changes.length} with changes</span>
            {notFound.length > 0 && <span className="tag tag-red" title={notFound.join(', ')}>{notFound.length} not found</span>}
            {invalid.length > 0 && <span className="tag tag-warn">{invalid.length} invalid rows</span>}
          </div>
          {changes.length > 0 ? (
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Asset</th><th>Condition</th><th>Other changes</th></tr></thead>
                <tbody>
                  {changes.map(c => (
                    <tr key={c.assetId}>
                      <td className="id-cell">{c.assetId}<div className="cell-sub">{c.current.name}</div></td>
                      <td>{c.condition ? <><ConditionTag value={c.current.condition} /> → <ConditionTag value={c.condition} /></> : <span className="muted">unchanged</span>}</td>
                      <td className="cell-sub">{[c.status && 'Status', c.sector && 'Sector', c.assessed && 'Assessed', c.notes && 'Notes', c.captureDate && 'Date'].filter(Boolean).join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="muted" style={{ fontSize: 12 }}>No changes detected for matched assets.</div>}
          {invalid.length > 0 && <div className="form-error">{invalid.slice(0, 20).join(' · ')}{invalid.length > 20 ? ` · +${invalid.length - 20} more` : ''}</div>}
        </div>
      )}
    </Modal>
  );
}
