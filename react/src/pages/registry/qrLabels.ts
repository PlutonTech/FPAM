import type { Asset } from '../../types';
import { BASENAME } from '../../config';
import { assetKey } from '../../lib/assets';

/** The URL a printed label points at: /a/<id> decides staff vs public view. */
export function scanUrl(id: string): string {
  return `${window.location.origin}${BASENAME}/a/${encodeURIComponent(id)}`;
}

// A4 sheet of 21 labels, 63.5 × 38.1 mm (the common 3 × 7 "L7160" layout),
// so the PDF prints straight onto standard label stock — or plain paper to cut.
const COLS = 3, ROWS = 7;
const W = 63.5, H = 38.1, LEFT = 7.25, TOP = 15.15, GAP_X = 2.54;
const QR = 27, PAD = 3.5;
// Text block: everything above this line is free; the ID and footer sit below it.
const TEXT_BOTTOM = H - 10.5;

/** Builds and downloads a PDF of QR labels, one per asset. */
export async function downloadQrLabels(assets: Asset[]) {
  const doc = await buildQrLabels(assets);
  doc.save(`fpam-qr-labels-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** The label sheet as a jsPDF document (pages of 21). */
export async function buildQrLabels(assets: Asset[]) {
  const [{ jsPDF }, { default: QRCode }] = await Promise.all([import('jspdf'), import('qrcode')]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  for (let i = 0; i < assets.length; i++) {
    const slot = i % (COLS * ROWS);
    if (i > 0 && slot === 0) doc.addPage();
    const a = assets[i];
    const id = assetKey(a);
    const x = LEFT + (slot % COLS) * (W + GAP_X);
    const y = TOP + Math.floor(slot / COLS) * H;

    // Faint cut guide for plain paper.
    doc.setDrawColor(220); doc.setLineWidth(0.1);
    doc.roundedRect(x, y, W, H, 2, 2);

    // Drawn as vector squares: sharp at any print size and a few KB per label.
    const { modules } = QRCode.create(scanUrl(id), { errorCorrectionLevel: 'M' });
    const cell = QR / modules.size, qx = x + PAD, qy = y + (H - QR) / 2;
    doc.setFillColor(0, 0, 0);
    for (let r = 0; r < modules.size; r++) {
      for (let c = 0; c < modules.size; c++) {
        // Runs of dark cells in a row become one rectangle.
        if (!modules.get(r, c)) continue;
        let end = c;
        while (end + 1 < modules.size && modules.get(r, end + 1)) end++;
        doc.rect(qx + c * cell, qy + r * cell, (end - c + 1) * cell, cell, 'F');
        c = end;
      }
    }

    const tx = x + PAD + QR + 2.5, tw = W - (tx - x) - 2.5;
    const limit = y + TEXT_BOTTOM;
    let ty = y + 6;
    // Writes lines one by one, stopping before they'd run into the ID below.
    const put = (lines: string[], step: number) => {
      for (const l of lines) { if (ty > limit) return; doc.text(l, tx, ty); ty += step; }
    };
    doc.setTextColor(120); doc.setFont('helvetica', 'bold'); doc.setFontSize(5);
    put(['FEDERAL GOVERNMENT', 'PROPERTY'], 2.2);
    ty += 1.6;
    doc.setTextColor(11, 24, 41); doc.setFontSize(7);
    put((doc.splitTextToSize(a.name || 'Unnamed asset', tw) as string[]).slice(0, 3), 2.9);
    ty += 0.6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5);
    if (a.mda) put((doc.splitTextToSize(a.mda, tw) as string[]).slice(0, 2), 2.3);
    const place = [a.lga, a.state].filter(Boolean).join(', ');
    if (place) put([doc.splitTextToSize(place, tw)[0] as string], 2.3);
    doc.setFont('courier', 'bold'); doc.setFontSize(6.5);
    doc.text(String(id), tx, y + H - 8, { maxWidth: tw });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(120);
    doc.text('Scan to report a problem', tx, y + H - 4.5, { maxWidth: tw });
  }

  return doc;
}
