import type { FormField } from './formDefs';
import { FORM_FIELDS } from './formDefs';

type Data = Record<string, unknown>;

// Field keys may be dotted paths (e.g. "commitments.structuredPlan").
const getPath = (o: Data, path: string): unknown =>
  path.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Data)[k] : undefined), o);

function setPath(o: Data, path: string, value: unknown): Data {
  const [head, ...rest] = path.split('.');
  if (!rest.length) return { ...o, [head]: value };
  const child = (o[head] && typeof o[head] === 'object' ? o[head] : {}) as Data;
  return { ...o, [head]: setPath(child, rest.join('.'), value) };
}

const dateVal = (v: unknown) => {
  if (!v) return '';
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

/** Average of the 1–5 ratings, stored alongside the ratings (legacy behaviour). */
function averageScore(rows: { rating?: number }[]) {
  const scored = rows.filter(r => r.rating);
  return scored.length ? +(scored.reduce((s, r) => s + (r.rating || 0), 0) / scored.length).toFixed(2) : undefined;
}

interface Props { formType: string; value: Data; onChange?: (v: Data) => void; readOnly?: boolean }

export default function FormRenderer({ formType, value, onChange, readOnly }: Props) {
  const fields = FORM_FIELDS[formType];
  if (!fields) return <div className="muted">Unknown form type</div>;
  const set = (path: string, v: unknown) => onChange?.(setPath(value, path, v));

  return (
    <div className="ff-grid">
      {fields.map(f => <Field key={f.key} f={f} value={getPath(value, f.key)} readOnly={readOnly}
                              onChange={v => {
                                if (f.type === 'ratingTable') onChange?.({ ...setPath(value, f.key, v), averageScore: averageScore(v as { rating?: number }[]) });
                                else set(f.key, v);
                              }} />)}
    </div>
  );
}

function Field({ f, value, onChange, readOnly }: { f: FormField; value: unknown; onChange: (v: unknown) => void; readOnly?: boolean }) {
  const id = `ff-${f.key.replace(/\./g, '-')}`;
  const label = <label className="form-label" htmlFor={id}>{f.label}</label>;
  switch (f.type) {
    case 'checkbox':
      return (
        <label className="ff-check full">
          <input id={id} type="checkbox" checked={!!value} disabled={readOnly} onChange={e => onChange(e.target.checked)} /> {f.label}
        </label>
      );
    case 'textarea':
      return <div className="full">{label}<textarea id={id} className="form-control" rows={3} value={String(value ?? '')} readOnly={readOnly} onChange={e => onChange(e.target.value || undefined)} /></div>;
    case 'select':
      return (
        <div>{label}
          <select id={id} className="form-control" value={String(value ?? '')} disabled={readOnly} onChange={e => onChange(e.target.value || undefined)}>
            <option value="" />{f.options!.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      );
    case 'number':
      return <div>{label}<input id={id} className="form-control" type="number" value={value == null ? '' : String(value)} readOnly={readOnly}
                                onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))} /></div>;
    case 'date':
      return <div>{label}<input id={id} className="form-control" type="date" value={dateVal(value)} readOnly={readOnly} onChange={e => onChange(e.target.value || undefined)} /></div>;
    case 'table':
      return <TableField f={f} rows={(value as Data[]) || []} onChange={onChange} readOnly={readOnly} />;
    case 'ratingTable':
      return <RatingTable f={f} rows={(value as Data[]) || []} onChange={onChange} readOnly={readOnly} />;
    case 'checkTable':
      return <CheckTable f={f} rows={(value as Data[]) || []} onChange={onChange} readOnly={readOnly} />;
    default:
      return <div>{label}<input id={id} className="form-control" value={String(value ?? '')} readOnly={readOnly} onChange={e => onChange(e.target.value || undefined)} /></div>;
  }
}

function TableField({ f, rows, onChange, readOnly }: { f: FormField; rows: Data[]; onChange: (v: unknown) => void; readOnly?: boolean }) {
  const cols = f.columns || [];
  const shown = rows.length || readOnly ? rows : [{}];
  const update = (i: number, key: string, v: unknown) => {
    const next = shown.map((r, k) => (k === i ? { ...r, [key]: v } : r));
    // Rows with nothing filled in are dropped, as in the legacy collector.
    onChange(next.filter(r => Object.values(r).some(x => x !== undefined && x !== '')));
  };
  return (
    <div className="full">
      <span className="form-label">{f.label}</span>
      <div className="table-wrap ff-table">
        <table className="data-table">
          <thead><tr>{cols.map(c => <th key={c.key}>{c.label}</th>)}{!readOnly && <th />}</tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={cols.length} className="cell-sub">No rows</td></tr>}
            {shown.map((r, i) => (
              <tr key={i}>
                {cols.map(c => (
                  <td key={c.key}>
                    {c.type === 'select' ? (
                      <select className="form-control" value={String(r[c.key] ?? '')} disabled={readOnly} onChange={e => update(i, c.key, e.target.value || undefined)}>
                        <option value="" />{c.options!.map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input className="form-control" type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'} readOnly={readOnly}
                             value={c.type === 'date' ? dateVal(r[c.key]) : String(r[c.key] ?? '')}
                             onChange={e => update(i, c.key, e.target.value === '' ? undefined : c.type === 'number' ? Number(e.target.value) : e.target.value)} />
                    )}
                  </td>
                ))}
                {!readOnly && <td><button type="button" className="btn btn-ghost btn-xs" aria-label="Remove row" onClick={() => onChange(shown.filter((_, k) => k !== i))}><i className="fa-solid fa-xmark" /></button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && <button type="button" className="btn btn-ghost btn-xs" style={{ marginTop: 6 }} onClick={() => onChange([...shown, {}])}><i className="fa-solid fa-plus" /> Add row</button>}
    </div>
  );
}

function RatingTable({ f, rows, onChange, readOnly }: { f: FormField; rows: Data[]; onChange: (v: unknown) => void; readOnly?: boolean }) {
  const by = new Map(rows.map(r => [r.component as string, r]));
  const update = (comp: string, patch: Data) => {
    const next = (f.components || []).map(c => (c === comp ? { component: c, ...by.get(c), ...patch } : by.get(c)))
      .filter((r): r is Data => !!r && (r.rating !== undefined || !!r.remarks));
    onChange(next);
  };
  return (
    <div className="full">
      <span className="form-label">{f.label}</span>
      <div className="table-wrap ff-table">
        <table className="data-table">
          <thead><tr><th>Component</th><th>Rating (1–5)</th><th>Remarks</th></tr></thead>
          <tbody>
            {(f.components || []).map(c => {
              const r = by.get(c) || {};
              return (
                <tr key={c}>
                  <td>{c}</td>
                  <td><select className="form-control" value={String(r.rating ?? '')} disabled={readOnly} onChange={e => update(c, { rating: e.target.value ? Number(e.target.value) : undefined })}>
                    <option value="" />{[5, 4, 3, 2, 1].map(n => <option key={n}>{n}</option>)}</select></td>
                  <td><input className="form-control" value={String(r.remarks ?? '')} readOnly={readOnly} onChange={e => update(c, { remarks: e.target.value || undefined })} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CheckTable({ f, rows, onChange, readOnly }: { f: FormField; rows: Data[]; onChange: (v: unknown) => void; readOnly?: boolean }) {
  const by = new Map(rows.map(r => [r.label as string, r]));
  const update = (label: string, patch: Data) =>
    onChange((f.items || []).map(l => ({ label: l, compliant: false, ...by.get(l), ...(l === label ? patch : {}) })));
  return (
    <div className="full">
      <span className="form-label">{f.label}</span>
      <div className="table-wrap ff-table">
        <table className="data-table">
          <thead><tr><th>Item</th><th>Compliant</th><th>Remarks</th></tr></thead>
          <tbody>
            {(f.items || []).map(l => {
              const r = by.get(l) || {};
              return (
                <tr key={l}>
                  <td>{l}</td>
                  <td><input type="checkbox" checked={!!r.compliant} disabled={readOnly} onChange={e => update(l, { compliant: e.target.checked })} aria-label={`${l} compliant`} /></td>
                  <td><input className="form-control" value={String(r.remarks ?? '')} readOnly={readOnly} onChange={e => update(l, { remarks: e.target.value || undefined })} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
