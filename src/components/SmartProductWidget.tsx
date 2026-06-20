import { useState, FormEvent, useEffect } from 'react';
import { 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  Plus, 
  X,
  Package,
  Tags,
  Hash,
  Database,
  ArrowRight
} from 'lucide-react';
import { Product } from '../types';
import { apiFetch } from '../lib/api';

interface SmartProductWidgetProps {
  isService?: boolean;
  subscriptionPlan?: string;
  onUpgradeClick?: () => void;
  onSaveProduct: (product: {
    name: string;
    sku: string;
    stock: number;
    price: number;
  }) => void;
}

const QUICK_ACTIONS = [
  { id: 'shea', label: '🥛 Shea Butter Jar', text: "Add 50 units of Shea Butter Jar SKU SHEA-50 priced at 1250 Naira each" },
  { id: 'cement', label: '🧺 Cement Bags', text: "Create Cement bags catalog 100 bags SKU CEM-01 for 8500 Naira per unit" },
  { id: 'rice', label: '🌾 Rice Bags', text: "Stock up Rice Bags 35 units under SKU RICE-BG at 38000 each" },
];

const SERVICE_QUICK_ACTIONS = [
  { id: 'consulting', label: '💼 Consulting Session', text: "Create hourly consulting service under SKU CNS-HR at 15000 Naira per hour" },
  { id: 'repair', label: '🔧 Technical Repair', text: "Add electronic repair diagnostic package SKU REP-DG priced at 8500 Naira per event" },
  { id: 'design', label: '🎨 Branding Design', text: "Set up agency logo design milestone SKU logo-01 at 45000 each" },
];

export default function SmartProductWidget({ 
  onSaveProduct, 
  isService = false,
  subscriptionPlan,
  onUpgradeClick
}: SmartProductWidgetProps) {
  const getPlanTier = (planName?: string): number => {
    if (!planName) return 1;
    const name = planName.toLowerCase();
    if (name.includes('enterprise')) return 4;
    if (name.includes('pro') || name.includes('starter pro') || name.includes('starter')) return 3;
    if (name.includes('growth')) return 2;
    return 1; // SME Basic / Free
  };

  const isAIAllowed = getPlanTier(subscriptionPlan) >= 2;

  const [activeTab, setActiveTab] = useState<'online_or_ai' | 'parser_or_offline' | 'manual'>(() => {
    const tier = getPlanTier(subscriptionPlan);
    return tier >= 2 ? 'online_or_ai' : 'manual';
  });
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Manual form states
  const [manualName, setManualName] = useState('');
  const [manualSku, setManualSku] = useState('');
  const [manualStock, setManualStock] = useState('10');
  const [manualPrice, setManualPrice] = useState('');

  // Parsed product preview state
  const [extractedProduct, setExtractedProduct] = useState<{
    name: string;
    sku: string;
    stock: number;
    price: number;
  } | null>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setActiveTab('manual');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleActionPillClick = (pillText: string) => {
    setText(pillText);
    setActiveTab('online_or_ai');
    setExtractedProduct(null);
  };

  const handleAiExtraction = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      alert("Please enter a text description of the product first.");
      return;
    }

    setIsLoading(true);
    setExtractedProduct(null);

    try {
      const res = await apiFetch('/api/smart-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': localStorage.getItem('session_id') || '',
          'x-device-fingerprint': localStorage.getItem('device_fingerprint') || ''
        },
        body: JSON.stringify({ text })
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response:", text);
        throw new Error("Server returned non-JSON response (possibly an error page).");
      }

      const data = await res.json();
      if (res.ok) {
        setExtractedProduct(data.parsed_data);
      } else {
        alert("Extraction failed: " + (data.error || "Unknown system error"));
      }

    } catch (err: any) {
      console.error(err);
      alert("Smart extraction pipeline failure: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommitParsedProduct = () => {
    if (extractedProduct) {
      onSaveProduct(extractedProduct);
      setExtractedProduct(null);
      setText('');
    }
  };

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!manualName || !manualPrice) return;

    onSaveProduct({
      name: manualName,
      sku: manualSku || ('SKU-' + Math.floor(100 + Math.random() * 900)),
      stock: parseInt(manualStock, 10) || 0,
      price: parseFloat(manualPrice) || 0
    });

    setManualName('');
    setManualSku('');
    setManualStock('10');
    setManualPrice('');
  };

  return (
    <div className="bg-white rounded-[24px] shadow-md overflow-hidden flex flex-col transition-all duration-300">
      
      {/* Tab Switcher Header aligned with SmartWidget structure */}
      <div className="bg-[#0E1338] px-4.5 py-3 flex items-center justify-between gap-4 text-white border-b border-white/10">
        <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/5 shadow-inner">
          <button
            type="button"
            onClick={() => isOnline && setActiveTab('online_or_ai')}
            disabled={!isOnline}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              !isOnline 
                ? 'bg-white/5 text-white/40 cursor-not-allowed opacity-40' 
                : activeTab === 'online_or_ai'
                  ? 'bg-[#00A6FF] text-white shadow-sm'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>✨ AI</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('parser_or_offline')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'parser_or_offline'
                ? 'bg-[#00A6FF] text-white shadow-sm' 
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>📄 fuse</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'manual' 
                ? 'bg-[#00A6FF] text-white shadow-sm' 
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>📝 Manual</span>
          </button>
        </div>

        <div className="flex items-center bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg" title="Active">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
      </div>

      <div className="p-6">
        
        {/* ONLINE/AI MODE */}
        {(activeTab === 'online_or_ai' || activeTab === 'parser_or_offline') && (
          (!isAIAllowed && activeTab === 'online_or_ai') ? (
            <div className="text-center py-10 px-4 space-y-4 border border-blue-150 rounded-2xl bg-slate-50 relative overflow-hidden">
              <div className="absolute right-0 top-0 opacity-5 transform translate-x-6 -translate-y-6 pointer-events-none select-none">
                <Sparkles className="w-48 h-48 text-[#00A6FF]" />
              </div>
              <div className="w-12 h-12 bg-blue-50 text-[#00A6FF] rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-gray-800 text-sm">✨ Premium AI Product Creator</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                  Speech-to-text catalog indexing, snapshot-to-product table structure, and automated AI product description features require a <strong>Growth</strong>, <strong>Starter Pro</strong>, or <strong>Enterprise</strong> subscription.
                </p>
              </div>
              <button
                type="button"
                onClick={onUpgradeClick}
                className="inline-flex items-center gap-1.5 px-4 h-9 bg-gradient-to-r from-[#00A6FF] to-blue-600 font-bold text-xs text-white rounded-xl shadow-md hover:brightness-110 transition"
              >
                Upgrade to Growth Plan
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-fadeIn">
            
            {/* Action Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin max-w-full">
              {(isService ? SERVICE_QUICK_ACTIONS : QUICK_ACTIONS).map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleActionPillClick(action.text)}
                  className="px-3 py-1 bg-gray-50 hover:bg-[#00A6FF]/10 text-gray-600 hover:text-[#0E1338] border border-gray-150 rounded-full text-[10.5px] font-bold whitespace-nowrap transition cursor-pointer"
                >
                  {action.label}
                </button>
              ))}
            </div>

            {/* Smart Prompt Form */}
            <form onSubmit={handleAiExtraction} className="space-y-3">
              <div className="relative">
                <textarea
                  className="w-full h-24 text-xs font-sans rounded-2xl border border-gray-200 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] p-4 transition bg-gray-50/20 text-gray-800 placeholder-gray-400 leading-relaxed resize-none"
                  placeholder={isService ? "Describe your service and rate details to parse... e.g., Set up a new hourly consulting session rate card for 1500 Naira/hour under SKU CNS-HR." : "Describe your product catalog details to parse... e.g., Set up a new catalog entry of 75 units of Leather Belt Black under SKU LTR-BT priced at 6500 each."}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                {text && (
                  <button
                    type="button"
                    onClick={() => setText('')}
                    className="text-gray-400 hover:text-gray-600 text-[11px] font-semibold flex items-center gap-1 transition"
                  >
                    <X className="w-3.5 h-3.5" /> Clear Input
                  </button>
                )}
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="ml-auto px-5 py-2.5 bg-[#0E1338] hover:bg-[#00A6FF] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-75 disabled:pointer-events-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Parsing Item Details...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                      <span>{isService ? "+ Save Service Offering" : "+ Add New Product"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Structured AI Extraction Result Preview */}
            {extractedProduct && (
              <div className="bg-[#00A6FF]/5 border border-[#00A6FF]/25 rounded-2xl p-4 space-y-3.5 animate-bounceIn text-xs">
                <div className="flex items-center gap-1.5 pb-2 border-b border-[#00A6FF]/10">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="font-extrabold text-[#0E1338]">{isService ? 'Parsed Service Attributes' : 'Parsed Product Attributes'}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 font-sans">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">{isService ? 'Service Provided' : 'Product Name'}</span>
                    <span className="font-bold text-gray-800 break-words">{extractedProduct.name}</span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Generated SKU</span>
                    <span className="font-bold font-mono text-gray-800 uppercase bg-white px-2 py-0.5 rounded border inline-block border-gray-150">{extractedProduct.sku}</span>
                  </div>

                  {!isService && (
                    <div className="space-y-0.5 font-mono">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider font-sans">Stock count</span>
                      <span className="font-extrabold text-gray-800 text-sm">{extractedProduct.stock} units</span>
                    </div>
                  )}

                  <div className="space-y-0.5 font-mono">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider font-sans">{isService ? 'Service Rate' : 'Unit Price'}</span>
                    <span className="font-extrabold text-[#00A6FF] text-sm">₦{extractedProduct.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCommitParsedProduct}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Save Catalog Item
                </button>
              </div>
            )}

          </div>
          )
        )}

        {/* MANUAL FORM MODE */}
        {activeTab === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-4 text-xs text-gray-750 animate-fadeIn">
            
            {/* Input fields */}
            <div>
              <label className="block font-semibold text-gray-500 uppercase tracking-wider mb-1">
                {isService ? 'Service Provided' : 'Product Name'}
              </label>
              <div className="relative">
                <Package className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder={isService ? "e.g. Appliance Repair Diagnostic" : "e.g. Wheat Grain Bags"}
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full text-xs rounded-xl border border-gray-200 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] py-3 pl-10 pr-4 transition bg-gray-50/50 placeholder:text-gray-400 text-gray-800"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-500 uppercase tracking-wider mb-1">SKU Reference Number</label>
              <div className="relative">
                <Hash className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder={isService ? "e.g. REP-DG (Leaves empty to auto-generate)" : "e.g. WHT-22 (Leaves empty to auto-generate)"}
                  value={manualSku}
                  onChange={(e) => setManualSku(e.target.value)}
                  className="w-full text-xs rounded-xl border border-gray-200 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] py-3 pl-10 pr-4 transition bg-gray-50/50 placeholder:text-gray-400 text-gray-800"
                />
              </div>
            </div>

            <div className={isService ? "grid grid-cols-1" : "grid grid-cols-2 gap-3.5"}>
              {!isService && (
                <div>
                  <label className="block font-semibold text-gray-500 uppercase tracking-wider mb-1">Stock Units</label>
                  <input 
                    type="number"
                    min="0"
                    value={manualStock}
                    onChange={(e) => setManualStock(e.target.value)}
                    className="w-full text-xs rounded-xl border border-gray-200 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] p-3 transition bg-gray-50/50 text-gray-800"
                  />
                </div>
              )}
              <div>
                <label className="block font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  {isService ? 'Service Rate (₦)' : 'Unit Price (₦)'}
                </label>
                <input 
                  type="number"
                  min="0"
                  step="any"
                  placeholder={isService ? "8500" : "35000"}
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  className="w-full text-xs rounded-xl border border-gray-200 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] p-3 transition bg-gray-50/50 placeholder:text-gray-400 text-gray-800"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#0E1338] hover:bg-[#00A6FF] text-white rounded-xl text-xs font-bold uppercase tracking-widest transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> {isService ? 'Save Service Offering' : 'Save Catalog Item'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
