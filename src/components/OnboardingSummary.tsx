import { useState } from 'react';
import { 
  User, 
  Building, 
  KeyRound, 
  MapPin, 
  Phone, 
  Briefcase, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  Calendar, 
  ShieldAlert, 
  Tv, 
  CloudLightning 
} from 'lucide-react';
import { BusinessProfile } from '../types';

interface OnboardingSummaryProps {
  username: string; // CEO Name
  email: string;    // Registered Phone or Email
  business?: BusinessProfile;
  ownerPin?: string;
  verification_skipped?: boolean;
  skippedOnboarding?: boolean;
}

export default function OnboardingSummary({ username, email, business, ownerPin, verification_skipped = false, skippedOnboarding = false }: OnboardingSummaryProps) {
  const [showPin, setShowPin] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  if (!business) return null;

  const bName = business.businessName || "My Business Ledger";
  const bType = business.businessType || 'buy_and_sell';
  const bAddress = business.address || 'No Trading Address specified during onboarding';
  const bPhone = business.phone || email || 'No separate storefront telephone specified';
  const bTemplate = business.invoiceTemplatePreference || 'modern_blue';
  
  // Clean generated shop slug representation
  const shopSlug = bName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  return (
    <div id="onboarding-summary-container" className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden transition-all duration-300">
      
      {/* Header Banner */}
      <div 
        className="p-5 md:p-6 bg-[#0E1338] text-white flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00A6FF]/25 border border-white/10 flex items-center justify-center text-[#00A6FF] shrink-0">
            <User size={20} />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-sm tracking-tight flex items-center gap-1.5 flex-wrap">
              Merchant Identity
              {verification_skipped ? (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-500 rounded-full text-[9px] font-bold uppercase tracking-wider">
                  ⚠️ Verification Skipped
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-[#2ECC71] rounded-full text-[9px] font-bold uppercase tracking-wider">
                  ✓ Verified Account
                </span>
              )}
            </h3>
            <p className="text-[10px] text-gray-300">Review all credentials and setup configurations specified during store initialization.</p>
          </div>
        </div>
        <button 
          id="toggle-onboarding-summary-accordion"
          type="button" 
          className="text-gray-400 hover:text-white transition text-xs font-bold px-3 py-1 bg-white/5 rounded-lg border border-white/10"
        >
          {isOpen ? 'Collapsable View' : 'Expand All Details'}
        </button>
      </div>

      {isOpen && (
        <div className="p-6 space-y-6 animate-fadeIn text-xs text-gray-700">
          
          {/* Main Informational Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Column 1: Personal Merchant Account */}
            <div className="p-5 rounded-2xl bg-gray-50/50 border border-gray-100 space-y-4">
              <h4 className="font-bold text-[#0E1338] text-[11px] uppercase tracking-wider flex items-center gap-1.5 mb-2 pb-2 border-b">
                <CloudLightning className="w-3.5 h-3.5 text-[#00A6FF]" />
                Merchant Administrator Profile
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#0E1338] flex items-center justify-center shrink-0">
                    <User size={14} />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">CEO Full Name</span>
                    <span className="font-bold text-[#0E1338] text-sm">{username || "Registered Merchant"}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                    <User size={14} />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Account Gateway / Login Contact</span>
                    <span className="font-mono text-[11px] text-slate-600 font-semibold">{email || "Not Provided"}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                    <KeyRound size={14} />
                  </div>
                  <div className="flex-1">
                    <span className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Security Master Lock PIN</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-sm tracking-widest text-[#0E1338]">
                        {showPin ? (ownerPin || '1234') : '••••'}
                      </span>
                      <button
                        id="toggle-master-pin-visibility"
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowPin(!showPin); }}
                        className="p-1 text-slate-400 hover:text-[#00A6FF] rounded-lg hover:bg-white transition border border-gray-200 cursor-pointer"
                        title={showPin ? "Hide master PIN" : "Reveal master PIN"}
                      >
                        {showPin ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                  </div>
                </div>

                {verification_skipped && (
                  <div className="flex items-start gap-2.5 p-3 bg-amber-500/10 rounded-xl border border-amber-500/25 mt-4">
                    <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-[10px] font-extrabold text-amber-600 uppercase tracking-wider">⚠️ Phone/Email Non-Verified</span>
                      <p className="text-[10px] text-gray-500 font-medium leading-relaxed mt-0.5">
                        This merchant profile was established via the bypass verification link. The authentication credentials of this account have not been validated by our SMS or Resend SMTP gateways.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Business Store Settings */}
            <div className="p-5 rounded-2xl bg-gray-50/50 border border-gray-100 space-y-4">
              <h4 className="font-bold text-[#0E1338] text-[11px] uppercase tracking-wider flex items-center gap-1.5 mb-2 pb-2 border-b">
                <Building className="w-3.5 h-3.5 text-[#00A6FF]" />
                Corporate Storefront Details
              </h4>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Building size={14} />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Business Name</span>
                    <span className="font-bold text-[#0E1338] text-sm">{bName}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Briefcase size={14} />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Business Operational Mode</span>
                    <span className="font-semibold text-gray-900">
                      {bType === 'service' 
                        ? 'Service Rendering (Consulations, Services, Custom Rates)' 
                        : 'Buy & Sell (Retail/Wholesale Physical Inventory Tracking)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <Phone size={14} />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Storefront Telephone</span>
                    <span className="font-mono text-gray-800 font-semibold">{bPhone}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Sub Row: Additional Specifications */}
          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-[#0E1338] text-[11px] uppercase tracking-wider">Address &amp; Technical Assets</h4>
            
            <div className="p-4 rounded-xl bg-gray-50/30 border border-gray-150 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <span className="flex items-center gap-1.5 font-bold text-[#00A6FF] uppercase tracking-wider text-[9px]">
                  <MapPin className="w-3 h-3 text-red-400" /> Physical Store Address
                </span>
                <p className="text-gray-600 font-medium pl-4">{bAddress}</p>
              </div>

              <div className="space-y-1">
                <span className="flex items-center gap-1.5 font-bold text-[#00A6FF] uppercase tracking-wider text-[9px]">
                  <Tv className="w-3 h-3 text-pink-400" /> Receipts Layout Preference
                </span>
                <p className="text-gray-600 capitalize pl-4 font-bold">{bTemplate.replace('_', ' ')}</p>
              </div>
            </div>

            {/* Telemetry/Audit details */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-blue-50/40 rounded-xl border border-blue-100 text-gray-500 text-[10px] font-medium leading-relaxed">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  Onboarding successfully completed and indexed into SafeGuard Local persistence databases.
                </span>
              </div>
              <div className="font-mono text-[9px] text-[#00A6FF] bg-white border border-blue-200 px-2 py-0.5 rounded">
                yeedem-shop: yeedembooks.com/shop/{shopSlug}
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
