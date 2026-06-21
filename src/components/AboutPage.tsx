import React from 'react';
import { ChevronRight, ArrowLeft, ShieldCheck, Sparkles, WifiOff, BellRing, ClipboardList, Store } from 'lucide-react';

interface AboutPageProps {
  onNavigate: (screen: 'landing' | 'login' | 'terms' | 'dashboard') => void;
  isAuthenticated: boolean;
}

export default function AboutPage({ onNavigate, isAuthenticated }: AboutPageProps) {
  const features = [
    {
      name: "Intelligent AI Invoicing (Fuse Mode)",
      guest: "Up to 2 Trial compiles (Local PDF)",
      merchant: "Unlimited structured AI parses",
      status: "pro-only"
    },
    {
      name: "Standard Manual Compilers",
      guest: "✅ Included (PDF exports)",
      merchant: "✅ Unlimited journal entries",
      status: "both"
    },
    {
      name: "Offline Ledger Synchronization",
      guest: "❌ No local persistence",
      merchant: "✅ Offline cache + cloud sync",
      status: "pro-only"
    },
    {
      name: "WhatsApp Outstanding Debtors Notices",
      guest: "❌ Download templates only",
      merchant: "✅ Direct automated action prompts",
      status: "pro-only"
    },
    {
      name: "Inventory stock alarms",
      guest: "❌ Not active",
      merchant: "✅ Real-time quantity warnings",
      status: "pro-only"
    },
    {
      name: "Cashier Terminal Mode (SafeGuard)",
      guest: "❌ Owner only",
      merchant: "✅ 4-Digit PIN Lock for clerks",
      status: "pro-only"
    }
  ];

  return (
    <div className="space-y-10 animate-fadeIn min-h-screen">
      {isAuthenticated ? (
        /* ================= AUTHENTICATED MERCHANT VIEW ================= */
        <div className="space-y-10">
          {/* Main Hero Banner */}
          <div className="bg-white rounded-[32px] p-8 md:p-12 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
            <div className="max-w-3xl space-y-6">
              <span className="px-3 py-1 bg-[#00A6FF]/10 text-[#00A6FF] rounded-full text-[10px] font-extrabold uppercase tracking-widest">
                YOUR MERCHANT OPERATIONS
              </span>
              <h1 className="text-3xl md:text-4xl font-serif font-black text-[#0E1338] tracking-tight">
                Optimized Ledger Synchronization
              </h1>
              <p className="text-gray-500 text-sm md:text-base leading-relaxed">
                You are running a professional merchant ledger. Your account is synchronized with enterprise-grade cloud persistence and SafeGuard security protocols.
              </p>
            </div>
          </div>

          {/* Premium Technical Pillars */}
          <div className="space-y-6">
            <h2 className="text-sm font-display font-semibold uppercase tracking-wider text-[#0E1338]">
              Premium Technical Pillars
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-5 bg-white rounded-2xl shadow-sm border border-gray-100 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#00A6FF]/10 text-[#00A6FF] flex items-center justify-center shrink-0">
                  <Sparkles size={20} />
                </div>
                <h3 className="font-bold text-[#0E1338] text-xs uppercase tracking-wider">✨ AI-Powered Intelligence</h3>
                <p className="text-gray-500 text-xs leading-relaxed">
                  Allows voice annotation commands, invoice snaps, and unstructured ledger text to be instantly parsed and structured. Integrated directly with standard parameters, mapping customers, prices, and quantities in real-time.
                </p>
              </div>

              <div className="p-5 bg-white rounded-2xl shadow-sm border border-gray-100 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                  <WifiOff size={20} />
                </div>
                <h3 className="font-bold text-[#0E1338] text-xs uppercase tracking-wider">🌐 Offline Protection Layer</h3>
                <p className="text-gray-500 text-xs leading-relaxed">
                  Through offline heuristics monitored with <code>navigator.onLine</code>, Yeedem Books locks automatic tabs, preventing connection failures while routing transactions through the classic manual styled backup container.
                </p>
              </div>

              <div className="p-5 bg-white rounded-2xl shadow-sm border border-gray-100 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                  <BellRing size={20} />
                </div>
                <h3 className="font-bold text-[#0E1338] text-xs uppercase tracking-wider">🚨 Inventory Stock Alarms</h3>
                <p className="text-gray-500 text-xs leading-relaxed">
                  Automatic warning signals flash whenever a product’s count drops below critical levels (under 5 units). Merchants can immediately trigger replenishment runs with a single tap.
                </p>
              </div>

              <div className="p-5 bg-white rounded-2xl shadow-sm border border-gray-100 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center shrink-0">
                  <ClipboardList size={20} />
                </div>
                <h3 className="font-bold text-[#0E1338] text-xs uppercase tracking-wider">📝 Credit Aging Ledger</h3>
                <p className="text-gray-500 text-xs leading-relaxed">
                  Seamlessly computes active debt balances, schedules automatic notifications for overdue credits, and customizes printable invoices to fit client requirements.
                </p>
              </div>
            </div>
          </div>

          {/* Feature Matrix */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
            <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-[#0E1338] mb-6">
              Feature Matrix (Pro Merchant)
            </h2>
            <div className="overflow-x-auto text-xs text-gray-700">
              <table className="w-full text-left font-sans">
                <thead>
                  <tr className="border-b font-semibold text-gray-400 uppercase tracking-wide text-[10px]">
                    <th className="py-2.5 pb-4">Feature</th>
                    <th className="py-2.5 pb-4">Trial</th>
                    <th className="py-2.5 pb-4">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((f, idx) => (
                    <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                      <td className="py-4 font-semibold text-gray-850">{f.name}</td>
                      <td className="py-4 text-gray-500">{f.guest}</td>
                      <td className="py-4 text-[#0E1338] font-bold">{f.merchant}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Button for Authenticated Merchants only */}
          <div className="flex items-center justify-center pt-4 pb-8">
            <button
              onClick={() => onNavigate('dashboard')}
              className="px-6 py-3 bg-[#0A101D] hover:bg-[#121c33] text-white text-xs font-bold rounded-xl transition shadow-md flex items-center gap-2"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      ) : (
        /* ================= UNAUTHENTICATED GUEST VIEW ================= */
        <div className="space-y-10">
          {/* Main Hero Banner */}
          <div className="bg-white rounded-[32px] p-8 md:p-12 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
            <div className="max-w-3xl space-y-6">
              <span className="px-3 py-1 bg-[#00A6FF]/10 text-[#00A6FF] rounded-full text-[10px] font-extrabold uppercase tracking-widest">
                OUR MISSION & VISION
              </span>
              <h1 className="text-3xl md:text-4xl font-serif font-black text-[#0E1338] tracking-tight">
                Seamless Bookkeeping Built Specially for Nigerian Merchants
              </h1>
              <p className="text-gray-500 text-sm md:text-base leading-relaxed">
                Yeedem Books is designed to completely replace complex accounting software for market traders, food staple wholesalers, independent artisans, and local supermarkets. By omitting cluttered multi-step ledger entries, we offer a clean, plain-text environment where anyone can manage business operations in seconds.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left pt-6">
                <div className="p-4 bg-gray-50 rounded-2xl flex items-start gap-4 border border-gray-100">
                  <div className="w-10 h-10 rounded-xl bg-[#00A6FF]/10 text-[#00A6FF] flex items-center justify-center shrink-0">
                    <Store size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#0E1338] text-xs">For Retailers & Traders</h3>
                    <p className="text-gray-400 text-[11px] leading-relaxed mt-1">
                      Empower cashier attendants to log transactions immediately without risk of visual ledger tampering.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl flex items-start gap-4 border border-gray-100">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#0E1338] text-xs">Secure Local Access</h3>
                    <p className="text-gray-400 text-[11px] leading-relaxed mt-1">
                      Enforce active workstation limits and secure master codes to prevent staff from viewing wholesale profit summaries.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Simplified Features Summary for guests */}
          <div className="bg-white rounded-[24px] p-8 shadow-sm border border-gray-100 space-y-6">
            <h2 className="text-sm font-[#0E1338] font-bold uppercase tracking-wider">
              Platform Features Overview
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-gray-550">
              <div className="space-y-1">
                <h4 className="font-bold text-gray-800">1. Instant PDF Export</h4>
                <p className="text-[11px]">Compile guest invoices and download standard high-fidelity receipt templates immediately.</p>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-gray-800">2. Customer List & Contact</h4>
                <p className="text-[11px]">Log active clients and draft automated WhatsApp reminders manually.</p>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-gray-800">3. SafeGuard PIN Security</h4>
                <p className="text-[11px]">Setup dual access PINs for secure cash registers and workstation lockers.</p>
              </div>
            </div>
          </div>

          {/* Actions at the bottom of the content block */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-xl mx-auto pt-4 pb-8 bg-gray-50/50 rounded-2xl p-4 border border-gray-100">
            <button
              onClick={() => onNavigate('landing')}
              className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-[#0E1338] flex items-center gap-1.5 hover:underline transition"
            >
              <ArrowLeft size={14} /> Back to Homepage
            </button>
            <button
              onClick={() => onNavigate('login')}
              className="px-5 py-2.5 bg-[#00A6FF] hover:bg-opacity-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm"
            >
              Create Free Account / Sign In <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
