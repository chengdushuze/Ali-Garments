import { jsPDF } from 'jspdf';
import { saveFileToDevice } from './fileSaver';

/**
 * Formats numbers into clean comma-separated currency values (e.g. 15,000)
 */
function formatCurrency(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US');
}

/**
 * Builds a professional, modern PDF Invoice document using jsPDF.
 * 
 * @param {object} invoice 
 * @param {object} settings 
 * @returns {jsPDF}
 */
export function generateInvoicePdf(invoice, settings = {}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);

  const shopName = (settings.shopName || 'ALI GARMENTS').toUpperCase();
  const currency = settings.currency || 'PKR';
  const invoiceNum = invoice.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
  const dateStr = invoice.date || new Date().toISOString().slice(0, 10);
  const items = Array.isArray(invoice.items) ? invoice.items : [];

  let y = margin + 4;

  // 1. Top Decorative Brand Accent Strip
  doc.setFillColor(5, 150, 105); // Emerald-600
  doc.rect(margin, y, contentWidth, 3, 'F');
  y += 8;

  // 2. Company / Shop Header Block (Left) & Invoice Meta (Right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(5, 150, 105);
  doc.text(shopName, margin, y);

  // Invoice Title (Right aligned)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text('INVOICE', pageWidth - margin, y, { align: 'right' });
  y += 6;

  // Subtitle / Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate-500
  const tagline = settings.tagline || 'Wholesale & Retail Garments Master Ledger';
  doc.text(tagline, margin, y);

  // Invoice Number (Right aligned)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Invoice #: ${invoiceNum}`, pageWidth - margin, y, { align: 'right' });
  y += 5;

  // Address
  if (settings.address) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(settings.address, margin, y);
  }

  // Invoice Date (Right aligned)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Date: ${dateStr}`, pageWidth - margin, y, { align: 'right' });
  y += 5;

  // Phone Contact
  if (settings.phone1) {
    const phones = settings.phone2 ? `${settings.phone1} / ${settings.phone2}` : settings.phone1;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Phone: ${phones}`, margin, y);
  }

  // Due Date (Right aligned)
  if (invoice.dueDate) {
    doc.text(`Due Date: ${invoice.dueDate}`, pageWidth - margin, y, { align: 'right' });
  }
  y += 8;

  // Divider Line
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  // 3. Customer Box ("BILLED TO")
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('BILLED TO / CUSTOMER DETAILS:', margin + 4, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.customerName || 'Walk-in Customer', margin + 4, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const custPhone = invoice.customerPhone ? `Phone: ${invoice.customerPhone}` : '';
  const custAddr = invoice.customerAddress ? ` | Address: ${invoice.customerAddress}` : '';
  doc.text(custPhone + custAddr, margin + 4, y + 17);

  y += 28;

  // 4. Line Items Table Header
  const colIndexX = margin;
  const colDescX = margin + 12;
  const colQtyX = margin + 98;
  const colRateX = margin + 130;
  const colTotalX = pageWidth - margin;

  doc.setFillColor(15, 23, 42); // Slate-900 header
  doc.rect(margin, y, contentWidth, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('#', colIndexX + 3, y + 4.8);
  doc.text('ITEM DESCRIPTION', colDescX, y + 4.8);
  doc.text('QTY', colQtyX, y + 4.8, { align: 'center' });
  doc.text(`RATE (${currency})`, colRateX, y + 4.8, { align: 'right' });
  doc.text(`AMOUNT (${currency})`, colTotalX - 3, y + 4.8, { align: 'right' });

  y += 7;

  // Line Items Rows
  items.forEach((item, index) => {
    // Check page overflow
    if (y > pageHeight - 50) {
      doc.addPage();
      y = margin + 10;
    }

    const qty = Number(item.qty || 0);
    const rate = Number(item.rate || 0);
    const total = Number(item.total || qty * rate);

    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, 7, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    doc.text(String(index + 1), colIndexX + 3, y + 4.8);

    const descText = String(item.desc || 'Garment Item');
    const safeDesc = descText.length > 44 ? descText.slice(0, 41) + '...' : descText;
    doc.text(safeDesc, colDescX, y + 4.8);

    doc.text(String(qty), colQtyX, y + 4.8, { align: 'center' });
    doc.text(formatCurrency(rate), colRateX, y + 4.8, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(total), colTotalX - 3, y + 4.8, { align: 'right' });

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 7, pageWidth - margin, y + 7);

    y += 7;
  });

  y += 4;

  // Check page overflow for totals
  if (y > pageHeight - 65) {
    doc.addPage();
    y = margin + 10;
  }

  // 5. Financial Summary Box (Right Aligned)
  const summaryBoxWidth = 75;
  const summaryBoxX = pageWidth - margin - summaryBoxWidth;

  const subtotal = Number(invoice.subtotal || 0);
  const discount = Number(invoice.discount || 0);
  const taxAmount = Number(invoice.taxAmount || 0);
  const grandTotal = Number(invoice.total || 0);

  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Subtotal:', summaryBoxX, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${currency} ${formatCurrency(subtotal)}`, pageWidth - margin - 2, y + 4, { align: 'right' });
  y += 6;

  // Discount
  if (discount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(225, 29, 72); // Rose-600
    doc.text('Discount:', summaryBoxX, y + 4);
    doc.setFont('helvetica', 'bold');
    doc.text(`-${currency} ${formatCurrency(discount)}`, pageWidth - margin - 2, y + 4, { align: 'right' });
    y += 6;
  }

  // Tax
  if (taxAmount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Tax (${invoice.taxPercent || 0}%):`, summaryBoxX, y + 4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${currency} ${formatCurrency(taxAmount)}`, pageWidth - margin - 2, y + 4, { align: 'right' });
    y += 6;
  }

  // Grand Total Highlighted Strip
  doc.setFillColor(5, 150, 105); // Emerald-600
  doc.roundedRect(summaryBoxX - 2, y, summaryBoxWidth + 2, 9, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text('GRAND TOTAL:', summaryBoxX + 2, y + 6);
  doc.text(`${currency} ${formatCurrency(grandTotal)}`, pageWidth - margin - 2, y + 6, { align: 'right' });

  // 6. Notes & Terms (Left Aligned beside totals)
  if (invoice.notes) {
    const notesY = y - (discount > 0 ? 18 : 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('TERMS & NOTES:', margin, notesY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const splitNotes = doc.splitTextToSize(invoice.notes, contentWidth - summaryBoxWidth - 10);
    doc.text(splitNotes, margin, notesY + 4.5);
  }

  y += 24;

  // Check page overflow for footer/signature
  if (y > pageHeight - 35) {
    doc.addPage();
    y = margin + 15;
  }

  // 7. Signature Line & Footer
  const sigX = pageWidth - margin - 45;
  doc.setDrawColor(148, 163, 184); // Slate-400
  doc.setLineWidth(0.3);
  doc.line(sigX, y + 10, pageWidth - margin, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(shopName, sigX + 22.5, y + 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Authorized Signature', sigX + 22.5, y + 18, { align: 'center' });

  // Bottom Center Footer Note
  const footerY = pageHeight - margin + 2;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('This is a computer generated invoice • ALI Garments Management System', pageWidth / 2, footerY, { align: 'center' });

  return doc;
}

/**
 * Generates and downloads the PDF invoice directly to the device.
 * Guaranteed to save to Android Downloads folder or browser downloads without opening print menu!
 * 
 * @param {object} invoice 
 * @param {object} settings 
 * @returns {Promise<{ success: boolean, filename: string, location: string }>}
 */
export async function downloadInvoicePdf(invoice, settings = {}) {
  const doc = generateInvoicePdf(invoice, settings);
  const shopName = settings.shopName || 'ALI GARMENTS';
  const invoiceNum = invoice.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
  const cleanShop = shopName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanInv = String(invoiceNum).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanShop}_Invoice_${cleanInv}.pdf`;

  // Get raw Base64 data from jsPDF
  const dataUri = doc.output('datauristring');
  const base64Data = dataUri.split(',')[1];

  return await saveFileToDevice(filename, base64Data, 'application/pdf');
}
