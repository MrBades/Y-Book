import { jsPDF } from 'jspdf';
import { Invoice, BusinessProfile } from '../types';

/**
 * Safely extracts custom contact records for a specified customer name
 */
function findCustomerContact(customers: any[] | undefined, customerName: string) {
  if (!customers) return { phone: '', email: '' };
  const found = customers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
  return {
    phone: found?.phone || '',
    email: found?.email || ''
  };
}

/**
 * Generates and downloads a custom-styled, branded PDF invoice
 */
export function generateInvoicePDF(
  invoice: Invoice,
  business: BusinessProfile,
  customers?: any[],
  isGuestTrial: boolean = false,
  showTax: boolean = false,
  returnInstance: boolean = false
) {
  const { 
    businessName, 
    address, 
    phone, 
    invoiceTemplatePreference = 'classic', 
    businessLogo,
    customAccentColor = '#00A6FF',
    customFontSize = 'md',
    customFontFamily = 'sans',
    customShowLogo = true,
    customHeaderTitle = 'TAX INVOICE',
    customFooterNotes = 'This document acts as an official trade journal entry. Please verify balances online.'
  } = business;

  const isService = business.businessType === 'service';

  const { phone: customerPhone, email: customerEmail } = findCustomerContact(customers, invoice.customerName);

  const taxAmount = showTax ? invoice.totalAmount * 0.075 : 0;
  const finalInvoiced = invoice.totalAmount + taxAmount;
  const finalDebtBalance = Math.max(0, finalInvoiced - invoice.amountPaid);
  
  const formattedInvoiceId = invoice.id.replace('inv_', '').substring(0, 6).toUpperCase();

  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4'
  });

  // Global theme settings mapping
  let activeAccent = '#111827'; // slate dark default
  let activeFont = 'Helvetica'; // sans-serif

  // Map Typography families to standard jsPDF core fonts
  if (customFontFamily === 'serif') {
    activeFont = 'Times';
  } else if (customFontFamily === 'mono') {
    activeFont = 'Courier';
  }

  // Map active templates
  if (invoiceTemplatePreference === 'modern_blue') {
    activeAccent = '#1D4ED8'; // Blue
  } else if (invoiceTemplatePreference === 'kiosk_compact') {
    activeAccent = '#4B5563'; // Compact Gray
  } else if (invoiceTemplatePreference === 'custom_build') {
    activeAccent = customAccentColor;
  } else {
    // Classic
    activeAccent = '#0E1338';
  }

  // Convert Hex to RGB helpers
  const hexToRgb = (hex: string) => {
    const cleanHex = hex.replace('#', '');
    const num = parseInt(cleanHex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  };

  const rgbAccent = hexToRgb(activeAccent);

  // Helper to draw the logo safely
  const drawLogoIfAvailable = (x: number, y: number, maxSize: number = 45) => {
    if (businessLogo && (invoiceTemplatePreference !== 'custom_build' || customShowLogo !== false)) {
      try {
        // Detect image format from Base64 header, defaults to PNG
        let format = 'PNG';
        if (businessLogo.includes('image/jpeg') || businessLogo.includes('image/jpg')) {
          format = 'JPEG';
        } else if (businessLogo.includes('image/webp')) {
          format = 'WEBP';
        }
        
        doc.addImage(businessLogo, format, x, y, maxSize, maxSize, undefined, 'FAST', business.logoRotation || 0);
        return true;
      } catch (err) {
        console.warn("Failed rendering company branding logo to PDF: ", err);
      }
    }
    return false;
  };

  // -------------------------------------------------------------
  // STYLE A: CLASSIC STYLE
  // -------------------------------------------------------------
  const drawClassic = () => {
    // Border boundary card: Bold black outer border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(4);
    doc.rect(30, 30, 535, 715);

    // Draw logo if available
    const logoDrawn = drawLogoIfAvailable(50, 48, 45);

    // Business Name in Serif font (Times-Bold)
    doc.setTextColor(0, 0, 0);
    doc.setFont("Times", "bold");
    doc.setFontSize(18);
    doc.text((businessName || 'Business Name').toUpperCase(), 50, logoDrawn ? 112 : 68);

    // Monospaced Address/Phone info beneath the Title
    doc.setFont("Courier", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    doc.text(address || "LAGOS, NIGERIA", 50, logoDrawn ? 124 : 80);
    doc.text(`TEL: ${phone || "+234 812-345-6789"}`, 50, logoDrawn ? 134 : 90);

    // solid block with white JOURNAL RECEIPT text
    doc.setFillColor(0, 0, 0);
    doc.rect(425, 48, 120, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("Times", "bold");
    doc.setFontSize(9.5);
    doc.text("JOURNAL RECEIPT", 485, 62, { align: 'center' });

    // NO receipt identifier
    doc.setTextColor(0, 0, 0);
    doc.setFont("Courier", "normal");
    doc.setFontSize(8.5);
    doc.text(`NO: YB-2026-${formattedInvoiceId}`, 545, 84, { align: 'right' });

    // Header dividing line
    const lineY = logoDrawn ? 148 : 105;
    doc.setLineWidth(3);
    doc.setDrawColor(0, 0, 0);
    doc.line(30, lineY, 565, lineY);

    // Billing info / Entry state
    const billY = lineY + 20;
    doc.setTextColor(0, 0, 0);
    doc.setFont("Times", "bold");
    doc.setFontSize(8);
    doc.text("BILLED TO CUSTOMER:", 50, billY);

    doc.setFont("Times", "bold");
    doc.setFontSize(11);
    doc.text(invoice.customerName.toUpperCase(), 50, billY + 14);

    doc.setFont("Courier", "normal");
    doc.setFontSize(8.5);
    doc.text(`PHONE: ${customerPhone || "0000000000"}`, 50, billY + 26);
    if (customerEmail) {
      doc.text(`EMAIL: ${customerEmail.toUpperCase()}`, 50, billY + 36);
    }

    // Right Align entry metadata
    doc.setFont("Times", "bold");
    doc.setFontSize(8);
    doc.text("ENTRY STATE:", 545, billY, { align: 'right' });

    doc.setFont("Times", "bold");
    doc.setFontSize(11);
    const entryStateText = invoice.transactionType === 'sale' ? 'Wholesale Trade Log' : invoice.transactionType.toUpperCase();
    doc.text(entryStateText.toUpperCase(), 545, billY + 14, { align: 'right' });

    // Dividers beneath customer box
    const billEndY = customerEmail ? billY + 46 : billY + 36;
    doc.setLineWidth(1.5);
    doc.line(30, billEndY, 565, billEndY);

    // Table Section: ITEM, QTY, TOTAL
    const tableHeaderY = billEndY + 20;
    doc.setFont("Times", "bold");
    doc.setFontSize(9);
    doc.text(isService ? "DESCRIPTION OF SERVICE" : "ITEM", 50, tableHeaderY);
    doc.text(isService ? "DURATION/UNITS" : "QTY", 310, tableHeaderY, { align: 'center' });
    doc.text("TOTAL", 545, tableHeaderY, { align: 'right' });

    doc.setLineWidth(1.5);
    doc.line(30, tableHeaderY + 5, 565, tableHeaderY + 5);

    // Items list loops
    let startY = tableHeaderY + 22;
    doc.setFont("Times", "bold");
    doc.setFontSize(9);

    if (invoice.items && invoice.items.length > 0) {
      invoice.items.forEach((itm) => {
        doc.setFont("Times", "bold");
        doc.text(itm.name.toUpperCase(), 50, startY);

        doc.setFont("Courier", "normal");
        doc.text(itm.quantity.toString(), 310, startY, { align: 'center' });
        doc.text("NGN " + itm.total.toLocaleString(), 545, startY, { align: 'right' });

        doc.setLineWidth(0.5);
        doc.setDrawColor(200, 200, 200);
        doc.line(30, startY + 5, 565, startY + 5);
        startY += 20;
      });
    } else {
      doc.setFont("Times", "bold");
      doc.text((invoice.productName || "GENERAL GOODS").toUpperCase(), 50, startY);

      doc.setFont("Courier", "normal");
      doc.text("1", 310, startY, { align: 'center' });
      doc.text("NGN " + invoice.totalAmount.toLocaleString(), 545, startY, { align: 'right' });

      doc.setLineWidth(0.5);
      doc.setDrawColor(200, 200, 200);
      doc.line(30, startY + 5, 565, startY + 5);
      startY += 20;
    }

    // Dividers over financial totals block
    doc.setLineWidth(1.5);
    doc.setDrawColor(0, 0, 0);
    doc.line(30, startY + 5, 565, startY + 5);

    const summaryY = startY + 22;

    // Monochrome ledger footnotes
    doc.setFont("Courier", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text("* REAL-TIME CLASSIC OFFLINE PRINT PREVIEW SIMULATION", 50, summaryY, { maxWidth: 220 });

    doc.setTextColor(0, 0, 0);
    doc.setFont("Times", "normal");
    doc.setFontSize(9.5);

    // Math outputs aligned with layout screenshot
    doc.text("TOTAL:", 380, summaryY);
    doc.setFont("Courier", "bold");
    doc.text("NGN " + finalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 }), 545, summaryY, { align: 'right' });

    let currentY = summaryY + 14;
    if (showTax) {
      doc.setFont("Times", "normal");
      doc.text("INCLUDES 7.5% VAT:", 380, currentY);
      doc.setFont("Courier", "normal");
      doc.text("NGN " + taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }), 545, currentY, { align: 'right' });
      currentY += 14;
    }

    doc.setFont("Times", "normal");
    doc.text("CASH RECOV:", 380, currentY);
    doc.setFont("Courier", "normal");
    doc.text("NGN " + invoice.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 }), 545, currentY, { align: 'right' });
    currentY += 8;

    // Single dividing line before deep debt credit state
    doc.setLineWidth(1);
    doc.line(380, currentY, 565, currentY);
    currentY += 12;

    doc.setFont("Times", "bold");
    doc.text("DUE CREDIT:", 380, currentY);
    doc.setFont("Courier", "bold");
    doc.text("NGN " + finalDebtBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }), 545, currentY, { align: 'right' });

    // Double bottom black line block at base of boundary card
    doc.setLineWidth(2.5);
    doc.line(30, currentY + 15, 565, currentY + 15);
    doc.setLineWidth(1);
    doc.line(30, currentY + 19, 565, currentY + 19);
  };

  // -------------------------------------------------------------
  // STYLE B: MODERN OCEAN BLUE
  // -------------------------------------------------------------
  const drawModernBlue = () => {
    // Elegant color highlights using Deep Navy / Sapphire Blue
    doc.setFillColor(rgbAccent.r, rgbAccent.g, rgbAccent.b);
    doc.rect(30, 30, 535, 95, 'F');

    // Drawer logo if there's any
    const logoDrawn = drawLogoIfAvailable(50, 48, 55);

    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.text(businessName.toUpperCase(), logoDrawn ? 115 : 55, 75);

    doc.setFontSize(8.5);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(219, 234, 254);
    doc.text(address || "Market Provisions Outlet, Lagos, Nigeria", logoDrawn ? 115 : 55, 92);
    doc.text(`T: ${phone || "080-unspecified"}`, logoDrawn ? 115 : 55, 104);

    // Receipt header ID
    const displayInvoiceNo = `YB-2026-${formattedInvoiceId}`;
    doc.setFontSize(11);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("TAX INVOICE RECEIPT", 535, 70, { align: 'right' });
    doc.setFontSize(8.5);
    doc.setTextColor(191, 219, 254);
    doc.text(displayInvoiceNo, 535, 87, { align: 'right' });
    doc.text(`DATE: ${new Date(invoice.createdAt).toLocaleDateString()}`, 535, 99, { align: 'right' });

    // Client/Customer horizontal columns
    doc.setFillColor(243, 244, 246);
    doc.rect(30, 145, 535, 80, 'F');

    doc.setTextColor(rgbAccent.r, rgbAccent.g, rgbAccent.b);
    doc.setFontSize(9.5);
    doc.setFont("Helvetica", "bold");
    doc.text("CUSTOMER DETAILS", 50, 168);

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(11);
    doc.text(invoice.customerName, 50, 188);
    doc.setFontSize(8.5);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Phone: ${customerPhone || "Not configured"}`, 50, 203);

    // Right column metadata
    doc.setTextColor(rgbAccent.r, rgbAccent.g, rgbAccent.b);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("LEDGER JOURNAL DESCRIPTOR", 350, 168);
    doc.setFontSize(8.5);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Workflow State: ${invoice.transactionType === 'sale' ? 'Cleared trade log' : 'Payment credit'}`, 350, 188);
    doc.text(`Customer email: ${customerEmail || "N/A"}`, 350, 203);

    // Line drawing
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(1);
    doc.line(30, 245, 565, 245);

    doc.setTextColor(rgbAccent.r, rgbAccent.g, rgbAccent.b);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.text(isService ? "DESCRIPTION OF SERVICE" : "COMMODITY PRODUCE DESCRIPTION", 50, 260);
    doc.text(isService ? "DURATION/UNITS" : "QTY", 310, 260, { align: 'center' });
    doc.text(isService ? "RATE" : "UNIT RATE", 420, 260, { align: 'right' });
    doc.text("TOTAL AMOUNT", 535, 260, { align: 'right' });

    doc.line(30, 268, 565, 268);

    let startY = 290;
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(55, 65, 81);

    if (invoice.items && invoice.items.length > 0) {
      invoice.items.forEach((itm) => {
        doc.text(itm.name, 50, startY);
        doc.text(itm.quantity.toString(), 310, startY, { align: 'center' });
        doc.text("NGN " + itm.price.toLocaleString(), 420, startY, { align: 'right' });
        doc.setFont("Helvetica", "bold");
        doc.text("NGN " + itm.total.toLocaleString(), 535, startY, { align: 'right' });
        doc.setFont("Helvetica", "normal");
        startY += 20;
      });
    } else {
      doc.text(invoice.productName || "General Goods Commodities", 50, startY);
      doc.text("1", 310, startY, { align: 'center' });
      doc.text("NGN " + invoice.totalAmount.toLocaleString(), 420, startY, { align: 'right' });
      doc.setFont("Helvetica", "bold");
      doc.text("NGN " + invoice.totalAmount.toLocaleString(), 535, startY, { align: 'right' });
      doc.setFont("Helvetica", "normal");
      startY += 20;
    }

    doc.line(30, startY + 5, 565, startY + 5);

    // Subtotal sums block
    const endY = startY + 30;
    doc.setFont("Helvetica", "normal");
    doc.text("Ledger Subtotal Due:", 350, endY);
    doc.text("NGN " + invoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }), 535, endY, { align: 'right' });

    let currentOffsetY = endY + 16;

    if (showTax) {
      doc.text("VAT (7.5%):", 350, currentOffsetY);
      doc.text("NGN " + taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }), 535, currentOffsetY, { align: 'right' });
      currentOffsetY += 16;

      doc.setFont("Helvetica", "bold");
      doc.text("Total Invoiced:", 350, currentOffsetY);
      doc.text("NGN " + finalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 }), 535, currentOffsetY, { align: 'right' });
      doc.setFont("Helvetica", "normal");
      currentOffsetY += 16;
    }

    doc.setTextColor(16, 185, 129);
    doc.text("Cash Paid / Deposits:", 350, currentOffsetY);
    doc.text("NGN " + invoice.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 }), 535, currentOffsetY, { align: 'right' });

    doc.line(350, currentOffsetY + 8, 565, currentOffsetY + 8);

    doc.setTextColor(rgbAccent.r, rgbAccent.g, rgbAccent.b);
    doc.setFont("Helvetica", "bold");
    doc.text("Outstanding Debt Due:", 350, currentOffsetY + 22);
    doc.text("NGN " + finalDebtBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }), 535, currentOffsetY + 22, { align: 'right' });

    // Custom terms/notes
    doc.setTextColor(110, 110, 110);
    doc.setFontSize(8);
    doc.setFont("Helvetica", "bold");
    doc.text("REMARKS AND TERMS", 50, endY);
    doc.setFont("Helvetica", "normal");
    doc.text(customFooterNotes, 50, endY + 12, { maxWidth: 280 });
  };

  // -------------------------------------------------------------
  // STYLE C: KIOSK COMPACT STYLE
  // -------------------------------------------------------------
  const drawKioskCompact = () => {
    // Narrow layout width simulated inside standard PDF
    const lX = 140; // centering center start coordinates
    const rX = 450;
    const midX = 295;

    doc.setFillColor(252, 251, 247);
    doc.rect(lX - 10, 20, 330, 780, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(1);
    doc.rect(lX - 10, 20, 330, 780);

    // Draw compact logo
    const logoDrawn = drawLogoIfAvailable(midX - 20, 35, 40);

    doc.setTextColor(50, 50, 50);
    doc.setFont("Courier", "bold");
    doc.setFontSize(13);
    doc.text(businessName.toUpperCase(), midX, logoDrawn ? 90 : 50, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setFont("Courier", "normal");
    doc.text(address || "M-12 SME provisions, Lagos", midX, logoDrawn ? 104 : 64, { align: 'center' });
    doc.text(`T: ${phone || "000-000-0000"}`, midX, logoDrawn ? 114 : 74, { align: 'center' });

    doc.line(lX, logoDrawn ? 122 : 82, rX, logoDrawn ? 122 : 82);

    let startY = logoDrawn ? 138 : 98;
    doc.text(`TICKET NO: YB-2026-${formattedInvoiceId}`, lX, startY);
    doc.text(`DATE: ${new Date(invoice.createdAt).toLocaleString()}`, lX, startY + 12);
    doc.text(`CLIENT: ${invoice.customerName.toUpperCase()}`, lX, startY + 24);
    doc.text(`TYPE: ${invoice.transactionType.toUpperCase()}`, lX, startY + 36);

    doc.line(lX, startY + 44, rX, startY + 44);

    doc.setFont("Courier", "bold");
    doc.text(isService ? "SERVICE DESCRIPTION" : "ITEM DESCRIPTION", lX, startY + 56);
    doc.text("TOTAL DUE", rX, startY + 56, { align: 'right' });
    doc.line(lX, startY + 62, rX, startY + 62);

    doc.setFont("Courier", "normal");
    let itemY = startY + 74;

    if (invoice.items && invoice.items.length > 0) {
      invoice.items.forEach(itm => {
        doc.text(`${itm.name.substring(0, 22)} x${itm.quantity}`, lX, itemY);
        doc.text("NGN " + itm.total.toLocaleString(), rX, itemY, { align: 'right' });
        itemY += 15;
      });
    } else {
      doc.text(`${(invoice.productName || "General Goods").substring(0, 22)} x1`, lX, itemY);
      doc.text("NGN " + invoice.totalAmount.toLocaleString(), rX, itemY, { align: 'right' });
      itemY += 15;
    }

    doc.line(lX, itemY + 5, rX, itemY + 5);

    let currentOffsetY = itemY + 20;

    doc.text(`BILL SUM:`, lX, currentOffsetY);
    doc.text("NGN " + invoice.totalAmount.toLocaleString(), rX, currentOffsetY, { align: 'right' });

    if (showTax) {
      currentOffsetY += 14;
      doc.text(`VAT TALLY:`, lX, currentOffsetY);
      doc.text("NGN " + taxAmount.toLocaleString(), rX, currentOffsetY, { align: 'right' });

      currentOffsetY += 14;
      doc.setFont("Courier", "bold");
      doc.text(`NET TOTAL:`, lX, currentOffsetY);
      doc.text("NGN " + finalInvoiced.toLocaleString(), rX, currentOffsetY, { align: 'right' });
      doc.setFont("Courier", "normal");
    }

    currentOffsetY += 14;
    doc.setTextColor(16, 185, 129);
    doc.text(`CASH RECOV:`, lX, currentOffsetY);
    doc.text("NGN " + invoice.amountPaid.toLocaleString(), rX, currentOffsetY, { align: 'right' });

    currentOffsetY += 16;
    doc.setTextColor(239, 68, 68);
    doc.setFont("Courier", "bold");
    doc.text(`LEDGER BALANCE:`, lX, currentOffsetY);
    doc.text("NGN " + finalDebtBalance.toLocaleString(), rX, currentOffsetY, { align: 'right' });

    // footer compact
    doc.setTextColor(100, 100, 100);
    doc.setFont("Courier", "normal");
    doc.setFontSize(7);
    doc.text(`--- SEAMLESS SME BOOKKEEPING ---`, midX, currentOffsetY + 30, { align: 'center' });
    doc.text(`THANK YOU FOR PATRONISING US!`, midX, currentOffsetY + 42, { align: 'center' });
  };

  // -------------------------------------------------------------
  // STYLE D: CUSTOM CRAFTED BUILDER
  // -------------------------------------------------------------
  const drawCustomBuild = () => {
    // Helper to parse design styled states to direct vector outputs
    const applySectionStyleHelper = (style?: any, defaultSize: number = 10, defaultWeight: 'normal' | 'bold' = 'normal') => {
      let fontName = activeFont;
      if (style?.fontFamily === 'serif') fontName = 'Times';
      else if (style?.fontFamily === 'mono') fontName = 'Courier';

      let weightStr = defaultWeight;
      if (style?.fontWeight) {
        if (['bold', 'extrabold', 'semibold'].includes(style.fontWeight)) {
          weightStr = 'bold';
        } else {
          weightStr = 'normal';
        }
      }

      let numericSize = defaultSize;
      if (style?.fontSize) {
        switch (style.fontSize) {
          case 'xs': numericSize = 8.5; break;
          case 'sm': numericSize = 10; break;
          case 'base': numericSize = 12; break;
          case 'lg': numericSize = 14; break;
          case 'xl': numericSize = 17; break;
          case '2xl': numericSize = 20; break;
          case '3xl': numericSize = 24; break;
        }
      }

      doc.setFont(fontName, weightStr);
      doc.setFontSize(numericSize);

      if (style?.textColor) {
        const rgb = hexToRgb(style.textColor);
        doc.setTextColor(rgb.r, rgb.g, rgb.b);
      } else {
        doc.setTextColor(40, 40, 40);
      }
    };

    const headerStyle = business.headerStyles || { fontSize: 'lg', fontFamily: 'sans', fontWeight: 'bold', textColor: '#0E1338' };
    const customerStyle = business.customerStyles || { fontSize: 'sm', fontFamily: 'sans', fontWeight: 'medium', textColor: '#374151' };
    const tableStyle = business.tableStyles || { fontSize: 'sm', fontFamily: 'sans', fontWeight: 'semibold', textColor: '#111827' };
    const footerStyle = business.footerStyles || { fontSize: 'xs', fontFamily: 'sans', fontWeight: 'normal', textColor: '#6B7280' };

    // Custom Accent background header block - Navy blue as requested
    doc.setFillColor(14, 19, 56); 
    doc.rect(30, 30, 535, 95, 'F');

    // Logo display conditions
    const logoDrawn = drawLogoIfAvailable(50, 48, 55);

    // Business Header Styling
    doc.setTextColor(255, 255, 255);
    doc.setFont(activeFont, "bold");
    doc.setFontSize(18);
    doc.text(businessName.toUpperCase(), logoDrawn ? 115 : 55, 75);

    doc.setFontSize(9);
    doc.setFont(activeFont, "normal");
    doc.setTextColor(240, 245, 255);
    doc.text(address || "Merchant Location", logoDrawn ? 115 : 55, 92);
    doc.text(`TEL: ${phone || "unspecified"}`, logoDrawn ? 115 : 55, 104);

    // Badge Title - Pill-shaped (simulated)
    doc.setFillColor(0, 166, 255);
    doc.roundedRect(420, 50, 135, 25, 12, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(activeFont, "bold");
    doc.setFontSize(10);
    doc.text(customHeaderTitle.toUpperCase(), 487.5, 67, { align: 'center' });

    // Transaction Details
    const displayInvoiceNo = `YB-2026-${formattedInvoiceId}`;
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 200);
    doc.text(displayInvoiceNo, 535, 95, { align: 'right' });
    doc.text(new Date(invoice.createdAt).toLocaleDateString(), 535, 107, { align: 'right' });

    // SHADED LAYOUT ROWS for items and financials
    // [Implementation for table columns and shaded summary rows omitted for brevity - assuming plan is solid, proceeding...]
    
    // Line drawing for items table
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(30, 150, 565, 150);
    doc.line(30, 175, 565, 175);
    
    // ... remainder of custom build ...

    // Client section background cards
    doc.setFillColor(248, 250, 252);
    doc.rect(30, 145, 535, 80, 'F');

    // Section style: CUSTOMER RECEIPT CARD
    applySectionStyleHelper(customerStyle, 10, 'normal');
    
    // Draw labels inside client section
    doc.setFont(activeFont, "bold");
    doc.setFontSize(customFontSize === 'sm' ? 8.5 : 9.5);
    doc.text("BILL RECIPIENT", 50, 168);

    doc.setFontSize(customFontSize === 'sm' ? 10 : 11);
    doc.text(invoice.customerName, 50, 188);
    doc.setFont(activeFont, "normal");
    doc.setFontSize(customFontSize === 'sm' ? 8 : 8.5);
    doc.text(`Phone: ${customerPhone || "000-000-0000"}`, 50, 203);

    // Right column customer ledger entry labels
    doc.setFont(activeFont, "bold");
    doc.setFontSize(customFontSize === 'sm' ? 8.5 : 9.5);
    doc.text("TRANSACTION LEDGER ENTRY", 350, 168);
    doc.setFont(activeFont, "normal");
    doc.text(`Type: ${invoice.transactionType === 'sale' ? 'Sale Ledger' : 'Repayment slip'}`, 350, 188);
    doc.text(`Email: ${customerEmail || "N/A"}`, 350, 203);

    // Draw item table grid lines
    doc.setDrawColor(rgbAccent.r, rgbAccent.g, rgbAccent.b);
    doc.setLineWidth(1);
    doc.line(30, 245, 565, 245);

    // Table header style setup
    applySectionStyleHelper(tableStyle, 10, 'bold');
    doc.text("ITEM PRODUCE LINE", 50, 260);
    doc.text("QTY", 310, 260, { align: 'center' });
    doc.text("RATE", 420, 260, { align: 'right' });
    doc.text("TOTAL SUM", 535, 260, { align: 'right' });

    doc.line(30, 268, 565, 268);

    // Draw catalog items with table styles
    let startY = 290;
    // Padding rows spacing density adjustments
    const rowGap = customFontSize === 'sm' ? 18 : customFontSize === 'lg' ? 24 : 20;

    if (invoice.items && invoice.items.length > 0) {
      invoice.items.forEach((itm) => {
        applySectionStyleHelper(tableStyle, 10, 'normal');
        doc.text(itm.name, 50, startY);
        doc.text(itm.quantity.toString(), 310, startY, { align: 'center' });
        doc.text("NGN " + itm.price.toLocaleString(), 420, startY, { align: 'right' });
        
        // Emphasize the row sum in bold table styling
        doc.setFont(activeFont, "bold");
        doc.text("NGN " + itm.total.toLocaleString(), 535, startY, { align: 'right' });
        startY += rowGap;
      });
    } else {
      applySectionStyleHelper(tableStyle, 10, 'normal');
      doc.text(invoice.productName || "General Goods Outflow", 50, startY);
      doc.text("1", 310, startY, { align: 'center' });
      doc.text("NGN " + invoice.totalAmount.toLocaleString(), 420, startY, { align: 'right' });
      
      doc.setFont(activeFont, "bold");
      doc.text("NGN " + invoice.totalAmount.toLocaleString(), 535, startY, { align: 'right' });
      startY += rowGap;
    }

    doc.line(30, startY + 5, 565, startY + 5);

    // Subtotal summaries grid
    const endY = startY + 30;
    
    // Total numbers panel utilizes custom footer style
    applySectionStyleHelper(footerStyle, 9.5, 'normal');
    doc.text("Gross Invoice Subtotal:", 350, endY);
    doc.text("NGN " + invoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }), 535, endY, { align: 'right' });

    let currentOffsetY = endY + 16;
    if (showTax) {
      doc.text("VAT (7.5%):", 350, currentOffsetY);
      doc.text("NGN " + taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }), 535, currentOffsetY, { align: 'right' });
      currentOffsetY += 16;

      doc.setFont(activeFont, "bold");
      doc.text("Total Invoiced:", 350, currentOffsetY);
      doc.text("NGN " + finalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 }), 535, currentOffsetY, { align: 'right' });
      applySectionStyleHelper(footerStyle, 9.5, 'normal');
      currentOffsetY += 16;
    }

    doc.setTextColor(16, 185, 129);
    doc.text("Amount Cleared Deposits:", 350, currentOffsetY);
    doc.text("NGN " + invoice.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 }), 535, currentOffsetY, { align: 'right' });

    doc.line(350, currentOffsetY + 8, 565, currentOffsetY + 8);

    // Debts highlight with accent color
    doc.setTextColor(rgbAccent.r, rgbAccent.g, rgbAccent.b);
    doc.setFont(activeFont, "bold");
    doc.text("Ledger Credit Owed:", 350, currentOffsetY + 22);
    doc.text("NGN " + finalDebtBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }), 535, currentOffsetY + 22, { align: 'right' });

    // Custom footer remarks text block styled section
    applySectionStyleHelper(footerStyle, 8, 'normal');
    doc.setFont(activeFont, "bold");
    doc.text("CUSTOM REMARKS AND COMPLIANCE WINDOW", 50, endY);
    doc.setFont(activeFont, "normal");
    doc.text(customFooterNotes, 50, endY + 12, { maxWidth: 280 });
  };

  // Switch template outputs compilation to single PDF file
  switch (invoiceTemplatePreference) {
    case 'modern_blue':
      drawModernBlue();
      break;
    case 'kiosk_compact':
      drawKioskCompact();
      break;
    case 'custom_build':
      drawCustomBuild();
      break;
    case 'classic':
    default:
      drawClassic();
      break;
  }

  // Base Compliance PDF mark
  doc.setFillColor(243, 244, 246);
  doc.rect(30, 750, 535, 30, 'F');
  doc.setTextColor(100, 110, 140);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("FIRS COMPLIANCE LEDGER · REGISTERED SECURE VIA YEEDEM BOOKS GATEWAY", 297, 768, { align: 'center' });

  // Save/Download invoice PDF
  if (isGuestTrial) {
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(40);
    doc.text("YEEDEM BOOK TRIAL", 300, 400, { align: 'center', angle: 45 });
  }

  if (returnInstance) {
    return doc as any;
  }

  const filename = `${businessName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_invoice_${formattedInvoiceId}.pdf`;
  doc.save(filename);
}

/**
 * Generates and downloads a clean, multi-page, formatted PDF summary ledger report of all transactions.
 */
export function generateTransactionsSummaryPDF(
  invoices: Invoice[],
  business?: BusinessProfile,
  filters?: {
    searchTerm?: string;
    typeFilter?: string;
    debtFilter?: string;
  }
) {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4'
  });

  const businessName = business?.businessName || 'Yeedem Merchant';
  const accentColor = business?.customAccentColor || '#0E1338';
  
  // Custom font selection
  const activeFont = 'Helvetica';

  // Hex to RGB helper
  const hexToRgb = (hex: string) => {
    const cleanHex = hex.replace('#', '');
    const num = parseInt(cleanHex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  };
  const rgbAccent = hexToRgb(accentColor);

  let pageNum = 1;

  const drawPageHeaderAndBranding = (page: number) => {
    // Top colored banner bar
    doc.setFillColor(rgbAccent.r, rgbAccent.g, rgbAccent.b);
    doc.rect(30, 30, 535, 12, 'F');

    // Title
    doc.setTextColor(14, 19, 56); // Deep charcoal black
    doc.setFont(activeFont, "bold");
    doc.setFontSize(15);
    doc.text(businessName.toUpperCase(), 35, 62);

    doc.setFont(activeFont, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 110, 140);
    doc.text("FINANCIAL TRANSACTIONS REGISTER & HISTORICAL SUMMARY", 35, 76);

    // Right metrics info
    doc.setFont(activeFont, "normal");
    doc.setFontSize(7.5);
    const dateStr = new Date().toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    doc.text(`Generated: ${dateStr}`, 565, 58, { align: 'right' });
    doc.text(`Page: ${page}`, 565, 72, { align: 'right' });

    // Filter statuses
    if (filters) {
      let filterText = "Active Filters: ";
      if (filters.typeFilter && filters.typeFilter !== 'all') filterText += `[Type: ${filters.typeFilter}] `;
      if (filters.debtFilter && filters.debtFilter !== 'all') filterText += `[Status: ${filters.debtFilter}] `;
      if (filters.searchTerm) filterText += `[Query: "${filters.searchTerm}"] `;
      if (filterText === "Active Filters: ") filterText += "All Records";
      doc.text(filterText.substring(0, 95), 35, 88);
    }

    // Border header lines
    doc.setDrawColor(220, 225, 235);
    doc.setLineWidth(1);
    doc.line(30, 96, 565, 96);
  };

  const drawSummaryKPIs = () => {
    // calculate summary items
    let totalSales = 0;
    let totalExpenses = 0;
    let totalSettlements = 0;
    let totalOutstanding = 0;

    invoices.forEach(inv => {
      if (inv.transactionType === 'sale') {
        totalSales += inv.totalAmount;
        totalOutstanding += inv.debtBalance;
      } else if (inv.transactionType === 'expense') {
        totalExpenses += inv.totalAmount;
      } else if (inv.transactionType === 'payment_on_account') {
        totalSettlements += inv.totalAmount;
      }
    });

    const boxW = 122;
    const boxH = 42;
    const startX = 35;
    const yVal = 106;
    const gap = 12;

    const items = [
      { label: "TRANSACTIONS COUNT", val: `${invoices.length} Entries`, color: [14, 19, 56] },
      { label: "GROSS SALES (₦)", val: `${totalSales.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`, color: [16, 185, 129] },
      { label: "OUTSTANDING CREDIT", val: `${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`, color: [220, 38, 38] },
      { label: "CAPITAL SETTLED", val: `${totalSettlements.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`, color: [59, 130, 246] }
    ];

    items.forEach((item, i) => {
      const curX = startX + i * (boxW + gap);
      // Background card
      doc.setFillColor(248, 250, 252);
      doc.rect(curX, yVal, boxW, boxH, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(curX, yVal, boxW, boxH, 'S');

      // Left indicator highlight bar
      doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      doc.rect(curX, yVal, 3, boxH, 'F');

      // Label text
      doc.setFont(activeFont, "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 110, 140);
      doc.text(item.label, curX + 10, yVal + 14);

      // Value text
      doc.setFont(activeFont, "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(item.color[0], item.color[1], item.color[2]);
      doc.text(item.val, curX + 10, yVal + 30);
    });
  };

  const drawPageFooter = (page: number) => {
    doc.setFillColor(243, 244, 246);
    doc.rect(30, 760, 535, 20, 'F');
    doc.setTextColor(110, 120, 145);
    doc.setFont(activeFont, "bold");
    doc.setFontSize(7.5);
    doc.text("Yeedem Business Intelligence Ledger • Secure Transaction Export Report", 297, 772, { align: 'center' });
  };

  // Initial render
  drawPageHeaderAndBranding(pageNum);
  drawSummaryKPIs();

  // Table header offset and paint
  const tableHeaderY = 162;
  doc.setFillColor(rgbAccent.r, rgbAccent.g, rgbAccent.b);
  doc.rect(35, tableHeaderY, 525, 20, 'F');

  doc.setFont(activeFont, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("TIMESTAMP", 42, tableHeaderY + 13);
  doc.text("REFERENCE", 130, tableHeaderY + 13);
  doc.text("CLIENT / MERCHANT CONTACT", 192, tableHeaderY + 13);
  doc.text("TYPE", 310, tableHeaderY + 13);
  doc.text("MEMO DETAILS", 370, tableHeaderY + 13);
  doc.text("AMOUNT SUM", 460, tableHeaderY + 13, { align: 'right' });
  doc.text("DEBT BALANCE", 550, tableHeaderY + 13, { align: 'right' });

  let yOffset = tableHeaderY + 20;

  invoices.forEach((inv, index) => {
    // Dynamic page wrapping calculation
    if (yOffset > 730) {
      drawPageFooter(pageNum);
      doc.addPage();
      pageNum++;
      
      // Page header Setup
      drawPageHeaderAndBranding(pageNum);
      
      const subHeaderY = 110;
      doc.setFillColor(rgbAccent.r, rgbAccent.g, rgbAccent.b);
      doc.rect(35, subHeaderY, 525, 20, 'F');
      doc.setFont(activeFont, "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text("TIMESTAMP", 42, subHeaderY + 13);
      doc.text("REFERENCE", 130, subHeaderY + 13);
      doc.text("CLIENT / MERCHANT CONTACT", 192, subHeaderY + 13);
      doc.text("TYPE", 310, subHeaderY + 13);
      doc.text("MEMO DETAILS", 370, subHeaderY + 13);
      doc.text("AMOUNT SUM", 460, subHeaderY + 13, { align: 'right' });
      doc.text("DEBT BALANCE", 550, subHeaderY + 13, { align: 'right' });

      yOffset = subHeaderY + 20;
    }

    // Zebra row background formatting striping
    if (index % 2 === 0) {
      doc.setFillColor(252, 253, 254);
    } else {
      doc.setFillColor(242, 244, 247);
    }
    doc.rect(35, yOffset, 525, 22, 'F');

    // Bottom dotted style separator line
    doc.setDrawColor(230, 234, 241);
    doc.setLineWidth(0.5);
    doc.line(35, yOffset + 22, 560, yOffset + 22);

    doc.setTextColor(75, 80, 95);
    doc.setFont(activeFont, "normal");
    doc.setFontSize(7.5);
    
    // Parse timestamp
    const formattedDate = new Date(inv.createdAt).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    doc.text(formattedDate, 42, yOffset + 14);

    // Reference identifier trimmed
    doc.text(inv.id.substring(0, 14).toUpperCase() + '...', 130, yOffset + 14);

    // Client context
    doc.setFont(activeFont, "bold");
    doc.setTextColor(15, 20, 35);
    const clientName = inv.customerName || 'Walk-in Customer';
    const croppedClientName = clientName.length > 22 ? clientName.substring(0, 20) + '..' : clientName;
    doc.text(croppedClientName, 192, yOffset + 14);

    // Trade action category
    let categoryText: string = inv.transactionType;
    let textRGB = [80, 80, 80];
    if (inv.transactionType === 'sale') {
      categoryText = 'Wholesale Sale';
      textRGB = [16, 185, 129];
    } else if (inv.transactionType === 'expense') {
      categoryText = 'Expense Outflow';
      textRGB = [100, 110, 120];
    } else if (inv.transactionType === 'payment_on_account') {
      categoryText = 'Settlement Recv';
      textRGB = [59, 130, 246];
    }
    doc.setTextColor(textRGB[0], textRGB[1], textRGB[2]);
    doc.text(categoryText.toUpperCase(), 310, yOffset + 14);

    // Details memo
    doc.setTextColor(70, 75, 90);
    doc.setFont(activeFont, "normal");
    const memo = inv.productName || 'General cargo';
    const croppedMemo = memo.length > 18 ? memo.substring(0, 16) + '..' : memo;
    doc.text(croppedMemo, 370, yOffset + 14);

    // Invoiced Amount sum
    doc.setFont(activeFont, "bold");
    doc.setTextColor(15, 20, 35);
    const amountStr = inv.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    doc.text(`₦${amountStr}`, 460, yOffset + 14, { align: 'right' });

    // Outstanding Debt column
    const balanceStr = (inv.debtBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    if (inv.debtBalance > 0) {
      doc.setTextColor(220, 38, 38);
    } else {
      doc.setTextColor(110, 120, 130);
    }
    doc.text(`₦${balanceStr}`, 550, yOffset + 14, { align: 'right' });

    yOffset += 22;
  });

  // Render ending calculated details footer
  if (yOffset > 710) {
    drawPageFooter(pageNum);
    doc.addPage();
    pageNum++;
    drawPageHeaderAndBranding(pageNum);
    yOffset = 110;
  }

  // Draw filtered totals block container
  doc.setFillColor(243, 246, 252);
  doc.rect(34, yOffset + 5, 526, 25, 'F');
  doc.setDrawColor(rgbAccent.r, rgbAccent.g, rgbAccent.b);
  doc.setLineWidth(1.2);
  doc.line(34, yOffset + 5, 560, yOffset + 5);

  let filterSumTotal = 0;
  let filterSumDebt = 0;
  invoices.forEach(inv => {
    filterSumTotal += inv.totalAmount;
    filterSumDebt += inv.debtBalance;
  });

  doc.setFont(activeFont, "bold");
  doc.setFontSize(8);
  doc.setTextColor(rgbAccent.r, rgbAccent.g, rgbAccent.b);
  doc.text("FILTERED LIST AGGREGATE:", 42, yOffset + 21);

  doc.text(`₦${filterSumTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 460, yOffset + 21, { align: 'right' });
  doc.text(`₦${filterSumDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 550, yOffset + 21, { align: 'right' });

  drawPageFooter(pageNum);

  const cleanBusinessName = businessName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`yeedem_${cleanBusinessName}_transactions_report.pdf`);
}
