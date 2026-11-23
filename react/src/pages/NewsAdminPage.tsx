import { useCallback, useEffect, useRef, useState } from 'react';
import * as siteApi from '../api/publicSite';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Modal from '../components/Modal';
import { Tag } from '../components/Tags';
import { useToast } from '../components/Toast';
import AuthedImage from '../components/AuthedImage';
import { formatDate, timeAgo } from '../lib/assets';
import type { NewsItem } from '../api/publicSite';

// Write and publish news for the public website: news.html and the
// "Latest News" ticker on every public page read from here.

export default function NewsAdminPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [list, setList] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<NewsItem | 'new' | null>(null);
  const allowed = siteApi.NEWS_ROLES.includes(user?.role || '');

  const load = useCallback(async () => {
    try { setList((await siteApi.listNews()).news); setError(''); } catch (err) { setError(errorMessage(err)); }
  }, []);
  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  if (!allowed) return <div className="page"><div className="card empty-state"><div className="empty-title">News is managed by System Admins and Supervisors</div></div></div>;

  const togglePublish = async (n: NewsItem) => {
    try { await siteApi.updateNews(n._id, { status: n.status === 'published' ? 'draft' : 'published' }); toast(n.status === 'published' ? 'Unpublished' : 'Published on the website'); load(); }
    catch (err) { toast(errorMessage(err), 'error'); }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div><h1 className="page-title">News</h1><div className="page-sub">Articles for the public website's News page and the "Latest News" ticker</div></div>
        <div className="row">
          <a className="btn btn-ghost btn-sm" href="/news.html" target="_blank" rel="noreferrer"><i className="fa-solid fa-arrow-up-right-from-square" /> View news page</a>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><i className="fa-solid fa-plus" /> New article</button>
        </div>
      </header>
      <div className="card table-wrap">
        {list === null ? <div className="loading">{error || <><i className="fa-solid fa-spinner fa-spin" /> Loading…</>}</div>
          : list.length === 0 ? <div className="empty-state"><div className="empty-icon"><i className="fa-solid fa-newspaper" /></div><div className="empty-title">No articles yet</div>
              <div className="empty-sub">Write the first one. It stays a draft until you publish it.</div></div> : (
          <table className="data-table">
            <thead><tr><th style={{ width: 70 }} /><th>Article</th><th>Category</th><th>Status</th><th>Updated</th><th /></tr></thead>
            <tbody>{list.map(n => (
              <tr key={n._id} className="row-link" onClick={e => { if (!(e.target as HTMLElement).closest('button')) setEditing(n); }}>
                <td>{n.coverUrl ? <span className="news-thumb"><AuthedImage key={n.coverUrl} path={`/news/manage/${n._id}/cover`} alt="" /></span> : <span className="news-thumb news-thumb-empty"><i className="fa-solid fa-image" /></span>}</td>
                <td><strong>{n.title}</strong><div className="cell-sub">{n.summary || '—'}</div></td>
                <td>{n.category}</td>
                <td>{n.status === 'published'
                  ? <><Tag tone="green">Published</Tag><div className="cell-sub">{formatDate(n.publishedAt)}{n.inTicker ? ' · in ticker' : ''}</div></>
                  : <Tag tone="gray">Draft</Tag>}</td>
                <td title={formatDate(n.updatedAt)}>{timeAgo(n.updatedAt)}</td>
                <td><button className="btn btn-secondary btn-xs" onClick={() => togglePublish(n)}>{n.status === 'published' ? 'Unpublish' : 'Publish'}</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {editing && <NewsEditor item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { load(); }} onDeleted={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function NewsEditor({ item, onClose, onSaved, onDeleted }: { item: NewsItem | null; onClose: () => void; onSaved: () => void; onDeleted: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState<NewsItem | null>(item);
  const [f, setF] = useState({
    title: item?.title || '', category: item?.category || 'Press Release', summary: item?.summary || '', body: item?.body || '',
    byline: item?.byline || '', coverCaption: item?.cover?.caption || '', inTicker: item ? item.inTicker : true,
  });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }));

  /** Saves the text; returns the saved article (creating it first if new). */
  const save = async (status?: 'published' | 'draft') => {
    if (!f.title.trim()) { toast('Give the article a title', 'error'); return null; }
    setBusy(true);
    try {
      const body = { ...f, ...(status ? { status } : {}) };
      const { news } = current ? await siteApi.updateNews(current._id, body) : await siteApi.createNews(body);
      setCurrent(news);
      onSaved();
      toast(status === 'published' ? 'Published on the website' : status === 'draft' ? 'Moved back to draft' : 'Saved');
      return news;
    } catch (err) { toast(errorMessage(err), 'error'); return null; }
    finally { setBusy(false); }
  };
  const pickCover = async (file: File | undefined) => {
    if (!file) return;
    const target = current || await save();
    if (!target) return;
    setBusy(true);
    try { setCurrent((await siteApi.uploadCover(target._id, file)).news); onSaved(); toast('Cover image added'); }
    catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(false); }
  };
  const dropCover = async () => {
    if (!current) return;
    try { setCurrent((await siteApi.removeCover(current._id)).news); onSaved(); } catch (err) { toast(errorMessage(err), 'error'); }
  };
  const remove = async () => {
    if (!current || !confirm('Delete this article? This cannot be undone.')) return;
    try { await siteApi.deleteNews(current._id); toast('Deleted'); onDeleted(); } catch (err) { toast(errorMessage(err), 'error'); }
  };
  const published = current?.status === 'published';

  return (
    <Modal wide title={current ? 'Edit article' : 'New article'} onClose={onClose}
      footer={<>
        {current && <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={remove}><i className="fa-solid fa-trash" /> Delete</button>}
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
        {published
          ? <button className="btn btn-secondary" disabled={busy} onClick={() => save('draft')}>Unpublish</button>
          : <button className="btn btn-secondary" disabled={busy} onClick={() => save()}>Save draft</button>}
        <button className="btn btn-primary" disabled={busy} onClick={() => save(published ? undefined : 'published')}>
          <i className="fa-solid fa-globe" /> {published ? 'Save changes' : 'Publish'}
        </button>
      </>}>
      {current && <div className="row" style={{ marginBottom: 10 }}>{published ? <Tag tone="green">Published {formatDate(current.publishedAt)}</Tag> : <Tag tone="gray">Draft: not on the website</Tag>}</div>}
      <div className="form-grid">
        <div className="full"><label className="form-label">Headline *</label><input className="form-control" value={f.title} onChange={set('title')} maxLength={200} /></div>
        <div><label className="form-label">Category</label><select className="form-control" value={f.category} onChange={set('category')}>{siteApi.NEWS_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label className="form-label">Byline</label><input className="form-control" value={f.byline} onChange={set('byline')} maxLength={200} placeholder="e.g. Director, Press & Public Relations" /></div>
        <div className="full"><label className="form-label">Summary (shown on the news list, max 400 characters)</label>
          <textarea className="form-control" style={{ minHeight: 60 }} value={f.summary} onChange={set('summary')} maxLength={400} /></div>
        <div className="full"><label className="form-label">Article</label>
          <textarea className="form-control news-body" value={f.body} onChange={set('body')} maxLength={30000}
            placeholder={'Leave a blank line between paragraphs.\n\n## A line starting with ## is a heading\n\n> A line starting with > is a quote'} />
          <div className="cell-sub">Blank line = new paragraph · <code>## </code> heading · <code>&gt; </code> quote</div></div>
        <div className="full"><label className="form-label">Cover image</label>
          <div className="row">
            {current?.coverUrl && <span className="news-cover-preview"><AuthedImage key={current.coverUrl} path={`/news/manage/${current._id}/cover`} alt="" /></span>}
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}><i className="fa-solid fa-image" /> {current?.coverUrl ? 'Replace image' : 'Add image'}</button>
            {current?.coverUrl && <button type="button" className="btn btn-ghost btn-sm" onClick={dropCover}>Remove</button>}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { pickCover(e.target.files?.[0]); e.target.value = ''; }} />
          </div></div>
        <div className="full"><label className="form-label">Image caption</label><input className="form-control" value={f.coverCaption} onChange={set('coverCaption')} maxLength={200} /></div>
        <div className="full"><label className="check-label"><input type="checkbox" checked={f.inTicker} onChange={e => setF(p => ({ ...p, inTicker: e.target.checked }))} /> Show the headline in the "Latest News" ticker</label></div>
      </div>
    </Modal>
  );
}
