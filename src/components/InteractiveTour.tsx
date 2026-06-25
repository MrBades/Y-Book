import { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  Smartphone, 
  Search, 
  Database, 
  ChevronRight, 
  ChevronLeft, 
  HelpCircle, 
  Play, 
  Award,
  BookOpen,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

interface TourStep {
  title: string;
  description: string;
  targetId?: string; // HTML element ID to highlight
  screen: 'dashboard' | 'debtors' | 'invoices' | 'products' | 'profile';
  icon: any;
}

interface InteractiveTourProps {
  activeScreen: string;
  setActiveScreen: (screen: any) => void;
  isOpen: boolean;
  onClose: () => void;
  businessName?: string;
}

export default function InteractiveTour({
  activeScreen,
  setActiveScreen,
  isOpen,
  onClose,
  businessName
}: InteractiveTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const activeBiz = businessName || 'Yeedem Books';

  const steps = useMemo<TourStep[]>(() => [
    {
      title: `Meet ${activeBiz}: Your SME Accounting Hub!`,
      description: "Welcome to your comprehensive premium cloud-synced ledger. This custom platform centralizes your retail sales, wholesale unit costs, uncollected receivables, and low-stock alarms in one single, cohesive, supercharged view. Designed for micro-traders, shop clerks, and managers, Yeedem eliminates legacy spreadsheet complexity.",
      screen: 'dashboard',
      icon: BookOpen
    },
    {
      title: "Automated NLP Bookkeeping (Heuristic Smart Entries)",
      description: "Simply type any normal sentence like 'sold 5 bags of rice to John' or 'received 25k from Ada for garri'. The system's robust pattern-matching parser immediately extracts quantities, matches items against your inventory catalog, calculates selling prices, updates stock counts, and indexes client debit profiles instantly without manual product search fields!",
      targetId: "tour-smart-widget",
      screen: 'dashboard',
      icon: Sparkles
    },
    {
      title: "Active Trade Metrics Ribbon (Daily Pulse)",
      description: "Keep a firm finger on your daily trading pulse. The top stats ribbon counts your total cash collections, uncollected debtor credit lines, and estimated gross margin markup counts for today. This ensures you know exactly how much physical cash is in your drawer versus what is still outstanding.",
      targetId: "tour-daily-pulse",
      screen: 'dashboard',
      icon: TrendingUp
    },
    {
      title: "Interactive Sales & Margin Analysis Graph",
      description: "View true net earnings dynamically. By comparing your retail sales prices against original wholesale cost prices across transaction items, this graph tracks your verifiably accurate true net profits over a rolling 30-day window. For service offerings, it tracks complete cash collections minus operational charges.",
      targetId: "tour-net-profit-chart",
      screen: 'dashboard',
      icon: Database
    },
    {
      title: "Merchant Credit Records & Debtor Lists",
      description: "Access your comprehensive Debtors directory to examine outstanding customer credits. Here, you can easily add debtor profiles, track partial deposits/repayments, adjust billing references, or append private store notes. All balances are updated in real-time across connected staff terminals.",
      targetId: "tour-debtors-section",
      screen: 'debtors',
      icon: Smartphone
    },
    {
      title: "Automated WhatsApp & SMS Client Reminders",
      description: "Retrieve uncollected receivables up to 3x faster with integrated communication launchers. Simply click the contact link next to any debtor profile to open WhatsApp or draft SMS templates pre-filled with the customer's name, uncollected balance, and professional payment reminders.",
      targetId: "tour-debtors-section",
      screen: 'debtors',
      icon: Smartphone
    },
    {
      title: "Inventory Catalog & Wholesale Profit Margins",
      description: "Maintain complete control over physical stockpiles or cataloged service offerings. Inside the Products tab, configure item wholesale purchase costs, retail selling prices, and minimum low-stock alert thresholds. Almad-triggers automatically flag declining stocks on your dashboard to guide orders.",
      targetId: "tour-products-section",
      screen: 'products',
      icon: Database
    },
    {
      title: "Invoices Registry & Multi-Theme Receipt Clearance",
      description: "Search, print, or review tax-cleared sales logs from your secure ledger archive. When exporting PDF invoices, choose from three beautiful design layouts: Classic (monochrome elegance), Modern Blue (clean beach-accented visual), or Kiosk Compact (tailored specifically for neat 58mm mobile thermal roll printers).",
      targetId: "tour-invoice-registry",
      screen: 'invoices',
      icon: Search
    },
    {
      title: "SafeGuard Protection, SSL & Offline Backups",
      description: "Your business secrets are fully firewalled. From your Settings workspace, you can trigger encrypted local file backup downloads of your entire product catalog, debtors book, and transactional cash ledger. Instantly restore previous states or purge database memory lines in a single click for complete privacy.",
      targetId: "tour-backup-manager",
      screen: 'profile',
      icon: ShieldCheck
    },
    {
      title: "All Trained & Ready to Trade!",
      description: `You have successfully completed the comprehensive onboarding tutorial! You are now prepared to log transactions, manage inventory, send reminders, and track profit trends. Start recording right now to watch your retail enterprise run and scale up effortlessly!`,
      screen: 'dashboard',
      icon: Award
    }
  ], [activeBiz]);

  // Adjust activeScreen as the user moves through the steps
  useEffect(() => {
    if (!isOpen) return;
    const targetScreen = steps[currentStep].screen;
    if (activeScreen !== targetScreen) {
      setActiveScreen(targetScreen);
    }
  }, [currentStep, isOpen, steps, activeScreen, setActiveScreen]);

  // Track element rect for spotlight highlighting
  useEffect(() => {
    if (!isOpen) {
      setRect(null);
      return;
    }

    const elementId = steps[currentStep].targetId;
    if (!elementId) {
      setRect(null);
      return;
    }

    const updateRect = () => {
      const el = document.getElementById(elementId);
      if (el) {
        const bounds = el.getBoundingClientRect();
        setRect(bounds);
        // Scroll target gently into view if needed
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setRect(null);
      }
    };

    // Delay lookup to let state navigation layouts mount the elements
    const timer = setTimeout(updateRect, 350);

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
    };
  }, [currentStep, activeScreen, isOpen, steps]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentStep < steps.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else if (e.key === 'ArrowLeft' && currentStep > 0) {
        setCurrentStep(prev => prev - 1);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, isOpen, steps.length, onClose]);

  if (!isOpen) return null;

  const step = steps[currentStep];
  const StepIcon = step.icon;
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  // Render a visual highlight outline around the element during live tour
  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans pointer-events-none select-none">
      
      {/* Dark interactive overlay backdrop using SVG mask spotlight cutout */}
      {rect && (
        <svg 
          className="fixed inset-0 w-full h-full pointer-events-auto z-40 transition-all duration-300"
          style={{ mixBlendMode: 'multiply' }}
        >
          <defs>
            <mask id="tour-spotlight-mask-cutout">
              <rect width="100%" height="100%" fill="white" />
              <rect 
                x={rect.left - 12} 
                y={rect.top - 12} 
                width={rect.width + 24} 
                height={rect.height + 24} 
                rx={18} 
                fill="black" 
              />
            </mask>
          </defs>
          <rect 
            width="100%" 
            height="100%" 
            fill="rgba(7, 9, 20, 0.45)" 
            mask="url(#tour-spotlight-mask-cutout)" 
          />
        </svg>
      )}

      {/* Dimmed backdrop if no target rect (e.g. step 0 and last step) */}
      {!rect && (
        <div className="fixed inset-0 bg-[#070914]/65 backdrop-blur-xs pointer-events-auto z-40" />
      )}

      {/* Actual Tour Tooltip Dialog panel */}
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none select-none">
        <div 
          className={`bg-white rounded-[28px] shadow-2xl border border-gray-150 p-6 flex flex-col gap-4 pointer-events-auto transition-all duration-300 max-w-sm w-full mx-auto select-none ${
            rect ? 'animate-fadeIn' : 'scale-100'
          }`}
          style={rect ? {
            // Position near rect if visible, else center
            // (Providing a neat fixed card style at bottom right or responsive center to keep UX safe)
            transform: 'none'
          } : undefined}
          id="active-tour-dialog-bubble"
        >
          {/* Header Progress indicator */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-indigo-600 tracking-wider">
              <HelpCircle className="w-3.5 h-3.5 animate-pulse" />
              <span>SME Onboarding Tour • Step {currentStep + 1} of {steps.length}</span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-650 bg-gray-50 hover:bg-gray-100 text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold"
              title="Skip or Stop Tour"
            >
              ✕
            </button>
          </div>

          {/* Visual Presentation Content */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                <StepIcon className="w-5 h-5" />
              </div>
              <div className="space-y-1 select-text">
                <h4 className="font-display font-extrabold text-sm text-[#0E1338] leading-tight select-text">{step.title}</h4>
                <p className="text-xs text-gray-500 leading-relaxed select-text">{step.description}</p>
              </div>
            </div>

            {/* Micro mock visual highlights helper */}
            {rect && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 flex items-center justify-between text-[9px] text-gray-400 select-none">
                <span className="flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-ping"></span>
                  Element spotlight focus active
                </span>
                <span>Press ➔ to advance</span>
              </div>
            )}
          </div>

          {/* Action Navigation controls */}
          <div className="flex items-center justify-between mt-1 pt-3 border-t border-gray-100">
            {/* Step indicators dots */}
            <div className="flex gap-1">
              {steps.map((_, idx) => (
                <span 
                  key={idx} 
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStep ? 'bg-[#00A6FF] w-3.5' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-[11px] font-bold rounded-xl transition flex items-center gap-1 border border-gray-100"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              )}

              {isLast ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 bg-[#00A6FF] text-white text-[11px] font-bold rounded-xl shadow-md transition flex items-center gap-1 hover:bg-opacity-95"
                >
                  <span>Discover Ledgers</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  className="px-4 py-1.5 bg-indigo-600 text-white text-[11px] font-bold rounded-xl shadow-md transition flex items-center gap-1.5 hover:bg-indigo-700"
                >
                  <span>{isFirst ? 'Start Walkthrough' : 'Next Step'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
