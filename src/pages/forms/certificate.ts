import type { FormRequest } from '../../api/forms';
import { FORM_LABELS } from './formDefs';

/** Same format the backend falls back to: FPAM/CERT/<year>/<last 6 of id>. */
export const certificateNumberFor = (req: FormRequest) =>
  `FPAM/CERT/${new Date().getFullYear()}/${req._id.slice(-6).toUpperCase()}`;

/**
 * Certificate of compliance, matching the legacy layout. The number is passed
 * in (rather than read from the request) so it is printed on the PDF — the
 * legacy page generated the PDF before the number existed, leaving it blank.
 */
export async function buildCertificatePdf(req: FormRequest, certificateNumber: string, issuedAt = new Date()): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const navy: [number, number, number] = [11, 37, 69];

  doc.setFillColor(...navy);
  doc.rect(0, 0, W, 38, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('FEDERAL MINISTRY OF HOUSING AND URBAN DEVELOPMENT', W / 2, 16, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text('Federal Public Assets Maintenance Department (FPAM)', W / 2, 24, { align: 'center' });
  doc.setDrawColor(74, 144, 217); doc.setLineWidth(0.8);
  doc.line(W / 2 - 35, 29, W / 2 + 35, 29);
  doc.setFontSize(9);
  doc.text('CERTIFICATE OF COMPLIANCE', W / 2, 34, { align: 'center' });

  doc.setTextColor(11, 24, 41);
  let y = 55;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text('Certificate of Certification', W / 2, y, { align: 'center' });
  y += 14;
  const lines: [string, 'mda' | 'body'][] = [
    ['This is to certify that', 'body'], ['', 'body'], [req.mda, 'mda'], ['', 'body'],
    ['has been reviewed by the Federal Public Assets Maintenance Department (FPAM) in respect of', 'body'],
    [FORM_LABELS[req.formType] || req.formType, 'body'], ['', 'body'],
    ['and has been found to be in compliance with the National Public Buildings Maintenance Policy', 'body'],
    ['(NPBMP) and the provisions of Executive Order No. 11.', 'body'],
  ];
  for (const [text, kind] of lines) {
    if (kind === 'mda') { doc.setFont('helvetica', 'bold'); doc.setFontSize(15); }
    else { doc.setFont('helvetica', 'normal'); doc.setFontSize(11.5); }
    if (text) doc.text(text, W / 2, y, { align: 'center', maxWidth: 160 });
    y += text ? 8 : 4;
  }
  y += 14;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(`Certificate No: ${certificateNumber}`, 30, y);
  doc.text(`Date Issued: ${issuedAt.toLocaleDateString('en-NG')}`, W - 30, y, { align: 'right' });
  y += 30;
  doc.line(30, y, 90, y); doc.line(W - 90, y, W - 30, y);
  y += 5; doc.setFontSize(9);
  doc.text('FPAM Director / Head of Certification', 60, y, { align: 'center' });
  doc.text('Official Stamp / Seal', W - 60, y, { align: 'center' });
  return doc.output('blob');
}
