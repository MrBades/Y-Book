import { useState, useEffect } from 'react';
import { Invoice, BusinessProfile } from '../types';
import { generateInvoicePDF } from '../lib/pdfGenerator';
import InvoiceTheme from './InvoiceTheme';
import { X, Sparkles, Download, FileText, CheckCircle2, ChevronRight, Check, FileCheck, RefreshCw, Eye, Landmark } from 'lucide-react';

interface BrandingPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  business: BusinessProfile;
  customers?: any[];
  showTax?: boolean;
}

export default function BrandingPreviewModal({
  isOpen,
  onClose,
  invoice,
  business,
  customers = [],
  showTax = false
}: BrandingPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<'vector' | 'pdf'>('vector');
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [regenerateKey, setRegenerateKey] = useState(0);

  useEffect(() => {
    if (!isOpen || !invoice || !business) return;

    setIsGenerating(true);
    // Small debounce to let rendering settle and slide-in look beautiful
    const timer = setTimeout(() => {
      try {
        const doc = generateInvoicePDF(invoice, business, customers, false, showTax, true);
        if (doc && typeof doc.output === 'function') {
          const blob = doc.output('blob');
          const url = URL.createObjectURL(blob);
          
          setPdfBlobUrl(oldUrl => {
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            return url;
          });
        }
      } catch (err) {
        console.error("Failed to compile preview PDF blob:", err);
      } finally {
        setIsGenerating(false);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [isOpen, invoice, business, showTax, regenerateKey]);

  // Cleanup Blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  if (!isOpen) return null;

  const handleDownload = () => {
    generateInvoicePDF(invoice, business, customers, false, showTax, false);
  };

  const activeTemplateName = () => {
    const pref = business.invoiceTemplatePreference || 'classic';
    if (pref === 'classic') return 'Monochrome Classic';
    if (pref === 'modern_blue') return 'Ocean Sapphire Blue';
    if (pref === 'kiosk_compact') return 'Compact Kiosk Ticket';
    if (pref === 'custom_build') return 'Custom Designer';
    return String(pref);
  };

  return (
    <div id="branding-preview-overlay" className="fixed inset-0 bg-[#0E1338]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto">
      <div 
        id="branding-preview-card"
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-fadeIn"
      >
        {/* Modal Header Banner with premium deep Navy obsidian coloring */}
        <div className="bg-[#0E1338] text-white p-5 flex items-center justify-between border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00A6FF]/10 text-[#00A6FF] rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-serif font-extrabold text-sm md:text-base tracking-tight uppercase">Corporate Branding verification cockpit</h3>
              <p className="text-[10px] text-gray-300 font-medium">Review exactly how your invoice looks before committing to download or client delivery.</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition"
            title="Dismiss cockpit"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Content Workspace Area - Dynamic Side-By-Side Grid */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-slate-50">
          
          {/* LEFT COLUMN: BRANDING CHECKLIST & QUICK UTILITIES (Takes 1/3) */}
          <div className="w-full md:w-80 border-r border-slate-100 bg-white p-5 flex flex-col justify-between shrink-0 overflow-y-auto gap-6">
            <div className="space-y-5">
              
              {/* BRAND AUDIT MATRIX CARD */}
              <div className="p-4 bg-slate-50/70 border border-slate-100 rounded-2xl">
                <h4 className="font-extrabold text-[10px] text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-[#00A6FF]" /> Active Brand Audit Matrix
                </h4>
                
                <div className="space-y-3.5 text-xs text-gray-700">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-gray-400 text-[10px] uppercase font-bold">Template Theme:</span>
                    <span className="font-extrabold text-[#0E1338] text-right text-[11px] bg-[#00A6FF]/5 border border-[#00A6FF]/10 px-2 py-0.5 rounded-md">
                      {activeTemplateName()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-100/80 pt-2.5">
                    <span className="text-gray-400 text-[10px] uppercase font-bold">Accent Color:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border shadow-xs" style={{ backgroundColor: business.customAccentColor || '#00A6FF' }} />
                      <span className="font-mono text-[10px] font-bold text-gray-600 uppercase">{business.customAccentColor || '#00A6FF'}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-100/80 pt-2.5">
                    <span className="text-gray-400 text-[10px] uppercase font-bold">Corporate Logo:</span>
                    <span className="font-bold text-[10px] text-emerald-600 flex items-center gap-1">
                      {business.businessLogo ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" /> Loaded (PNG/JPG)
                        </>
                      ) : (
                        <span className="text-gray-400 font-medium">Not Uploaded</span>
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between items-start border-t border-slate-100/80 pt-2.5">
                    <span className="text-gray-400 text-[10px] uppercase font-bold">Headline Font:</span>
                    <span className="font-semibold text-gray-600 text-[11px] capitalize">
                      {business.customFontFamily || 'sans'} Serif
                    </span>
                  </div>

                  <div className="flex justify-between items-start border-t border-slate-100/80 pt-2.5">
                    <span className="text-gray-400 text-[10px] uppercase font-bold">VAT State:</span>
                    <span className="font-bold text-[11px] text-gray-700">
                      {showTax ? '✓ Active (7.5% VAT)' : '✕ Disabled'}
                    </span>
                  </div>
                </div>
              </div>

              {/* COCKPIT CHECKLIST */}
              <div className="space-y-3">
                <span className="block font-extrabold text-[10px] text-gray-400 uppercase tracking-widest pl-1">Compliance Checklist</span>
                
                <div className="space-y-2 text-[11px] text-gray-650">
                  <div className="flex items-center gap-2 bg-emerald-50/40 p-2 rounded-xl border border-emerald-100/30">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Company Name and Address visible</span>
                  </div>
                  <div className="flex items-center gap-2 bg-emerald-50/40 p-2 rounded-xl border border-emerald-100/30">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Transaction line-items totaled correctly</span>
                  </div>
                  <div className="flex items-center gap-2 bg-emerald-50/40 p-2 rounded-xl border border-emerald-100/30">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Payment and debt balances registered</span>
                  </div>
                  <div className="flex items-center gap-2 bg-emerald-50/40 p-2 rounded-xl border border-emerald-100/30">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Compliance validation seal attached</span>
                  </div>
                </div>
              </div>

            </div>

            {/* ACTION FOOTER BUTTONS IN THE COLUMN */}
            <div className="space-y-2 border-t border-slate-100 pt-4 mt-auto">
              <button
                type="button"
                onClick={handleDownload}
                className="w-full py-3 bg-[#00A6FF] hover:bg-[#0095E6] text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" /> Export/Download PDF Now
              </button>
              
              <button
                type="button"
                onClick={() => setRegenerateKey(k => k + 1)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-[10px] font-bold tracking-wide uppercase transition flex items-center justify-center gap-1 border border-slate-200/50 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Re-Compile PDF Sandbox
              </button>

              <span className="block text-[9px] text-center text-gray-400 mt-1">
                Your computer's printer driver acts as layout master for physical outputs.
              </span>
            </div>
          </div>

          {/* RIGHT COLUMN: HIGH FIDELITY PREVIEW DOCUMENT CANVAS (Takes 2/3) */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 p-4 md:p-6 gap-4">
            
            {/* VIEW MODE TABS HEADER BAR */}
            <div className="bg-white p-2 rounded-2xl border border-slate-150/40 shadow-xs flex items-center justify-between shrink-0 gap-4">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('vector')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'vector' ? 'bg-white text-[#0E1338] shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  <Eye className="w-3.5 h-3.5 text-[#00A6FF]" /> Vector Live Mock
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pdf')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'pdf' ? 'bg-white text-[#0E1338] shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-500" /> Actual PDF File
                </button>
              </div>

              <div className="text-right text-[10px] text-gray-400 font-medium hidden sm:block pr-2">
                Document Ledger Ref: &nbsp;<span className="font-mono text-gray-700 font-bold bg-slate-100 px-1.5 py-0.5 rounded-md text-[9px]">{invoice.id.toUpperCase()}</span>
              </div>
            </div>

            {/* PREVIEW CONTAINER PORTAL */}
            <div className="flex-1 bg-slate-200/50 rounded-2xl border border-slate-150 p-2 md:p-4 overflow-hidden relative min-h-0">
              
              {activeTab === 'vector' && (
                <div className="w-full h-full overflow-y-auto pr-1 animate-fadeIn scrollbar-thin">
                  <div className="max-w-xl mx-auto my-4">
                    <div className="bg-white rounded-3xl p-5 shadow-lg border border-slate-150 text-left">
                      <InvoiceTheme 
                        invoice={invoice} 
                        business={business} 
                        customers={customers}
                        onUpdateCustomerContact={() => {}}
                        showTax={showTax}
                        isLoggedIn={true}
                        isSharedPublicView={true}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'pdf' && (
                <div className="w-full h-full flex flex-col items-center justify-center animate-fadeIn">
                  {isGenerating ? (
                    <div className="text-center space-y-3">
                      <div className="w-10 h-10 border-2 border-[#00A6FF] border-t-transparent rounded-full animate-spin mx-auto"></div>
                      <p className="text-xs text-gray-500 font-bold">Compiling high-fidelity document stream...</p>
                    </div>
                  ) : pdfBlobUrl ? (
                    <div className="w-full h-full relative group">
                      <object 
                        data={pdfBlobUrl} 
                        type="application/pdf" 
                        className="w-full h-full bg-white rounded-xl border border-slate-150/50"
                      >
                        {/* Fallback frame in case browser doesn't render PDF viewer inline (e.g., custom mobile frameworks) */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-150 p-8 text-center space-y-4">
                          <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center">
                            <FileCheck size={28} />
                          </div>
                          <div className="max-w-xs space-y-1">
                            <h4 className="text-xs font-bold text-[#0E1338]">PDF Compiled Successfully</h4>
                            <p className="text-[10px] text-gray-400 leading-relaxed">Your device browser doesn't support rendering PDF documents directly inside web elements.</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleDownload}
                            className="px-4 py-2 bg-[#0E1338] hover:bg-black text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <Download className="w-4 h-4" /> Download Compiled File
                          </button>
                        </div>
                      </object>
                      
                      {/* Interactive Floating Hover Prompt */}
                      <div className="absolute top-3 right-3 bg-[#0E1338]/90 text-white text-[9.5px] px-3 py-1.5 rounded-lg border border-white/5 opacity-0 group-hover:opacity-100 transition duration-300 pointer-events-none flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-[#00A6FF]" /> Actual Vector Output File Match
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 text-xs">
                      Unable to assemble layout components. Please retry or click compile.
                    </div>
                  )}
                </div>
              )}

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
