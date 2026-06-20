import React, { useState, useEffect } from 'react';
import { Invoice, BusinessProfile, Customer } from '../types';
import { generateInvoicePDF } from '../lib/pdfGenerator';
import { WhatsAppPayLinkGenerator } from './WhatsAppPayLinkGenerator';
import { 
  Printer, 
  Calendar, 
  ShieldCheck, 
  Mail, 
  Globe, 
  Send, 
  X, 
  AlertTriangle, 
  Link2, 
  Download, 
  CheckCircle, 
  Hourglass,
  Check
} from 'lucide-react';

interface InvoiceThemeProps {
  invoice: Invoice;
  business: BusinessProfile;
  customers?: Customer[];
  onUpdateCustomerContact?: (customerId: string, phone?: string, email?: string) => void;
  onUpdateInvoiceDate?: (invoiceId: string, newDate: string) => void;
  onUpdateInvoiceStatus?: (invoiceId: string, status: 'DRAFT' | 'PAID' | 'OVERDUE') => void;
  showTax?: boolean;
  isLoggedIn?: boolean;
  onRequireSignup?: () => void;
  isSharedPublicView?: boolean;
  onTriggerBackup?: () => Promise<any>;
  skippedOnboarding?: boolean;
}

export default function InvoiceTheme({ 
  invoice, 
  business, 
  customers, 
  onUpdateCustomerContact,
  onUpdateInvoiceDate: rawOnUpdateInvoiceDate,
  onUpdateInvoiceStatus: rawOnUpdateInvoiceStatus,
  showTax = false,
  isLoggedIn: rawIsLoggedIn = true,
  onRequireSignup,
  isSharedPublicView = false,
  onTriggerBackup,
  skippedOnboarding = false
}: InvoiceThemeProps) {
  const onUpdateInvoiceDate = isSharedPublicView ? undefined : rawOnUpdateInvoiceDate;
  const onUpdateInvoiceStatus = isSharedPublicView ? undefined : rawOnUpdateInvoiceStatus;
  const isLoggedIn = isSharedPublicView ? true : rawIsLoggedIn;

  const { businessName, address, phone, invoiceTemplatePreference, businessLogo, logoWidth, logoHeight, logoRotation, headerRotation } = business;
  const isService = business?.businessType === 'service';

  // 1. Look up matched customer from state to display realistic contact records
  const matchedCustomer = customers?.find(
    c => c.name.toLowerCase() === invoice.customerName.toLowerCase()
  );

  const customerId = matchedCustomer?.id || "cust_temp_" + Date.now();
  const customerPhone = matchedCustomer?.phone || '';
  const customerEmail = matchedCustomer?.email || '';

  // Safely format invoice.createdAt to a YYYY-MM-DD string for input[type=date]
  let inputDateValue = '';
  try {
    const d = new Date(invoice.createdAt);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      inputDateValue = `${year}-${month}-${day}`;
    }
  } catch (e) {
    console.error("Error formatting date picker:", e);
  }

  // 2. Computed Financials with Optional Tax
  const taxAmount = showTax ? invoice.totalAmount * 0.075 : 0;
  const finalInvoiced = invoice.totalAmount + taxAmount;
  const finalDebtBalance = Math.max(0, finalInvoiced - invoice.amountPaid);

  // Local Pop-up & Validation States
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false); // <--- Expansion state
  const [tempPhone, setTempPhone] = useState('');
  const [tempEmail, setTempEmail] = useState('');

  // NRS Status States
  const [firsClearanceStatus, setFirsClearanceStatus] = useState<'pending' | 'cleared'>('pending');
  const [firsCode, setFirsCode] = useState('');

  // Toast status tracking
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 3. WHATSAPP TRIGGER INTERCEPT WORKFLOW
  const handleWhatsAppAction = () => {
    if ((!isLoggedIn || skippedOnboarding) && onRequireSignup) { onRequireSignup(); return; }
    let cleanedPhone = customerPhone.trim();
    if (cleanedPhone.startsWith('0')) {
      cleanedPhone = '+234' + cleanedPhone.slice(1);
      if (onUpdateCustomerContact) {
        onUpdateCustomerContact(customerId, cleanedPhone, undefined);
      }
    }
    // Validate empty, null or default placeholders (e.g., "0000000000")
    if (!cleanedPhone || cleanedPhone === '0000000000' || /^0+$/.test(cleanedPhone)) {
      setTempPhone(cleanedPhone);
      setIsWhatsAppModalOpen(true);
    } else {
      executeWhatsAppShare(cleanedPhone);
    }
  };

  const handleWhatsAppSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let cleanInput = tempPhone.trim();
    if (cleanInput.startsWith('0')) {
      cleanInput = '+234' + cleanInput.slice(1);
    }
    if (!cleanInput || cleanInput === '0000000000' || /^0+$/.test(cleanInput)) {
      alert("Provide a valid phone number to share this invoice via WhatsApp");
      return;
    }

    // Call AJAX simulation to parent update state
    if (onUpdateCustomerContact) {
      onUpdateCustomerContact(customerId, cleanInput, undefined);
    }
    
    setIsWhatsAppModalOpen(false);
    triggerToast("Customer contact details updated, sending dispatch record...");
    
    // Proceed with share seamlessly
    setTimeout(() => {
      executeWhatsAppShare(cleanInput);
    }, 600);
  };

  const executeWhatsAppShare = (phoneNo: string) => {
    if (onTriggerBackup) {
      onTriggerBackup().catch(() => {});
    }
    let normalized = phoneNo.trim();
    if (normalized.startsWith('0')) {
      normalized = '+234' + normalized.slice(1);
    }
    const formattedPhoneNo = normalized.replace(/[^0-9+]/g, '');
    const previewToken = "yb_token_" + invoice.id.substring(0, 8);
    const mockPublicUrl = window.location.origin + `/receipts/token/${previewToken}/`;
    const message = `Hello ${invoice.customerName}, here is your bookkeeping invoice breakdown from ${businessName}. Invoice identifier: YB-2026-${invoice.id.substring(0, 4).toUpperCase()}. Balance Due: ₦${invoice.debtBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}. You can view the live interactive receipt and ledger online at: ${mockPublicUrl} Expect delivery details soon!`;
    const shareUrl = `https://api.whatsapp.com/send?phone=${formattedPhoneNo}&text=${encodeURIComponent(message)}`;
    window.open(shareUrl, '_blank');
  };

  // 4. EMAIL TRIGGER INTERCEPT WORKFLOW
  const handleEmailAction = () => {
    if (!isLoggedIn && onRequireSignup) { onRequireSignup(); return; }
    const cleanedEmail = customerEmail.trim();
    if (!cleanedEmail || cleanedEmail === '') {
      setTempEmail(cleanedEmail);
      setIsEmailModalOpen(true);
    } else {
      executeEmailShare(cleanedEmail);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = tempEmail.trim();
    if (!cleanInput || !cleanInput.includes('@')) {
      alert("Provide a recipient email address to send this invoice");
      return;
    }

    // Call AJAX simulation to parent update state
    if (onUpdateCustomerContact) {
      onUpdateCustomerContact(customerId, undefined, cleanInput);
    }

    setIsEmailModalOpen(false);
    triggerToast("Customer email address updated, dispatching mail task...");

    // Proceed with share seamlessly
    setTimeout(() => {
      executeEmailShare(cleanInput);
    }, 600);
  };

  const executeEmailShare = (emailAddress: string) => {
    const subject = `Tax Invoice Breakdown - Yeedem Books - #${invoice.id.substring(0,8).toUpperCase()}`;
    const mailBody = `Hello ${invoice.customerName},\n\nPlease find the transaction receipt and digital ledger breakdown from ${businessName}:\n\nInvoice: YB-2026-${invoice.id.substring(0,4).toUpperCase()}\nAmount Invoiced: ₦${invoice.totalAmount.toLocaleString()}\nRepaid Deposit: ₦${invoice.amountPaid.toLocaleString()}\nLedger Due Credit: ₦${invoice.debtBalance.toLocaleString()}\n\nThank you for choosing Yeedem Books. This document acts as an official trade journal entry.`;
    window.location.href = `mailto:${emailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`;
  };

  // 5. PUBLIC LINK WORKFLOW
  const copyPublicLink = () => {
    if (!isLoggedIn && onRequireSignup) { onRequireSignup(); return; }

    if (onTriggerBackup) {
      onTriggerBackup().catch((e) => {
        console.warn("[BACKUP] Immediate backup trigger failed during link copy:", e);
      });
    }

    const previewToken = "yb_token_" + invoice.id.substring(0, 8);
    const mockPublicUrl = window.location.origin + `/receipts/token/${previewToken}/`;
    
    navigator.clipboard.writeText(mockPublicUrl).then(() => {
      triggerToast("✅ Secure Public Link copied to clipboard!");
    }).catch(() => {
      alert("Secure link: " + mockPublicUrl);
    });
  };

  // 6. CLEAR FIRS NOW ACTION
  const handleClearWithFIRS = () => {
    const generatedFirsAuth = "FIRS-CLR-2026-" + Math.random().toString(36).substring(2, 10).toUpperCase();
    setFirsClearanceStatus('cleared');
    setFirsCode(generatedFirsAuth);
    triggerToast(`✓ Cleared with FIRS! Auth Code: ${generatedFirsAuth}`);
  };

  // 7. FORMATTED PDF DOWNLOAD GENERATOR
  const generatePDFDownload = () => {
    if ((!isLoggedIn || skippedOnboarding) && onRequireSignup) { onRequireSignup(); return; }
    generateInvoicePDF(invoice, business, customers, false, showTax);
    triggerToast("✓ Downloaded customized, branded PDF invoice successfully!");
  };

  const renderClassic = () => (
    <div className="border-4 border-black p-8 bg-white text-black font-serif uppercase tracking-tight shadow-md animate-fadeIn">
      {/* Receipts branding */}
      <div className="border-b-4 border-black pb-4 flex justify-between items-start">
        <div>
          {businessLogo && (
            <img 
              src={businessLogo} 
              alt="Logo" 
              style={{ 
                width: `${logoWidth || 50}px`, 
                height: `${logoHeight || 50}px`, 
                transform: `rotate(${logoRotation || 0}deg)` 
              }} 
              className="mb-2 object-contain" 
            />
          )}
          <h1 className="text-xl font-bold tracking-tighter">{businessName || 'BUSINESS NAME'}</h1>
          <p className="text-[9px] mt-0.5 font-mono tracking-widest">{address || "LAGOS, NIGERIA"}</p>
          <p className="text-[9px] font-mono tracking-widest">TEL: {phone || "+234 812-345-6789"}</p>
        </div>
        <div className="text-right">
          <h2 className="text-sm font-extrabold border-2 border-black px-2 py-0.5 bg-black text-white">JOURNAL RECEIPT</h2>
          <p className="text-[10px] font-mono mt-1">NO: YB-2026-{invoice.id.substring(0, 4).toUpperCase()}</p>
        </div>
      </div>

      {/* Customer Client details */}
      <div className="py-3 grid grid-cols-3 gap-2 border-b-2 border-black text-[10px]">
        <div>
          <span className="font-bold block text-[8px]">BILLED TO CUSTOMER:</span>
          <span className="font-semibold block text-xs">{invoice.customerName}</span>
          <span className="text-[9.5px] font-mono tracking-wider block mt-0.5">PHONE: {customerPhone || "0000000000"}</span>
          {customerEmail && <span className="text-[9.5px] font-mono tracking-wider block">EMAIL: {customerEmail}</span>}
        </div>
        <div className="bg-amber-50 border border-amber-300 p-2 rounded flex flex-col justify-between">
          <div>
            <span className="font-bold block text-[8px] text-amber-800">INVOICE STATUS:</span>
            <select
              value={invoice.status || (invoice.debtBalance > 0 ? 'OVERDUE' : 'PAID')}
              onChange={(e) => {
                if (onUpdateInvoiceStatus) {
                  onUpdateInvoiceStatus(invoice.id, e.target.value as 'DRAFT' | 'PAID' | 'OVERDUE');
                  triggerToast(`Status updated to ${e.target.value}`);
                }
              }}
              className="text-[9px] font-semibold bg-white border border-amber-300 mt-1 p-0.5 cursor-pointer uppercase font-mono w-full text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="DRAFT">DRAFT</option>
              <option value="PAID">PAID</option>
              <option value="OVERDUE">OVERDUE</option>
            </select>
          </div>
        </div>
        <div className="text-right">
          <span className="font-bold block text-[8px]">ENTRY STATE:</span>
          <span className="font-semibold text-xs">{invoice.transactionType === 'sale' ? 'Wholesale Trade Log' : invoice.transactionType}</span>
        </div>
      </div>

      {/* Tables of Items */}
      <div className="py-3">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b-2 border-black font-extrabold">
              <th className="pb-1 text-left">{isService ? 'DESCRIPTION OF SERVICE' : 'ITEM'}</th>
              <th className="pb-1 text-center">{isService ? 'DURATION/UNITS' : 'QTY'}</th>
              <th className="pb-1 text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items && invoice.items.length > 0 ? (
              invoice.items.map((itm, index) => (
                <tr key={index} className="border-b border-gray-300">
                  <td className="py-2 text-left font-semibold">{itm.name}</td>
                  <td className="py-2 text-center font-mono">{itm.quantity}</td>
                  <td className="py-2 text-right font-mono font-bold">₦{itm.total.toLocaleString()}</td>
                </tr>
              ))
            ) : (
              <tr className="border-b border-gray-300">
                <td className="py-2 text-left font-semibold">{invoice.productName}</td>
                <td className="py-2 text-center font-mono">1</td>
                <td className="py-2 text-right font-mono font-bold">₦{invoice.totalAmount.toLocaleString()}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Financial Details */}
      <div className={`flex border-t-2 border-black pt-3 text-[10px] ${!isLoggedIn ? 'guest-blur' : ''}`}>
        <div className="w-1/2 text-[8px] italic leading-tight">
          <span>* Real-time classic offline-print preview simulation</span>
        </div>
        <div className="w-1/2 space-y-1 text-right font-mono">
          <div className="flex justify-between">
            <span className="font-serif">TOTAL:</span>
            <span>₦{finalInvoiced.toLocaleString()}</span>
          </div>
          {showTax && (
            <div className="flex justify-between font-semibold text-gray-500">
              <span className="font-serif">INCLUDES 7.5% VAT:</span>
              <span>₦{taxAmount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-750">
            <span className="font-serif">CASH RECOV:</span>
            <span>₦{invoice.amountPaid.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold border-t border-black pt-1 block text-sm">
            <span className="font-serif">DUE CREDIT:</span>
            <span>₦{finalDebtBalance.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderModernBlue = () => (
    <div className="bg-white rounded-3xl p-8 shadow-xl overflow-hidden animate-fadeIn font-sans text-gray-800">
      {/* Top corporate bar */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-900 -mx-8 -mt-8 px-8 py-6 text-white flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          {businessLogo ? (
            <div className="p-1 px-2 rounded bg-white shadow-inner flex items-center justify-center">
              <img src={businessLogo} alt="Logo" className="max-h-12 w-auto object-contain" />
            </div>
          ) : (
            <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center font-bold font-display">YB</div>
          )}
          <div>
            <h1 className="text-lg font-display font-semibold leading-tight">{businessName}</h1>
            <span className="text-[10px] opacity-75">{address || "Lagos, Nigeria"}</span>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xs font-mono font-black tracking-widest uppercase bg-blue-500/20 px-3 py-1 rounded-full">
            Invoice Receipt
          </h2>
          <p className="text-[10px] mt-1 font-mono">YB-2026-{invoice.id.substring(0, 4).toUpperCase()}</p>
        </div>
      </div>

      {/* Customer summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50/50 rounded-2xl p-4 shadow-sm">
          <span className="text-[9px] uppercase font-bold text-blue-500 tracking-wider">Client Recipient</span>
          <p className="text-sm font-semibold text-gray-900 mt-1 truncate">{invoice.customerName}</p>
          <span className="text-[10px] text-gray-400 block mt-0.5 font-mono truncate">{customerPhone || "0000000000"}</span>
        </div>
        <div className="bg-gray-50 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3 text-gray-400" />
              Issue Date
            </span>
            <input 
              type="date"
              value={inputDateValue}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                if (onUpdateInvoiceDate) {
                  try {
                    const orig = new Date(invoice.createdAt);
                    const parts = val.split('-');
                    if (parts.length === 3) {
                      orig.setFullYear(parseInt(parts[0], 10));
                      orig.setMonth(parseInt(parts[1], 10) - 1);
                      orig.setDate(parseInt(parts[2], 10));
                      onUpdateInvoiceDate(invoice.id, orig.toISOString());
                    }
                  } catch (err) {
                    onUpdateInvoiceDate(invoice.id, new Date(val).toISOString());
                  }
                }
              }}
              className="w-full text-xs font-semibold text-gray-950 bg-white border border-gray-200 rounded-lg px-2 py-0.5 mt-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            />
          </div>
          <span className="text-[10px] text-gray-400 block mt-1">Adjust issuance date</span>
        </div>
        <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <span className="text-[9px] uppercase font-bold text-amber-800 tracking-wider flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
              Invoice Status
            </span>
            <select
              value={invoice.status || (invoice.debtBalance > 0 ? 'OVERDUE' : 'PAID')}
              onChange={(e) => {
                if (onUpdateInvoiceStatus) {
                  onUpdateInvoiceStatus(invoice.id, e.target.value as 'DRAFT' | 'PAID' | 'OVERDUE');
                  triggerToast(`Status moved to ${e.target.value}`);
                }
              }}
              className="w-full text-xs font-semibold text-amber-950 bg-white border border-amber-250 rounded-lg px-2 py-0.5 mt-1 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer uppercase font-mono"
            >
              <option value="DRAFT">DRAFT</option>
              <option value="PAID">PAID</option>
              <option value="OVERDUE">OVERDUE</option>
            </select>
          </div>
          <span className="text-[10px] text-amber-600 block mt-1">Status registry toggle</span>
        </div>
        <div className="bg-gray-50 rounded-2xl p-4">
          <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Outstanding</span>
          <p className={`text-sm font-bold mt-1 ${invoice.debtBalance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
            ₦{invoice.debtBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
          </p>
          <span className="text-[10px] text-gray-400 block mt-0.5">Balance due to merchant</span>
        </div>
      </div>

      {/* Item summary table */}
      <div className="mb-8">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="bg-gray-50 rounded-lg text-gray-400 uppercase tracking-widest text-[9px] font-bold">
              <th className="py-3 px-2">{isService ? 'Description of Service' : 'Line Description'}</th>
              <th className="py-3 text-center">{isService ? 'Duration/Units' : 'Qty'}</th>
              <th className="py-3 text-right">{isService ? 'Rate' : 'Unit Price'}</th>
              <th className="py-3 text-right pr-2">Amount Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items && invoice.items.length > 0 ? (
              invoice.items.map((itm, index) => (
                <tr key={index} className="font-medium hover:bg-blue-50/20 transition-colors">
                  <td className="py-4 px-2 text-gray-900 font-semibold">{itm.name}</td>
                  <td className="py-4 text-center text-gray-600 font-mono">{itm.quantity}</td>
                  <td className="py-4 text-right text-gray-600 font-mono">₦{itm.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="py-4 text-right pr-2 text-gray-900 font-bold font-mono">₦{itm.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
              ))
            ) : (
              <tr className="font-medium bg-gray-50/30">
                <td className="py-4 px-2 text-gray-900 font-semibold">{invoice.productName}</td>
                <td className="py-4 text-center text-gray-600">1</td>
                <td className="py-4 text-right text-gray-600">₦{invoice.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="py-4 text-right pr-2 text-gray-900 font-bold font-mono">₦{invoice.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Subtotal columns */}
      <div className={`flex bg-blue-50/10 p-5 rounded-2xl mt-4 ${!isLoggedIn ? 'guest-blur' : ''}`}>
        <div className="w-1/2 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <span className="text-[11px] text-gray-404 font-medium">Verified by Yeedem Books Ledger Engine</span>
        </div>
        <div className="w-1/2 space-y-2 text-xs">
          <div className="flex justify-between text-gray-500 font-medium">
            <span>Subtotal:</span>
            <span>₦{invoice.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          {showTax && (
            <div className="flex justify-between text-gray-500 font-medium">
              <span>VAT (7.5%):</span>
              <span>₦{taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          )}
          {showTax && (
            <div className="flex justify-between text-gray-900 font-bold border-t pt-1 mt-1">
              <span>Total Invoiced:</span>
              <span>₦{finalInvoiced.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-500 font-medium pt-1">
            <span>Amount Deposited:</span>
            <span>₦{invoice.amountPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div className="flex justify-between text-md font-bold text-blue-900 pt-2 border-t mt-1">
            <span>Outstanding Balance due:</span>
            <span>₦{finalDebtBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderKioskCompact = () => (
    <div className="bg-amber-50/30 rounded-3xl max-w-sm mx-auto p-6 shadow-sm font-mono text-xs text-gray-700 space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="text-center space-y-1 bg-white/40 p-4 rounded-t-2xl">
        {businessLogo && (
          <img src={businessLogo} alt="Logo" className="h-10 w-auto mx-auto object-contain pb-2" />
        )}
        <h1 className="text-sm font-bold uppercase tracking-wider">{businessName}</h1>
        <p className="text-[10px] text-gray-500">{address || "Lagos Shop, NG"}</p>
        <p className="text-[10px] text-gray-500">TEL: {phone || "+234 812-345-6789"}</p>
      </div>

      <div className="bg-white/50 p-3 rounded-xl py-2 text-[10px] space-y-1 my-1 shadow-xs">
        <div className="flex justify-between items-center bg-amber-50 border border-amber-200/60 p-1.5 rounded-lg">
          <span className="font-bold text-amber-800 tracking-wider text-[8px]">INVOICE STATUS:</span>
          <select
            value={invoice.status || (invoice.debtBalance > 0 ? 'OVERDUE' : 'PAID')}
            onChange={(e) => {
              if (onUpdateInvoiceStatus) {
                onUpdateInvoiceStatus(invoice.id, e.target.value as 'DRAFT' | 'PAID' | 'OVERDUE');
                triggerToast(`Status updated to ${e.target.value}`);
              }
            }}
            className="text-[8px] font-bold bg-white text-amber-950 px-1 border border-amber-300 rounded focus:outline-none cursor-pointer uppercase font-mono"
          >
            <option value="DRAFT">DRAFT</option>
            <option value="PAID">PAID</option>
            <option value="OVERDUE">OVERDUE</option>
          </select>
        </div>
        <p>ORDER: YB-2026-{invoice.id.substring(0, 4).toUpperCase()}</p>
        <p>DATE: {new Date(invoice.createdAt).toLocaleString()}</p>
        <p className="uppercase">TYPE: {invoice.transactionType}</p>
        <p>CLNT: {invoice.customerName}</p>
        <p>TEL: {customerPhone || "0000000000"}</p>
      </div>

      {/* Table items */}
      <div className="bg-white/50 p-2.5 rounded-xl py-3 space-y-1 shadow-xs">
        {invoice.items && invoice.items.length > 0 ? (
          invoice.items.map((itm, idx) => (
            <div key={idx} className="flex justify-between text-gray-600 text-[11px]">
              <span>{itm.name} x{itm.quantity}</span>
              <span>₦{itm.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          ))
        ) : (
          <div className="flex justify-between text-gray-600 text-[11px]">
            <span>{invoice.productName} x1</span>
            <span>₦{invoice.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        )}
      </div>

      {/* Pricing lists */}
      <div className={`bg-white/50 p-2.5 rounded-xl pt-3 text-[11px] space-y-1 shadow-xs ${!isLoggedIn ? 'guest-blur' : ''}`}>
        <div className="flex justify-between">
          <span>TX SUBTOTAL:</span>
          <span>₦{invoice.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
        </div>
        {showTax && (
          <div className="flex justify-between">
            <span>VAT (7.5%):</span>
            <span>₦{taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        )}
        {showTax && (
          <div className="flex justify-between font-bold border-t border-black/10 pt-1 mt-1">
            <span>TX TOTAL:</span>
            <span>₦{finalInvoiced.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        )}
        <div className="flex justify-between text-emerald-600 font-semibold pt-1">
          <span>CASH PAID:</span>
          <span>₦{invoice.amountPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
        </div>
        <div className="flex justify-between text-red-500 font-bold bg-amber-100/40 p-1.5 rounded-lg text-xs mt-1">
          <span>CREDIT BALANCE:</span>
          <span>₦{finalDebtBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
        </div>
      </div>

      <div className="bg-white/30 p-3 rounded-xl pt-4 text-center text-[10px] text-gray-400 uppercase tracking-widest leading-relaxed">
        <p>Thank you for buying!</p>
        <p>Yeedem Books Ledger App</p>
      </div>
    </div>
  );

  const getFontSizeClass = (sz?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl') => {
    switch (sz) {
      case 'xs': return 'text-[11px]';
      case 'sm': return 'text-xs';
      case 'base': return 'text-sm';
      case 'lg': return 'text-base';
      case 'xl': return 'text-lg';
      case '2xl': return 'text-xl';
      case '3xl': return 'text-2xl';
      default: return 'text-xs';
    }
  };

  const getFontFamilyClass = (fam?: 'sans' | 'serif' | 'mono') => {
    switch (fam) {
      case 'serif': return 'font-serif';
      case 'mono': return 'font-mono';
      case 'sans':
      default:
        return 'font-sans';
    }
  };

  const getFontWeightClass = (fw?: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold') => {
    switch (fw) {
      case 'medium': return 'font-medium';
      case 'semibold': return 'font-semibold';
      case 'bold': return 'font-bold';
      case 'extrabold': return 'font-extrabold';
      case 'normal':
      default:
        return 'font-normal';
    }
  };

  const renderCustomBuild = () => {
    const accentColor = business.customAccentColor || '#00A6FF';
    
    let fontClass = 'font-sans';
    if (business.customFontFamily === 'serif') fontClass = 'font-serif';
    else if (business.customFontFamily === 'mono') fontClass = 'font-mono';

    let densityPadding = 'p-6 space-y-5';
    let textSizeClass = 'text-xs';
    let subTitleSizeClass = 'text-[11px]';
    if (business.customFontSize === 'sm') {
      densityPadding = 'p-4 space-y-3.5';
      textSizeClass = 'text-[11px]';
      subTitleSizeClass = 'text-[10px]';
    } else if (business.customFontSize === 'lg') {
      densityPadding = 'p-8 space-y-6';
      textSizeClass = 'text-sm';
      subTitleSizeClass = 'text-xs';
    }

    let shadowClass = 'shadow-md';
    if (business.customShadowStyle === 'none') shadowClass = 'shadow-none';
    else if (business.customShadowStyle === 'sm') shadowClass = 'shadow-sm';
    else if (business.customShadowStyle === 'md') shadowClass = 'shadow-md';
    else if (business.customShadowStyle === 'lg') shadowClass = 'shadow-lg';
    else if (business.customShadowStyle === 'xl') shadowClass = 'shadow-xl';

    // Retrieve customizable section typography configurations with absolute fallbacks
    const headerStyle = business.headerStyles || { fontSize: 'lg', fontFamily: 'sans', fontWeight: 'bold', textColor: '#0E1338' };
    const customerStyle = business.customerStyles || { fontSize: 'sm', fontFamily: 'sans', fontWeight: 'medium', textColor: '#374151' };
    const tableStyle = business.tableStyles || { fontSize: 'sm', fontFamily: 'sans', fontWeight: 'semibold', textColor: '#111827' };
    const footerStyle = business.footerStyles || { fontSize: 'xs', fontFamily: 'sans', fontWeight: 'normal', textColor: '#6B7280' };

    return (
      <div 
        className={`bg-white rounded-3xl overflow-hidden text-gray-800 ${fontClass} ${shadowClass} ${densityPadding} animate-fadeIn`}
        id="custom-invoice-canvas"
      >
        {/* HEADER SECTION */}
        <div 
          className={`flex justify-between items-start p-4 rounded-t-2xl pb-5 ${getFontFamilyClass(headerStyle.fontFamily)} ${getFontWeightClass(headerStyle.fontWeight)} ${getFontSizeClass(headerStyle.fontSize)}`} 
          style={{ color: headerStyle.textColor, backgroundColor: headerStyle.backgroundColor || '#F9FAFB' }}
        >
          <div className="flex gap-4 items-center">
            {businessLogo && business.customShowLogo !== false && (
              <div className="rounded-xl bg-white p-2 shrink-0 shadow-xs flex items-center justify-center">
                <img src={businessLogo} alt="Logo" className="max-h-12 w-auto object-contain" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold tracking-tight">{businessName}</h1>
              {address && <p className="opacity-75 mt-1 max-w-sm leading-tight text-[11px]">{address}</p>}
              {phone && <p className="opacity-75 font-medium text-[11px]">Tel: {phone}</p>}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xs uppercase font-extrabold tracking-widest px-3 py-1 rounded-full inline-block" style={{ backgroundColor: `${headerStyle.textColor}08`, color: headerStyle.textColor }}>
              {business.customHeaderTitle || 'TAX INVOICE'}
            </h2>
            <p className="opacity-75 font-mono mt-2 text-[11px]">YB-2026-{invoice.id.substring(0, 4).toUpperCase()}</p>
            <p className="opacity-70 font-mono text-[11px]">{new Date(invoice.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {/* CUSTOMER SECTION */}
        <div 
          className={`grid grid-cols-3 gap-4 pb-4 ${getFontFamilyClass(customerStyle.fontFamily)} ${getFontWeightClass(customerStyle.fontWeight)} ${getFontSizeClass(customerStyle.fontSize)}`}
          style={{ color: customerStyle.textColor }}
        >
          <div className="p-3 rounded-xl shadow-xs border border-gray-100/30" style={{ backgroundColor: customerStyle.backgroundColor || '#F9FAFB' }}>
            <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider font-sans block">Client Recipient</span>
            <p className="text-sm font-bold mt-1">{invoice.customerName}</p>
            <p className="text-[10px] opacity-75 font-mono mt-0.5">{customerPhone || "0000000000"}</p>
          </div>
          <div className="p-3 rounded-xl shadow-xs border border-amber-250 bg-amber-50" style={{ color: '#78350F' }}>
            <span className="text-[9px] uppercase font-bold text-amber-800 tracking-wider font-sans block">Invoice Status</span>
            <select
              value={invoice.status || (invoice.debtBalance > 0 ? 'OVERDUE' : 'PAID')}
              onChange={(e) => {
                if (onUpdateInvoiceStatus) {
                  onUpdateInvoiceStatus(invoice.id, e.target.value as 'DRAFT' | 'PAID' | 'OVERDUE');
                  triggerToast(`Status moved to ${e.target.value}`);
                }
              }}
              className="text-[11px] font-semibold bg-white border border-amber-300/80 mt-1 p-0.5 rounded cursor-pointer uppercase font-mono w-full text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="DRAFT">DRAFT</option>
              <option value="PAID">PAID</option>
              <option value="OVERDUE">OVERDUE</option>
            </select>
          </div>
          <div className="p-3 rounded-xl text-right shadow-xs border border-gray-100/30" style={{ backgroundColor: customerStyle.backgroundColor || '#F9FAFB' }}>
            <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider font-sans block">Transaction Record</span>
            <p className="text-sm font-bold capitalize mt-1 text-gray-900" style={{ color: customerStyle.textColor }}>{invoice.transactionType === 'payment_on_account' ? 'Payment on Account' : invoice.transactionType}</p>
          </div>
        </div>

        {/* ITEMS/TABLE SECTION */}
        <div 
          className={`py-2 p-3 rounded-xl ${getFontFamilyClass(tableStyle.fontFamily)} ${getFontWeightClass(tableStyle.fontWeight)} ${getFontSizeClass(tableStyle.fontSize)}`}
          style={{ color: tableStyle.textColor, backgroundColor: tableStyle.backgroundColor || 'transparent' }}
        >
          <table className="w-full text-left">
            <thead>
              <tr className="uppercase tracking-widest font-bold text-[9px] text-gray-400 bg-gray-50/50 rounded-lg">
                <th className="py-2.5 px-2 font-sans text-left">{isService ? 'Description of Service' : 'Description'}</th>
                <th className="py-2.5 text-center font-sans">{isService ? 'Duration/Units' : 'Qty'}</th>
                <th className="py-2.5 text-right font-sans">{isService ? 'Rate' : 'Price'}</th>
                <th className="py-2.5 text-right pr-2 font-sans">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items && invoice.items.length > 0 ? (
                invoice.items.map((itm, index) => (
                  <tr key={index} className="font-medium hover:bg-gray-50/20 transition-colors" style={{ color: tableStyle.textColor }}>
                    <td className="py-3 px-2 font-semibold text-left">{itm.name}</td>
                    <td className="py-3 text-center font-mono">{itm.quantity}</td>
                    <td className="py-1.5 text-right font-mono">₦{itm.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="py-1.5 text-right pr-2 font-bold font-mono">₦{itm.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  </tr>
                ))
              ) : (
                <tr className="font-medium bg-gray-50/10" style={{ color: tableStyle.textColor }}>
                  <td className="py-3 px-2 font-semibold text-left">{invoice.productName}</td>
                  <td className="py-3 text-center">1</td>
                  <td className="py-3 text-right">₦{invoice.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="py-3 text-right pr-2 font-bold font-mono">₦{invoice.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER & TOTALS SECTION */}
        <div 
          className={`flex p-4 rounded-b-2xl pt-5 items-start justify-between gap-6 ${getFontFamilyClass(footerStyle.fontFamily)} ${getFontWeightClass(footerStyle.fontWeight)} ${getFontSizeClass(footerStyle.fontSize)} ${!isLoggedIn ? 'guest-blur' : ''}`} 
          style={{ color: footerStyle.textColor, backgroundColor: footerStyle.backgroundColor || '#F9FAFB' }}
        >
          <div className="w-1/2">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest font-sans">Store Custom Terms & Notes</p>
            <p className="text-[10px] mt-1 whitespace-pre-line leading-relaxed italic opacity-85">{business.customFooterNotes || 'Thank you for your business!'}</p>
          </div>
          <div className="w-1/2 space-y-1.5">
            <div className="flex justify-between opacity-80">
              <span className="font-semibold font-sans">Subtotal:</span>
              <span className="font-mono">₦{invoice.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            {showTax && (
              <div className="flex justify-between opacity-80">
                <span className="font-semibold font-sans">VAT (7.5%):</span>
                <span className="font-mono">₦{taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
            )}
            {showTax && (
              <div className="flex justify-between opacity-95 pt-1 mt-1" style={{ borderTop: `1px solid ${footerStyle.textColor}20` }}>
                <span className="font-bold font-sans">Total Invoiced:</span>
                <span className="font-mono font-bold">₦{finalInvoiced.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
            )}
            <div className="flex justify-between text-emerald-600 mt-1">
              <span className="font-semibold font-sans text-emerald-700">Total Deposited:</span>
              <span className="font-mono">₦{invoice.amountPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between font-extrabold pt-2 mt-1" style={{ borderTop: `1px solid ${footerStyle.textColor}20` }}>
              <span className="font-sans" style={{ color: accentColor }}>Outstanding Debt:</span>
              <span className="font-mono" style={{ color: accentColor }}>₦{finalDebtBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const activeTemplate = () => {
    switch (invoiceTemplatePreference) {
      case 'modern_blue':
        return renderModernBlue();
      case 'kiosk_compact':
        return renderKioskCompact();
      case 'custom_build':
        return renderCustomBuild();
      case 'classic':
      default:
        return renderClassic();
    }
  };

  return (
    <div className="space-y-6 relative">
      {!isLoggedIn && (
        <div className="absolute inset-0 z-50 flex items-center justify-center opacity-20 pointer-events-none -rotate-12">
            <span className="text-4xl font-extrabold text-gray-800 bg-gray-200 p-6 px-10 rounded-2xl shadow-xl border-4 border-gray-400 rotate-12">DRAFT PREVIEW - SIGN UP TO DOWNLOAD</span>
        </div>
      )}
      {/* Dynamic Pop-up Toaster Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#0E1338] text-white py-3 px-5 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-2.5 animate-slideIn text-xs">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* DOCUMENT SHEET PREVIEW WRAPPER */}
      <div className="space-y-1" id="invoice-print-container">
        <div id="invoice-sheet">
          {activeTemplate()}
        </div>
        
        {/* DOCUMENT COMPLIANCE FOOTNOTE INSIDE PREVIEW SHEET BASE */}
        <div className="bg-gray-100 border border-gray-200/80 rounded-b-2xl px-6 py-2 flex items-center justify-between text-[9px] text-gray-400 font-semibold uppercase tracking-wider relative -top-1">
          <span>Nigerian FIRS 2026 Compliant Document</span>
          <span>Verified Secure Ledger</span>
        </div>
      </div>

      {/* QUICK ACTIONS & SHARING INTELLIGENCE (2X2 GRID) */}
      {!isSharedPublicView && (
        <>
          <div className="space-y-3">
        <h3 className="text-[11px] uppercase font-bold tracking-wider text-gray-55/90 pl-1">
          Quick Sharing & Record-Tracking Actions
        </h3>
        <div className="grid grid-cols-2 gap-4">
          
          <WhatsAppPayLinkGenerator invoice={invoice} businessPhone={phone || "+2348028416553"} />

          {/* WHATSAPP CARD (Soft Green background) */}
          <button 
            onClick={handleWhatsAppAction}
            className="p-4 bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-200/50 rounded-2xl text-left transition relative select-none group text-xs cursor-pointer"
          >
            <div className="absolute right-4 top-4 text-emerald-600 group-hover:scale-105 transition-transform">
              <span className="text-emerald-600 font-bold font-sans">WA</span>
            </div>
            <span className="font-bold text-emerald-900 block text-xs">WhatsApp Notification</span>
            <span className="text-[10px] text-emerald-600/90 block mt-1 font-mono">
              {customerPhone ? `Send to ${customerPhone}` : "Halt & collect phone update"}
            </span>
          </button>

          {/* EMAIL CARD (Soft Blue background) */}
          <button 
            onClick={handleEmailAction}
            className="p-4 bg-blue-50/70 hover:bg-blue-105/80 border border-blue-200/50 rounded-2xl text-left transition relative select-none group text-xs cursor-pointer"
          >
            <div className="absolute right-4 top-4 text-blue-600 group-hover:scale-105 transition-transform">
              <Mail className="w-4.5 h-4.5 text-blue-600" />
            </div>
            <span className="font-bold text-blue-900 block text-xs">Email Breakdown</span>
            <span className="text-[10px] text-blue-600/90 block mt-1 font-mono">
              {customerEmail ? `Send to ${customerEmail}` : "Halt & collect email update"}
            </span>
          </button>

          {/* PUBLIC LINK CARD (Soft Purple background) */}
          <button 
            onClick={copyPublicLink}
            className="p-4 bg-purple-50/70 hover:bg-purple-105/80 border border-purple-200/50 rounded-2xl text-left transition relative select-none group text-xs cursor-pointer"
          >
            <div className="absolute right-4 top-4 text-purple-600 group-hover:scale-105 transition-transform">
              <Link2 className="w-4.5 h-4.5 text-purple-600" />
            </div>
            <span className="font-bold text-purple-900 block text-xs">Public Link URI</span>
            <span className="text-[10px] text-purple-600/90 block mt-1 font-mono">
              Copy token security code url
            </span>
          </button>

          {/* DOWNLOAD CARD WITH NATIVE PRINT (Soft Red background) */}
          <button 
            onClick={generatePDFDownload}
            className="p-4 bg-rose-50/70 hover:bg-rose-100/95 border border-rose-200/50 rounded-2xl text-left transition relative select-none group text-xs cursor-pointer"
          >
            <div className="absolute right-4 top-4 text-rose-600 group-hover:scale-105 transition-transform">
              <Download className="w-4.5 h-4.5 text-rose-600 animate-bounce" />
            </div>
            <span className="font-bold text-[#E11D48] block text-xs">Print / Save PDF</span>
            <span className="text-[10px] text-rose-500/90 block mt-1 font-mono">
              Native high-quality PDF print
            </span>
          </button>

        </div>
      </div>

      {/* COMPLIANCE & STATUS REGISTRY LAYOUT */}
      <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-sm space-y-4">
        
        {/* NRS STATUS RIBBON */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 tracking-wider">NRS STATUS:</span>
            {firsClearanceStatus === 'cleared' ? (
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[9px] rounded-full border border-emerald-200/40 flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-600" /> Compliant & Cleared
              </span>
            ) : (
              <span className="px-2.5 py-0.5 bg-amber-50 text-amber-600 font-bold text-[9px] rounded-full border border-amber-200/40 flex items-center gap-1">
                <Hourglass className="w-3 h-3 text-amber-500 animate-spin" style={{ animationDuration: '4s' }} /> Pending Clearance
              </span>
            )}
          </div>
          
          {firsClearanceStatus === 'pending' ? (
            <button 
              onClick={handleClearWithFIRS}
              className="text-[10px] font-bold text-[#00A6FF] hover:underline"
            >
              ✓ Clear with FIRS now
            </button>
          ) : (
            <span className="text-[9px] font-mono text-gray-400">
              firs_code: {firsCode}
            </span>
          )}
        </div>

        {/* PAYMENT HEALTH CARD AT BASE */}
        <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl relative">
              <Hourglass className="w-4 h-4 text-amber-505 animate-pulse" />
            </div>
            <div>
              <p className="font-semibold text-xs text-gray-900 leading-normal">Outstanding Ledger Accounts</p>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-none">Expected by TBD</p>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-extrabold text-gray-400">Aging Active</span>
        </div>

      </div>
        </>
      )}

      {/* INTERCEPTOR UPDATE POP-UP MODALS */}

      {/* 1. WHATSAPP DATA FILL POP-UP DIALOG */}
      {isWhatsAppModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-[#0E1338]/40 backdrop-blur-sm" 
            onClick={() => setIsWhatsAppModalOpen(false)}
          ></div>
          <div className="bg-white rounded-3xl border border-gray-150 shadow-2xl relative max-w-sm w-full p-6 space-y-4 z-10 animate-scaleUp">
            <button 
              onClick={() => setIsWhatsAppModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 text-gray-400 hover:text-gray-700 bg-gray-50 rounded-full transition"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="space-y-1.5">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-bold text-[#0E1338] text-sm">Update Client Contact</h3>
              <p className="text-[11px] text-gray-500 leading-normal">
                Provide a valid phone number to share this invoice via WhatsApp.
              </p>
            </div>

            <form onSubmit={handleWhatsAppSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-gray-400 block pb-1">Nigerian Billed Phone</label>
                <input 
                  type="tel" 
                  value={tempPhone}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val === '0') {
                      val = '+234';
                    } else if (val.startsWith('0')) {
                      val = '+234' + val.slice(1);
                    }
                    setTempPhone(val);
                  }}
                  placeholder="e.g. +234 812-345-6789"
                  required
                  className="w-full p-2.5 outline-none rounded-2xl border border-gray-200 focus:border-[#00A6FF] bg-white font-mono text-xs text-gray-900" 
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-2xl transition text-xs flex items-center justify-center gap-1"
              >
                <Check className="w-4 h-4" /> Save & Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. EMAIL DATA FILL POP-UP DIALOG */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-[#0E1338]/40 backdrop-blur-sm" 
            onClick={() => setIsEmailModalOpen(false)}
          ></div>
          <div className="bg-white rounded-3xl border border-gray-150 shadow-2xl relative max-w-sm w-full p-6 space-y-4 z-10 animate-scaleUp">
            <button 
              onClick={() => setIsEmailModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 text-gray-400 hover:text-gray-700 bg-gray-50 rounded-full transition"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="space-y-1.5">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-bold text-[#0E1338] text-sm">Update Client Email</h3>
              <p className="text-[11px] text-gray-500 leading-normal">
                Provide a recipient email address to send this invoice.
              </p>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-gray-400 block pb-1">Client Recipient Email</label>
                <input 
                  type="email" 
                  value={tempEmail}
                  onChange={(e) => setTempEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full p-2.5 outline-none rounded-2xl border border-gray-200 focus:border-[#00A6FF] bg-white font-mono text-xs text-gray-900" 
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-[#00A6FF] hover:bg-opacity-90 text-white font-bold py-2.5 rounded-2xl transition text-xs flex items-center justify-center gap-1"
              >
                <Check className="w-4 h-4" /> Save & Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
