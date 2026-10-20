import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, authedBlobUrl, downloadFile, errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import AuthedImage from '../components/AuthedImage';
import { useToast } from '../components/Toast';
import { Tag } from '../components/Tags';
import { formatDate } from '../lib/assets';

type Kind = 'photo' | 'document' | 'excel';
interface DbFile {
  _id?: string; fileId?: string; filename?: string; originalname?: string; contentType?: string; mimeType?: string;
  sizeBytes?: number; length?: number; uploadedAt?: string; _assetId: string; _assetName: string; _fileType: Kind;
}
const SEG: Record<Kind, string> = { photo: 'photos', document: 'documents', excel: 'excel' };
const ICON: Record<Kind, string> = { photo: 'fa-image', document: 'fa-file-lines', excel: 'fa-file-excel' };
const fid = (f: DbFile) => String(f.fileId || f._id);
const path = (f: DbFile) => `/assets/${encodeURIComponent(f._assetId)}/${SEG[f._fileType]}/${encodeURIComponent(fid(f))}`;
const size = (n?: number) => (n ? (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`) : '—');

export default function FileDbPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [files, setFiles] = useState<DbFile[] | null>(null);
  const [error, setError] = useState('');
  const [kind, setKind] = useState<'' | Kind>('');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('list');

  const load = useCallback(async () => {
    setError('');
    try {
      // The endpoint pages over assets that have files; keep going until a page comes back empty.
      const LIMIT = 200; const all: DbFile[] = [];
      for (let page = 1; page <= 50; page++) {
        const r = await api<{ files: DbFile[] }>(`/assets/files?limit=${LIMIT}&page=${page}`);
        if (!r.files?.length) break;
        all.push(...r.files);
      }
      setFiles(all);
    } catch (err) { setError(errorMessage(err)); setFiles([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (files || []).filter(f => (!kind || f._fileType === kind) &&
      (!t || [f.originalname, f.filename, f._assetId, f._assetName].some(v => (v || '').toLowerCase().includes(t))))
      .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
  }, [files, kind, q]);

  const counts = useMemo(() => {
    const c: Record<Kind, number> = { photo: 0, document: 0, excel: 0 }; let bytes = 0;
    (files || []).forEach(f => { c[f._fileType]++; bytes += f.sizeBytes || f.length || 0; });
    return { ...c, bytes };
  }, [files]);

  async function open(f: DbFile) {
    try { window.open(await authedBlobUrl(path(f)), '_blank'); } catch (err) { toast(errorMessage(err), 'error'); }
  }
  async function remove(f: DbFile) {
    if (!confirm(`Delete ${f.originalname || f.filename} from ${f._assetName}? This cannot be undone.`)) return;
    try { await api(path(f), { method: 'DELETE' }); toast('File deleted'); setFiles(list => (list || []).filter(x => !(fid(x) === fid(f) && x._assetId === f._assetId))); }
    catch (err) { toast(errorMessage(err), 'error'); }
  }
  const name = (f: DbFile) => f.originalname || f.filename || 'file';

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">File database</h1>
          <div className="page-sub">{files ? `${files.length.toLocaleString()} files · ${size(counts.bytes)}` : 'Loading…'} across all assets</div>
        </div>
        <div className="seg" role="radiogroup" aria-label="View">
          <button className={`seg-btn${view === 'list' ? ' active' : ''}`} role="radio" aria-checked={view === 'list'} onClick={() => setView('list')}><i className="fa-solid fa-list" /> List</button>
          <button className={`seg-btn${view === 'grid' ? ' active' : ''}`} role="radio" aria-checked={view === 'grid'} onClick={() => setView('grid')}><i className="fa-solid fa-table-cells" /> Photos</button>
        </div>
      </header>

      <div className="tab-bar card" role="tablist" style={{ marginBottom: 12 }}>
        {([['', 'All', files?.length], ['photo', 'Photos', counts.photo], ['document', 'Documents', counts.document], ['excel', 'Spreadsheets', counts.excel]] as const).map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={kind === k} className={`tab-btn${kind === k ? ' active' : ''}`} onClick={() => setKind(k)}>
            {label}{n ? <span className="tab-count">{n}</span> : null}
          </button>
        ))}
      </div>
      <div className="filter-bar">
        <div className="search"><i className="fa-solid fa-magnifying-glass" />
          <input className="filter-input" placeholder="Search file name, asset name or ID…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search files" /></div>
      </div>

      {files === null ? <div className="card loading"><i className="fa-solid fa-spinner fa-spin" /> Loading files…</div>
        : error ? <div className="card empty-state"><div className="empty-title">Could not load files</div><div className="empty-sub">{error}</div></div>
        : shown.length === 0 ? <div className="card empty-state"><div className="empty-icon"><i className="fa-solid fa-folder-open" /></div><div className="empty-title">No files</div><div className="empty-sub">Upload files from an asset's page or during capture</div></div>
        : view === 'grid' ? (
          <div className="photo-grid">
            {shown.filter(f => f._fileType === 'photo').slice(0, 200).map(f => (
              <button key={f._assetId + fid(f)} className="photo-card file-tile" onClick={() => open(f)} title={`${name(f)} — ${f._assetName}`}>
                <AuthedImage path={path(f)} alt={name(f)} />
                <span className="file-tile-cap">{f._assetName}</span>
              </button>
            ))}
            {!shown.some(f => f._fileType === 'photo') && <div className="cell-sub">No photos in this view.</div>}
          </div>
        ) : (
          <div className="card table-wrap">
            <table className="data-table file-table">
              <thead><tr><th>File</th><th>Asset</th><th>Type</th><th>Size</th><th>Uploaded</th><th /></tr></thead>
              <tbody>
                {shown.slice(0, 500).map(f => (
                  <tr key={f._assetId + fid(f)}>
                    <td className="ft-name"><div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><i className={`fa-solid ${ICON[f._fileType]}`} style={{ color: 'var(--accent)', width: 16, marginTop: 3 }} />
                      <span className="file-name" title={name(f)}>{name(f)}</span></div></td>
                    <td className="ft-asset"><Link to={`/assets/${encodeURIComponent(f._assetId)}`} style={{ color: 'inherit' }}>{f._assetName}</Link><div className="id-cell">{f._assetId}</div></td>
                    <td className="ft-type"><Tag tone={f._fileType === 'photo' ? 'blue' : f._fileType === 'excel' ? 'green' : 'gray'}>{f._fileType}</Tag></td>
                    <td className="cell-sub ft-size">{size(f.sizeBytes || f.length)}</td>
                    <td className="cell-sub ft-date">{formatDate(f.uploadedAt)}</td>
                    <td className="ft-actions"><div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      <button className="btn btn-ghost btn-xs" onClick={() => open(f)} title="Open"><i className="fa-solid fa-eye" /></button>
                      <button className="btn btn-ghost btn-xs" title="Download" onClick={() => downloadFile(path(f), name(f)).catch(err => toast(errorMessage(err), 'error'))}><i className="fa-solid fa-download" /></button>
                      {can('canEdit') && <button className="btn btn-danger btn-xs" title="Delete" onClick={() => remove(f)}><i className="fa-solid fa-trash" /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > 500 && <div className="cell-sub" style={{ padding: 10 }}>Showing the newest 500 of {shown.length.toLocaleString()} — search to narrow it down.</div>}
          </div>
        )}
    </div>
  );
}
