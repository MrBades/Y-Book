import React, { useState } from 'react';
import { generateInvoicePDF } from '../lib/pdfGenerator';
import { BusinessProfile } from '../types';
import { ArrowLeft, Sparkles, HelpCircle, FileText } from 'lucide-react';
import SmartWidget from './SmartWidget';

export default function GuestInvoiceGenerator({ onFinish, onLimitReached, deviceFingerprint, isAuthenticated }: { onFinish: () => void, onLimitReached: () => void, deviceFingerprint: string, isAuthenticated: boolean }) {
  const [trialBusinessName, setTrialBusinessName] = useState('');
  const [trialPhone, setTrialPhone] = useState('');
  const [trialAddress, setTrialAddress] = useState('');

  const handleSaveTrialInvoice = (parsedInvoice: any) => {
    if (!isAuthenticated) {
      alert("Please log in to generate and download invoices.");
      // Explicitly clear guest state before redirecting
      setTrialBusinessName('');
      setTrialPhone('');
      setTrialAddress('');
      onLimitReached(); // Or redirect to login
      return;
    }
    const business: BusinessProfile = {
      businessName: trialBusinessName.trim() || 'YOUR BUSINESS NAME (TRIAL)',
      phone: trialPhone.trim() || '080-XXXXXXXX',
      address: trialAddress.trim() || 'Your Shop Address',
      invoiceTemplatePreference: 'modern_blue',
      businessLogo: '',
      customAccentColor: '#00A6FF',
      customFontSize: 'md',
      customFontFamily: 'sans',
      customShowLogo: false,
      customHeaderTitle: 'DEMO TRIAL INVOICE',
      customFooterNotes: 'This document acts as an immediate trial compiling copy.',
      customShadowStyle: 'sm'
    };

    const invoice = {
      id: 'TRIAL-' + Date.now().toString().slice(-4),
      customerName: parsedInvoice.customerName || 'Walk-in Customer',
      productName: parsedInvoice.productName || 'General Commodity',
      items: parsedInvoice.items || [],
      totalAmount: parsedInvoice.totalAmount,
      amountPaid: parsedInvoice.amountPaid,
      debtBalance: parsedInvoice.debtBalance,
      transactionType: parsedInvoice.transactionType || 'sale',
      createdAt: new Date().toISOString()
    };

    // Fallback item if empty
    if (invoice.items.length === 0) {
      invoice.items = [{
        name: parsedInvoice.productName || 'General Commodity',
        quantity: 1,
        price: parsedInvoice.totalAmount,
        total: parsedInvoice.totalAmount
      }];
    }

    generateInvoicePDF(invoice, business, [], true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">

      <main className="flex-grow p-2 flex flex-col items-center">
        <div className="max-w-3xl w-full">
            
            {/* Unified Smart Invoice Arena Container (Card-based layout) */}
            <div className="bg-white rounded-[32px] p-4 md:p-6 shadow-sm border border-gray-150 space-y-4">
              
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-2">
                <div>
                  <span className="px-2.5 py-0.5 bg-indigo-50 text-[#00A6FF] rounded-full text-[9px] font-extrabold uppercase tracking-wide border border-blue-100">
                    ⚡ LIVE INTERACTIVE SANDBOX
                  </span>
                  <h2 className="text-md sm:text-lg font-bold text-[#0E1338] mt-1">Smart Invoice Engine (Fuse Mode)</h2>
                </div>
                <span className="text-[10px] text-gray-400 italic">2 Free Trials Remaining</span>
              </div>
              
              <div className="text-gray-600 text-xs py-1 leading-relaxed">
                Test the live compiler below! Type an order query (e.g., <span className="font-mono text-blue-600 font-bold bg-blue-50 px-1 py-0.5 rounded">6 sacks of flour to Alao for 32k each, paid 120k</span>) or click the <span className="font-bold text-[#0E1338]">Manual</span> tab to input details manually. Click "Commit Ledger" to instantly download your trial receipt.
              </div>

              {/* Premium Interactive Formats Guide Banner */}
              <div className="bg-[#FAF9FF] rounded-[24px] p-4.5 border border-indigo-100 space-y-3 mt-1 text-left">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#00A6FF]" />
                  <h3 className="text-xs font-bold text-[#0E1338] uppercase tracking-wider">
                    Expected AI Input Format & Examples
                  </h3>
                </div>
                <p className="text-gray-500 text-[11px] leading-relaxed">
                  Our advanced natural language engine structures loose text data on the fly. Format your inputs using these standard billing patterns to ensure accurate automatic invoice parsing:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  
                  <div className="bg-white p-3.5 rounded-xl border border-gray-100 flex flex-col justify-between shadow-sm">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00A6FF]"></span>
                        <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">Single Item Invoice Structure</span>
                      </div>
                      <p className="text-[11px] text-gray-600 bg-gray-50/50 p-2.5 rounded-lg font-mono border border-gray-100 break-words leading-relaxed">
                        "sold to Baba: 15 bags of cement at 8500 each, paid 100000"
                      </p>
                    </div>
                    <div className="mt-2 text-[9.5px] text-gray-400">
                      Perfect for immediate, high-speed wholesale transactions.
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-gray-100 flex flex-col justify-between shadow-sm">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">Line-by-Line Multi-Item List</span>
                      </div>
                      <p className="text-[11px] text-gray-600 bg-gray-50/50 p-2.5 rounded-lg font-mono border border-gray-100 whitespace-pre-line leading-relaxed">
                        {`customer: John Obi\n5 bags of corn at 25000\n2 packs of sugar at 15000\npaid 100000`}
                      </p>
                    </div>
                    <div className="mt-2 text-[9.5px] text-gray-400">
                      Allows recording complex multiple line-items in a single entry.
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-gray-100 flex flex-col justify-between md:col-span-2 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <HelpCircle className="w-3.5 h-3.5 text-[#00A6FF]" />
                      <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">AI Expected Data Structure Indicators:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10.5px] text-gray-600 leading-normal">
                      <div className="bg-slate-50/70 p-2.5 rounded-xl border border-gray-100">
                        <strong className="text-[#0E1338] block mb-0.5 font-bold">👤 1. Recipient Name</strong>
                        Introduce customer entities using keyword flags: <code className="bg-white px-1 border rounded text-[#00A6FF] font-semibold text-[9.5px]">customer:</code>, <code className="bg-white px-1 border rounded text-[#00A6FF] font-semibold text-[9.5px]">sold to:</code>, or <code className="bg-white px-1 border rounded text-[#00A6FF] font-semibold text-[9.5px]">to [Name]:</code>.
                      </div>
                      <div className="bg-slate-50/70 p-2.5 rounded-xl border border-gray-100">
                        <strong className="text-[#0E1338] block mb-0.5 font-bold">📦 2. Items & Quantity</strong>
                        Mention quantities, item names and unit price details clearly with: <code className="bg-white px-1 border rounded text-indigo-600 font-semibold text-[9.5px]">at [price] each</code> or <code className="bg-white px-1 border rounded text-indigo-600 font-semibold text-[9.5px]">for [price] each</code>.
                      </div>
                      <div className="bg-slate-50/70 p-2.5 rounded-xl border border-gray-100">
                        <strong className="text-[#0E1338] block mb-0.5 font-bold">💳 3. Payment Status</strong>
                        Track amounts settled by specifying paying actions: <code className="bg-white px-1 border rounded text-emerald-600 font-semibold text-[9.5px]">paid [amount]</code>, <code className="bg-white px-1 border rounded text-emerald-600 font-semibold text-[9.5px]">deposited [amount]</code>, or <code className="bg-white px-1 border rounded text-emerald-600 font-semibold text-[9.5px]">balance</code>.
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Dynamic Context Form for Business Profile Customization */}
              <div className="bg-[#F8FAFC] p-5 rounded-2xl border border-gray-150 space-y-3 mt-2 text-left">
                <h3 className="text-[11px] font-bold text-[#0E1338] uppercase tracking-wider flex items-center gap-1.5 justify-start">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                  Enter Your Company Details (Trial Invoice Headers)
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-gray-400 mb-1 tracking-wider">Business Name</label>
                    <input 
                      type="text" 
                      value={trialBusinessName} 
                      onChange={e => setTrialBusinessName(e.target.value)} 
                      placeholder="e.g. ALABA FLOUR DEPOT" 
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#00a6ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-black text-gray-400 mb-1 tracking-wider">Phone Number</label>
                    <input 
                      type="text" 
                      value={trialPhone} 
                      onChange={e => setTrialPhone(e.target.value)} 
                      placeholder="e.g. +234 812-345-6789" 
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#00a6ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-black text-gray-400 mb-1 tracking-wider">Location Address</label>
                    <input 
                      type="text" 
                      value={trialAddress} 
                      onChange={e => setTrialAddress(e.target.value)} 
                      placeholder="e.g. Shop 4, SME Complex, Lagos" 
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#00a6ff]"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 leading-snug">
                  * The dynamic details typed above will instantly overwrite the default layout template headers on your compiled PDF.
                </p>
              </div>

              <div id="smart-widget" className="pt-2">
                <SmartWidget onSaveParsedInvoice={handleSaveTrialInvoice} isInvoice={true} />
              </div>
            </div>
        </div>
      </main>
      
    </div>
  );
}
