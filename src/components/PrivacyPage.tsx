import React from 'react';
import { ArrowLeft, Shield, ChevronRight } from 'lucide-react';

interface PrivacyPageProps {
  onNavigate: (screen: 'landing' | 'login' | 'about' | 'dashboard') => void;
  isAuthenticated: boolean;
}

export default function PrivacyPage({ onNavigate, isAuthenticated }: PrivacyPageProps) {
  return (
    <div className="space-y-10 animate-fadeIn max-w-4xl mx-auto min-h-screen">
      {/* Visual Title Header */}
      <div className="bg-white rounded-[32px] p-8 md:p-12 shadow-sm border border-gray-100 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <Shield size={24} />
          </div>
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest bg-emerald-50 border border-emerald-100 text-emerald-600">
              PRIVACY COMPLIANCE WRITINGS
            </span>
            <h1 className="text-2xl font-serif font-black text-[#0E1338] tracking-tight mt-1">
              Privacy Policy & Ledger Protection
            </h1>
          </div>
        </div>

        <p className="text-gray-400 text-xs italic">
          Last revised: May 23, 2026. {isAuthenticated ? 'Enterprise Merchant Data Policy' : 'Guest Mode Compliance Policy'}
        </p>

        <div className="border-t border-gray-100 pt-6 text-gray-655 text-xs md:text-sm space-y-6 leading-relaxed">
          {isAuthenticated ? (
            /* ================= MERCHANT ENTERPRISE PRIVACY COMPLIANCE (6 CLAUSES) ================= */
            <div className="space-y-6">
              <section className="space-y-2">
                <h2 className="font-bold text-[#0E1338] text-sm flex items-center gap-2">
                  <span className="text-emerald-500 font-black">1.</span> SafeGuard Ledger & Password Cryptography
                </h2>
                <p className="text-gray-500 text-xs md:text-sm">
                  Business parameters, debt schedules, and customer ledger details are encrypted and stored within high-availability firewalls. Staff clerk workstation operations utilize a robust sandboxing pattern to isolate clerk data entries, preventing standard horizontal data privilege escalation.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="font-bold text-[#0E1338] text-sm flex items-center gap-2">
                  <span className="text-emerald-500 font-black">2.</span> PII Isolation (Personally Identifiable Information)
                </h2>
                <p className="text-gray-500 text-xs md:text-sm">
                  Your debtors' and clients' phone numbers are isolated and never traded or processed for marketing campaigns. We strictly serve as a data processor for your enterprise. All ledger reports shared via WhatsApp are directed explicitly through standard client APIs without traversing intermediate unsecured metadata servers.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="font-bold text-[#0E1338] text-sm flex items-center gap-2">
                  <span className="text-emerald-500 font-black">3.</span> Automated Encrypted Cloud Backups
                </h2>
                <p className="text-gray-500 text-xs md:text-sm">
                  Our cloud database leverages real-time synchronization with modern protocols. High-frequency automated backups ensure that if a merchant's physical smartphone is lost, hardware-damaged, or replaced, re-authenticating with the secure active phone number restores 100% of the ledger catalogs instantly.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="font-bold text-[#0E1338] text-sm flex items-center gap-2">
                  <span className="text-emerald-500 font-black">4.</span> FIRS and Compliance Auditability
                </h2>
                <p className="text-gray-500 text-xs md:text-sm">
                  Financial tax summaries and receipt clearance formats remain strictly accessible to the logged-in merchant. We do not transmit tax entries or trade logs to third-party or government clearance repositories. Ledger data acts exclusively as internal business record tracking unless explicitly exported by the executive manager.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="font-bold text-[#0E1338] text-sm flex items-center gap-2">
                  <span className="text-emerald-500 font-black">5.</span> Data Erasure and Purge Entitlements
                </h2>
                <p className="text-gray-500 text-xs md:text-sm">
                  Merchants possess complete, zero-friction entitlements to fully wipe their operational database and ledger logs. You can utilize the manual purge controls in Merchant Settings to perform immediate hard-delete operations that wipe all information from active memory lines instantly.
                </p>
              </section>
            </div>
          ) : (
            /* ================= GUEST PRIVACY COMPLIANCE ================= */
            <div className="space-y-6">
              <section className="space-y-2">
                <h2 className="font-bold text-[#0E1338] text-sm flex items-center gap-2">
                  <span className="text-emerald-500 font-black">1.</span> Ephemeral Local Fingerprint Scoping
                </h2>
                <p className="text-gray-500 text-xs md:text-sm">
                  We verify guest sessions using high-speed hardware fingerprinting without collecting names, emails, or cell numbers. This lets you pilot trial templates instantly while maintaining 100% anonymous identity profiling.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="font-bold text-[#0E1338] text-sm flex items-center gap-2">
                  <span className="text-emerald-500 font-black">2.</span> Cookies and Ephemeral Memory Protection
                </h2>
                <p className="text-gray-500 text-xs md:text-sm">
                  Guest transaction parameters are strictly pinned and isolated to the active physical browser. No copies are transmitted over outer networks or backed up online. We recommend upgrading to a verified profile if secure multi-device ledger capabilities are needed.
                </p>
              </section>
            </div>
          )}
        </div>
      </div>

      {/* Static banner element at the end of text */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-xl mx-auto pt-4 pb-8 bg-gray-50/50 rounded-2xl p-4 border border-gray-100">
        <button
          onClick={() => onNavigate('landing')}
          className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-[#0E1338] flex items-center gap-1.5 hover:underline transition font-sans"
        >
          <ArrowLeft size={14} /> See Marketplace
        </button>

        {!isAuthenticated && (
          <button
            onClick={() => onNavigate('login')}
            className="px-5 py-2.5 bg-[#00A6FF] hover:bg-opacity-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm"
          >
            Sign In / Register <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
