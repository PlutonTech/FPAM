import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { useToast } from '../components/Toast';

interface Suggestions { name?: string; state?: string; condition?: string; type?: string; coordinates?: [number, number]; [k: string]: unknown }
interface JobStatus { state: string; result?: { text: string; suggestions: Suggestions }; failReason?: string }

const ACCEPT = 'image/*,.pdf,.docx,.doc,.txt';

export default function OcrPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'failed'>('idle');
  const [result, setResult] = useState<JobStatus['result'] | null>(null);
  const [error, setError] = useState('');
  const poll = useRef<number | null>(null);

  useEffect(() => () => { if (poll.current) window.clearTimeout(poll.current); }, []);
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setPreview(''); return; }
    const u = URL.createObjectURL(file); setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  async function scan() {
    if (!file) return;
    setPhase('uploading'); setError(''); setResult(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const { jobId } = await api<{ jobId: string }>('/ocr/scan', { method: 'POST', body: fd });
      setPhase('processing');
      const started = Date.now();
      const check = async () => {
        try {
          const s = await api<JobStatus>(`/ocr/jobs/${encodeURIComponent(jobId)}`);
          if (s.state === 'completed' && s.result) { setResult(s.result); setPhase('done'); return; }
          if (s.state === 'failed') { setError(s.failReason || 'Text extraction failed'); setPhase('failed'); return; }
          if (Date.now() - started > 120000) { setError('Timed out after 2 minutes — try a smaller or clearer file'); setPhase('failed'); return; }
          poll.current = window.setTimeout(check, 1500);
        } catch (err) { setError(errorMessage(err)); setPhase('failed'); }
      };
      check();
    } catch (err) { setError(errorMessage(err)); setPhase('failed'); }
  }

  const sugg = result?.suggestions || {};
  const suggestionRows = Object.entries(sugg).filter(([, v]) => v !== undefined && v !== '' && v !== null);

  function useInCapture() {
    navigate('/capture', { state: { prefill: sugg, source: file?.name } });
    toast('Capture form pre-filled from the scan', 'info');
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">OCR scanner</h1>
          <div className="page-sub">Extract text from a photo, scanned PDF, Word document or text file, then use it to start a capture</div>
        </div>
      </header>

      <div className="dash-split">
        <div className="card form-section">
          <label className="drop-zone" style={{ padding: 28 }}>
            <i className="fa-solid fa-file-arrow-up" style={{ fontSize: 26 }} />
            <strong>{file ? file.name : 'Choose a file to scan'}</strong>
            <span className="cell-sub">Images (JPG, PNG), PDF, DOCX or TXT</span>
            <input type="file" accept={ACCEPT} hidden onChange={e => { const f = e.target.files?.[0] || null; e.target.value = ''; setFile(f); setPhase('idle'); setResult(null); setError(''); }} />
          </label>
          {preview && <img src={preview} alt="Selected file" className="ocr-preview" />}
          <button className="btn btn-primary btn-block" disabled={!file || phase === 'uploading' || phase === 'processing'} onClick={scan}>
            {phase === 'uploading' ? <><i className="fa-solid fa-spinner fa-spin" /> Uploading…</>
              : phase === 'processing' ? <><i className="fa-solid fa-spinner fa-spin" /> Reading text…</>
              : <><i className="fa-solid fa-magnifying-glass" /> Extract text</>}
          </button>
          {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}</div>}
        </div>

        <div className="card form-section">
          <h2 className="form-section-title">Suggested fields</h2>
          {phase !== 'done' ? <div className="cell-sub">Results appear here after scanning.</div> : suggestionRows.length === 0 ? (
            <div className="cell-sub">No asset details recognised — you can still copy from the text below.</div>
          ) : (
            <>
              <div className="meta-grid" style={{ marginBottom: 14 }}>
                {suggestionRows.map(([k, v]) => (
                  <div key={k}><div className="meta-key">{k}</div><div className="meta-val">{Array.isArray(v) ? v.join(', ') : String(v)}</div></div>
                ))}
              </div>
              <button className="btn btn-primary btn-sm" onClick={useInCapture}><i className="fa-solid fa-location-crosshairs" /> Start a capture with these</button>
            </>
          )}
        </div>
      </div>

      {phase === 'done' && (
        <div className="card form-section" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 className="form-section-title" style={{ margin: 0 }}>Extracted text</h2>
            <button className="btn btn-ghost btn-xs" onClick={() => navigator.clipboard?.writeText(result?.text || '').then(() => toast('Copied'))}><i className="fa-solid fa-copy" /> Copy</button>
          </div>
          <pre className="ocr-text">{result?.text || '(no text found)'}</pre>
        </div>
      )}
    </div>
  );
}
