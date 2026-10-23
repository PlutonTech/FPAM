import { useEffect, useState } from 'react';
import { listQueued, removeQueued, syncQueue, useOfflineQueue, type QueuedCapture } from '../lib/offlineQueue';
import { useToast } from './Toast';

/** Captures saved on this device while offline, waiting to upload. */
export default function OfflineQueuePanel() {
  const { count, syncing } = useOfflineQueue();
  const toast = useToast();
  const [items, setItems] = useState<QueuedCapture[]>([]);
  useEffect(() => { listQueued().then(setItems).catch(() => setItems([])); }, [count, syncing]);
  if (!count) return null;

  return (
    <div className="card form-section offline-panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><i className="fa-solid fa-cloud-arrow-up" /> <strong>{count} capture{count === 1 ? '' : 's'} saved on this device</strong>
          <div className="cell-sub">{navigator.onLine ? 'Uploading automatically…' : 'Waiting for a connection — they upload by themselves when you are back online.'}</div></div>
        <button className="btn btn-secondary btn-sm" disabled={syncing || !navigator.onLine}
          onClick={async () => { const m = await syncQueue(); toast(m || 'Nothing uploaded yet', m.includes('attention') ? 'error' : 'info'); }}>
          {syncing ? <><i className="fa-solid fa-spinner fa-spin" /> Uploading…</> : 'Upload now'}
        </button>
      </div>
      <div className="list" style={{ marginTop: 8 }}>
        {items.map(i => (
          <div key={i.id} className="list-row" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{String(i.payload.name || 'Untitled')}</strong>
              <div className="cell-sub">{String(i.payload.type || '')} · {String(i.payload.state || 'no state')} · saved {new Date(i.createdAt).toLocaleString('en-NG')} · {i.files.length} file{i.files.length === 1 ? '' : 's'}{i.assetId ? ` · created as ${i.assetId}` : ''}</div>
              {i.lastError && <div className="cell-sub" style={{ color: 'var(--danger)' }}><i className="fa-solid fa-circle-exclamation" /> {i.lastError}</div>}
            </div>
            <button className="btn btn-ghost btn-xs" title="Discard this saved capture"
              onClick={() => { if (confirm(`Discard the saved capture "${String(i.payload.name || '')}"? It has not been uploaded.`)) removeQueued(i.id); }}>Discard</button>
          </div>
        ))}
      </div>
    </div>
  );
}
