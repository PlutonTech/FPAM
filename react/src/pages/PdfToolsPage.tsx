import { useRef, useState } from 'react';
import { useToast } from '../components/Toast';

// Image → PDF and PDF merging, entirely in the browser (nothing is uploaded).
// Replaces the old dashboard's "Image to PDF" tool and adds merging of
// existing PDFs: add images and/or PDFs, drag to reorder, download one PDF.

type Item = { id: string; file: File; kind: 'image' | 'pdf'; thumb?: string; pages?: number };
const MM = 72 / 25.4;                                  // PDF points per millimetre
const SIZES = { a4: [210, 297], letter: [215.9, 279.4] } as const;
const MARGIN = 8;

let seq = 0;

export default function PdfToolsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [pageSize, setPageSize] = useState<'a4' | 'letter' | 'fit'>('a4');
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const [filename, setFilename] = useState('merged-document.pdf');
  const [busy, setBusy] = useState('');
  const [drag, setDrag] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const add = async (files: FileList | null) => {
    if (!files) return;
    const next: Item[] = [];
    for (const file of Array.from(files)) {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (!isPdf && !file.type.startsWith('image/')) { toast(`${file.name} is not an image or PDF`, 'error'); continue; }
      const item: Item = { id: `f${++seq}`, file, kind: isPdf ? 'pdf' : 'image' };
      if (isPdf) {
        try {
          const { PDFDocument } = await import('pdf-lib');
          item.pages = (await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })).getPageCount();
        } catch { toast(`${file.name} could not be read as a PDF`, 'error'); continue; }
      } else item.thumb = URL.createObjectURL(file);
      next.push(item);
    }
    setItems(list => [...list, ...next]);
  };
  const remove = (id: string) => setItems(list => {
    const it = list.find(i => i.id === id);
    if (it?.thumb) URL.revokeObjectURL(it.thumb);
    return list.filter(i => i.id !== id);
  });
  const move = (from: number, to: number) => setItems(list => {
    const copy = [...list];
    const [it] = copy.splice(from, 1);
    copy.splice(to, 0, it);
    return copy;
  });

  const build = async () => {
    if (!items.length) return;
    setBusy('Building PDF…');
    try {
      const { PDFDocument } = await import('pdf-lib');
      const out = await PDFDocument.create();
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        setBusy(`Adding ${i + 1} of ${items.length}…`);
        if (it.kind === 'pdf') {
          const src = await PDFDocument.load(await it.file.arrayBuffer(), { ignoreEncryption: true });
          (await out.copyPages(src, src.getPageIndices())).forEach(p => out.addPage(p));
          continue;
        }
        const { bytes, png, width, height } = await imageBytes(it.file);
        const img = png ? await out.embedPng(bytes) : await out.embedJpg(bytes);
        const landscape = width >= height;
        let pw: number, ph: number;
        if (pageSize === 'fit') { pw = landscape ? 297 : 210; ph = pw * (height / width); }
        else {
          const [a, b] = SIZES[pageSize];
          const land = orientation === 'auto' ? landscape : orientation === 'landscape';
          pw = land ? b : a; ph = land ? a : b;
        }
        const page = out.addPage([pw * MM, ph * MM]);
        const ratio = width / height;
        let w: number, h: number;
        if (fit === 'cover' || pageSize === 'fit') {
          if (ratio > pw / ph) { h = ph; w = h * ratio; } else { w = pw; h = w / ratio; }
        } else {
          const aw = pw - MARGIN * 2, ah = ph - MARGIN * 2;
          if (ratio > aw / ah) { w = aw; h = w / ratio; } else { h = ah; w = h * ratio; }
        }
        page.drawImage(img, { x: ((pw - w) / 2) * MM, y: ((ph - h) / 2) * MM, width: w * MM, height: h * MM });
      }
      setBusy('Saving…');
      const blob = new Blob([new Uint8Array(await out.save())], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = /\.pdf$/i.test(filename.trim()) ? filename.trim() : `${filename.trim() || 'merged-document'}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`PDF created: ${out.getPageCount()} page${out.getPageCount() === 1 ? '' : 's'}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not build the PDF', 'error');
    } finally { setBusy(''); }
  };

  const totalPages = items.reduce((n, i) => n + (i.kind === 'pdf' ? i.pages || 0 : 1), 0);
  const hasImages = items.some(i => i.kind === 'image');

  return (
    <div className="page">
      <header className="page-header">
        <div><h1 className="page-title">PDF tools</h1><div className="page-sub">Turn photos and scans into a PDF, or merge PDFs into one. Files stay on this computer: nothing is uploaded.</div></div>
      </header>
      <div className="pdf-tools">
        <div>
          <div className={`card pdf-drop${busy ? ' disabled' : ''}`} onClick={() => input.current?.click()}
               onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); add(e.dataTransfer.files); }}>
            <i className="fa-solid fa-cloud-arrow-up" />
            <div><strong>Add images or PDFs</strong></div>
            <div className="cell-sub">Click to choose, or drop files here. JPG, PNG, WebP and PDF.</div>
            <input ref={input} type="file" multiple accept="image/*,application/pdf" hidden onChange={e => { add(e.target.files); e.target.value = ''; }} />
          </div>
          <div className="card" style={{ marginTop: 14, padding: 16 }}>
            <div className="form-grid">
              <div><label className="form-label">Page size (images)</label>
                <select className="form-control" value={pageSize} onChange={e => setPageSize(e.target.value as typeof pageSize)} disabled={!hasImages}>
                  <option value="a4">A4</option><option value="letter">Letter</option><option value="fit">Fit to image</option></select></div>
              <div><label className="form-label">Orientation</label>
                <select className="form-control" value={orientation} onChange={e => setOrientation(e.target.value as typeof orientation)} disabled={!hasImages || pageSize === 'fit'}>
                  <option value="auto">Auto (match each image)</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div>
              <div><label className="form-label">Image fit</label>
                <select className="form-control" value={fit} onChange={e => setFit(e.target.value as typeof fit)} disabled={!hasImages || pageSize === 'fit'}>
                  <option value="contain">Fit within page (with margin)</option><option value="cover">Fill entire page</option></select></div>
              <div><label className="form-label">File name</label><input className="form-control" value={filename} onChange={e => setFilename(e.target.value)} /></div>
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn btn-primary" disabled={!items.length || !!busy} onClick={build}>
                {busy ? <><i className="fa-solid fa-spinner fa-spin" /> {busy}</> : <><i className="fa-solid fa-file-pdf" /> Create PDF</>}
              </button>
              {items.length > 0 && <button className="btn btn-ghost" disabled={!!busy} onClick={() => { items.forEach(i => i.thumb && URL.revokeObjectURL(i.thumb)); setItems([]); }}>Clear all</button>}
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="card-title" style={{ marginBottom: 10 }}><i className="fa-solid fa-layer-group" /> Page order
            <span className="tag tag-gray">{items.length} file{items.length === 1 ? '' : 's'} · {totalPages} page{totalPages === 1 ? '' : 's'}</span></div>
          {items.length === 0 ? <div className="cell-sub">Files you add appear here. Drag them to change the order.</div> : (
            <ol className="pdf-list">
              {items.map((it, i) => (
                <li key={it.id} draggable onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)}
                    onDragOver={e => e.preventDefault()} onDrop={() => { if (drag !== null && drag !== i) move(drag, i); setDrag(null); }}
                    className={drag === i ? 'dragging' : ''}>
                  <span className="pdf-num">{i + 1}</span>
                  {it.thumb ? <img src={it.thumb} alt="" /> : <span className="pdf-icon"><i className="fa-solid fa-file-pdf" /></span>}
                  <span className="pdf-name"><span>{it.file.name}</span><span className="cell-sub">{it.kind === 'pdf' ? `PDF · ${it.pages} page${it.pages === 1 ? '' : 's'}` : 'Image · 1 page'}</span></span>
                  <span className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
                    <button className="btn btn-ghost btn-xs" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move up"><i className="fa-solid fa-arrow-up" /></button>
                    <button className="btn btn-ghost btn-xs" disabled={i === items.length - 1} onClick={() => move(i, i + 1)} aria-label="Move down"><i className="fa-solid fa-arrow-down" /></button>
                    <button className="btn btn-ghost btn-xs" onClick={() => remove(it.id)} aria-label="Remove"><i className="fa-solid fa-xmark" /></button>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

/** JPG and PNG go in as they are; other image types are converted to JPEG first. */
async function imageBytes(file: File): Promise<{ bytes: ArrayBuffer; png: boolean; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const { width, height } = bmp;
  if (file.type === 'image/jpeg' || file.type === 'image/png') {
    bmp.close();
    return { bytes: await file.arrayBuffer(), png: file.type === 'image/png', width, height };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('Could not convert image'))), 'image/jpeg', 0.92));
  return { bytes: await blob.arrayBuffer(), png: false, width, height };
}
