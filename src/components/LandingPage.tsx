import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Database, 
  MessageSquare, 
  CheckCircle2, 
  ChevronRight, 
  ArrowRight,
  ShieldCheck, 
  Store, 
  TrendingUp, 
  Lock, 
  FileCheck,
  ChevronLeft,
  Quote,
  ChevronDown,
  HelpCircle,
  FileText,
  AlertCircle,
  Mic,
  Smartphone,
  Share2,
  Cpu,
  Coins,
  ArrowUpRight,
  LayoutGrid,
  ShieldAlert,
  UserCheck,
  Layers,
  LineChart,
  HardDrive,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PricingGrid from './PricingGrid';

const TESTIMONIALS = [
  {
    initials: "ON",
    name: "Chief Okey N.",
    role: "Managing Director, Okey Electronics Ltd",
    market: "Alaba International Market, Lagos",
    quote: "Managing three warehouse operations in Alaba was a constant headache of duplications and lost cashier books. In Yeedem, my storeboys key-in incoming sales on their phones even when network drops, and I audit our ledger reports instantly from home. Highly recommended!"
  },
  {
    initials: "LK",
    name: "Alhaji Lawal K.",
    role: "Owner, Alhaji Lawal & Sons Textiles",
    market: "Kano Textile Market",
    quote: "The automated PDF invoices downloaded are perfectly clean. But our ultimate feature is the WhatsApp debtor trigger! We sent preformatted balance cards to our retailers last Tuesday and reclaimed over ₦450,000 in outstanding credit payments in under 48 hours."
  },
  {
    initials: "CE",
    name: "Mrs. Chioma E.",
    role: "Founder, Chioma Cosmetics Hub",
    market: "Onitsha Main Market, Anambra",
    quote: "The voice-prompt record parsing is pure witchcraft! I just speak into the app in plain English mixed with Igbo about what I sold and who paid what deposit. Yeedem extracts the quantities, updates my stock levels, and generates the balance invoice automatically while I attend to customer queues."
  },
  {
    initials: "ID",
    name: "Malam Ibrahim D.",
    role: "Managing Director, Ibrahim Fabrics",
    market: "Balogun Market, Lagos Island",
    quote: "We operate a high-traffic wholesale fashion storefront in Balogun. Keeping track of cashiers, physical sales, and what deposits are pending was chaotic. The multi-tenant cashier login lets me delegate booking to staff while lock-securing vital margins information."
  },
  {
    initials: "NJ",
    name: "Nneka J.",
    role: "Lead Designer, Nne Leathercraft",
    market: "Ariaria International Market, Aba",
    quote: "Offline ledger persistence is a lifesaver. Power grid failure and network outages used to paralyze our checkout queue. Now we log every bag, shoe, and component production batch offline, knowing it auto-synchronizes to the cloud the moment connectivity returns."
  }
];

interface LandingPageProps {
  onNavigate: (screen: 'login' | 'about' | 'terms' | 'guest_invoice') => void;
  onUpgrade: (plan: string, billingCycle: 'monthly' | 'annually', amount: number) => void;
  customPrices?: {
    growth_monthly: number;
    growth_annually: number;
    pro_monthly: number;
    pro_annually: number;
    enterprise_monthly: number;
    enterprise_annually: number;
  };
}

export default function LandingPage({ onNavigate, onUpgrade, customPrices }: LandingPageProps) {
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const faqs = [
    {
      question: "Can I generate invoices completely offline?",
      answer: "Yes! Yeedem Books is engineered as a high-reliability offline invoicing app for small business operations. If the network goes flat inside a crowded market, your logs are saved in local browser storage and instantly auto-synchronized with your database when connectivity is restored."
    },
    {
      question: "How does the text-to-invoice automation save time?",
      answer: "By incorporating a cutting-edge offline AI invoice generator from text, you don't need to manually type forms. Dictate or type: 'Mrs. Chioma took 5 crates of eggs on credit, paid 10k deposit' - the parser auto-calculates total amounts, computes the balance due, creates itemized lists, and updates stock logs instantly."
    },
    {
      question: "How do I track store debtors on my phone?",
      answer: "Yeedem Books makes it simple to track store debtors on phone without complex accounting sheets. It logs outstanding credit lines, groups transactions by debtor profile, calculates total liability ages, and lets you tap one button to send pre-formatted debt balance reminders directly to client WhatsApp numbers."
    },
    {
      question: "Does Yeedem Books support physical thermal checkout printing?",
      answer: "Absolutely. In your ledger panel settings, select the 'Kiosk Compact' theme to format customer statements perfectly for standard 80mm thermal paper receipts. You can trigger print receipts directly from your phone or checkout terminal with ease."
    },
    {
      question: "Is there an owner security gate for operator clerks?",
      answer: "Yes. Yeedem books lets you configure a master security PIN and restricted operator clerks logins. Cashiers or warehouse staff can generate invoice records, check inventory stocks, and log credit logs offline, but cannot view total store profit margins or delete invoices."
    }
  ];

  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isHovered]);

  const handlePrev = () => {
    setActiveTestimonial((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  };

  const handleNext = () => {
    setActiveTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
  };

  return (
    <div className="space-y-20 py-4 animate-fadeIn font-sans selection:bg-[#00A6FF] selection:text-white">
      
      {/* 1. HERO SECTION WITH KEYWORD RICH SUBTITLE & BOLD VALUE PROP */}
      <header className="text-center space-y-6 py-8 max-w-7xl mx-auto px-4">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#00A6FF]/10 text-[#00A6FF] rounded-full text-[10px] font-black uppercase tracking-wider">
          <Sparkles size={11} className="animate-pulse" />
          The Ultimate Offline Invoicing App for Small Business & Wholesale Hubs
        </span>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-black text-[#0E1338] tracking-tight leading-tight max-w-5xl mx-auto">
          The Offline-First AI <span className="text-[#00A6FF]">Invoice Engine</span> for Smart Merchants
        </h1>
        <p className="text-gray-550 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
          Struggling with slow network? Track store debtors on phone, dictate transactions with our smart AI invoice generator from text, and send instant automated WhatsApp reminders. Works 100% offline.
        </p>
        
        {/* CTAs */}
        <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center items-center max-w-xl mx-auto">
          <button
            onClick={() => onNavigate('login')}
            className="w-full sm:w-auto px-8 py-4 bg-[#0E1338] hover:bg-[#151c50] text-white font-bold rounded-xl text-xs md:text-sm shadow-md hover:shadow-lg hover:shadow-[#0E1338]/15 active:scale-[0.99] transition duration-300 flex items-center justify-center gap-2 group cursor-pointer"
          >
            Join Free Beta
            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
          
          <button
            onClick={() => onNavigate('guest_invoice')}
            className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-[#0E1338] border border-gray-200 font-bold rounded-xl text-xs md:text-sm shadow-sm hover:shadow active:scale-[0.99] transition duration-300 flex items-center justify-center gap-2 cursor-pointer"
          >
            Launch Free Quick Invoice <FileCheck size={16} className="text-[#00A6FF]" />
          </button>
        </div>
      </header>

      {/* 2. THE PROBLEM VS. SOLUTION VISUAL BLOCK */}
      <section className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-[10px] uppercase font-black tracking-widest text-[#00A6FF] block">RAW TEXT TO COMPLIANT INVOICE</span>
          <h2 className="text-2xl md:text-3xl font-serif font-extrabold text-[#0E1338]">From Messy Scratchpad to Clean Ledger</h2>
          <p className="text-xs text-gray-400 max-w-lg mx-auto">See how Yeedem's automated AI logic transforms scribbled market memos into pristine digital ledger entries instantly.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch pt-4">
          {/* PROBLEM SIDE: MESSY RAW TEXT BOOK */}
          <article className="bg-[#FAF7F0] border-2 border-dashed border-amber-300/60 rounded-3xl p-6 md:p-8 flex flex-col justify-between relative shadow-sm overflow-hidden">
            <div className="absolute top-0 right-0 bg-amber-500/10 text-amber-800 text-[10px] font-bold px-3 py-1 rounded-bl-xl font-mono uppercase tracking-wider">
              Traditional Scratchpad
            </div>
            
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-amber-950 font-serif flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" /> Lost Pen & Paper Records
              </h3>
              
              <div className="space-y-3 font-mono text-[11px] text-amber-900 leading-relaxed bg-white/45 p-4 rounded-xl border border-amber-200/50">
                <p className="border-b border-amber-200/40 pb-2">✏️ "Musa took 3 crates of eggs, owes 15k... wait, did he pay last week's balance?"</p>
                <p className="border-b border-amber-200/40 pb-2">✏️ "Mrs. Bello cosmetic bags credit, paid deposit 50k, total balance was maybe 120k? Ask cashiers."</p>
                <p className="pb-1">✏️ "Okey picked up textiles on credit today, no invoice number."</p>
              </div>

              <p className="text-amber-850 text-xs leading-relaxed">
                Physical books get lost, cashiers miss ledger tabs, and calculating outstanding debt age is a nightmare. Plus, when the network cuts, your digital apps spin endlessly.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-amber-800 font-mono">
              <span>✕ Messy, error-prone, hard to calculate</span>
            </div>
          </article>

          {/* SOLUTION SIDE: AI-STRUCTURED LEDGER & INVOICE */}
          <article className="bg-gradient-to-br from-slate-900 to-[#0e1338] text-white rounded-3xl p-6 md:p-8 flex flex-col justify-between relative shadow-lg border border-blue-900/30 overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#00A6FF] text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl font-mono uppercase tracking-wider animate-pulse">
              AI Parser Solution
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white font-serif flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00A6FF]" /> Automated AI Extraction
              </h3>

              {/* Structuring Visual Card Mockup */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <div>
                    <p className="text-[10px] uppercase font-mono tracking-wider text-gray-400">CUSTOMER LEDGER ACCOUNT</p>
                    <p className="text-xs font-bold text-[#00A6FF]">Musa Ibrahim (Retailer Hub)</p>
                  </div>
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-mono uppercase font-bold border border-emerald-500/20">AUTO SAVED</span>
                </div>

                <div className="space-y-1 text-[11px] font-mono text-gray-300">
                  <div className="flex justify-between">
                    <span>3x Crates of Farm Eggs</span>
                    <span className="text-white">₦15,000</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-1 text-gray-400">
                    <span>Tax (FIRS VAT 7.5%)</span>
                    <span>₦1,125</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-1 text-emerald-400 font-bold">
                    <span>Outstanding Credit</span>
                    <span>₦16,125</span>
                  </div>
                </div>
              </div>

              <p className="text-gray-300 text-xs leading-relaxed">
                Yeedem Books processes voice and loose text commands in plain English. It parses items, computes tax, and logs outstanding customer debt dynamically to your local database immediately.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-[#00A6FF] font-mono">
              <span>✓ Instant receipt generation, real-time debt calculation</span>
            </div>
          </article>
        </div>
      </section>

      {/* 3. CORE MOATS GRID - TARGETING SPECIFIC KEYWORD BENEFIT BLOCKS */}
      <section className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-[10px] uppercase font-black tracking-widest text-[#00A6FF] block">EXCLUSIVE MERCHANT ADVANTAGES</span>
          <h2 className="text-2xl md:text-3xl font-serif font-extrabold text-[#0E1338]">Engineered for Modern Storefronts</h2>
          <p className="text-xs text-gray-400 max-w-lg mx-auto">High-speed, robust features tailored specifically for fast-paced retail & wholesale market squares.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          
          {/* Card 1: Offline-First Sync */}
          <article className="bg-white rounded-3xl p-6 shadow-sm border border-gray-150/80 hover:border-[#00A6FF]/40 hover:shadow-md transition duration-300 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#00A6FF] flex items-center justify-center">
                <Database size={20} />
              </div>
              <h3 className="text-sm font-bold text-[#0E1338] tracking-tight">Offline Invoicing App for Small Business</h3>
              <p className="text-gray-450 text-[11px] leading-relaxed">
                Power failure and weak network don't slow down checkouts. Save stock transactions, add client profiles, and draft invoices completely offline. All data auto-synchronizes securely with the cloud once your signal is back.
              </p>
            </div>
            <div className="pt-2 text-[10px] text-[#00A6FF] font-black uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={11} /> Works 100% Offline
            </div>
          </article>

          {/* Card 2: Voice & Text Commands */}
          <article className="bg-white rounded-3xl p-6 shadow-sm border border-gray-150/80 hover:border-[#00A6FF]/40 hover:shadow-md transition duration-300 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Mic size={20} />
              </div>
              <h3 className="text-sm font-bold text-[#0E1338] tracking-tight">AI Invoice Generator from Text & Voice</h3>
              <p className="text-gray-450 text-[11px] leading-relaxed">
                Dictate sales straight to your device. Speak standard English mixed with merchant terms, and watch our native browser voice parser pull out quantities, identify products, compute totals, and create structured digital sheets.
              </p>
            </div>
            <div className="pt-2 text-[10px] text-amber-500 font-black uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={11} /> Speak or Type to Log
            </div>
          </article>

          {/* Card 3: WhatsApp Debtor Tracking */}
          <article className="bg-white rounded-3xl p-6 shadow-sm border border-gray-150/80 hover:border-[#00A6FF]/40 hover:shadow-md transition duration-300 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Smartphone size={20} />
              </div>
              <h3 className="text-sm font-bold text-[#0E1338] tracking-tight">Track Store Debtors on Phone Instantly</h3>
              <p className="text-gray-450 text-[11px] leading-relaxed">
                Say goodbye to tracking credit in paper books. Look up overdue accounts on your mobile, monitor cumulative debt ages, and dispatch beautifully drafted professional credit statements to client WhatsApp chats with a single tap.
              </p>
            </div>
            <div className="pt-2 text-[10px] text-emerald-500 font-black uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={11} /> One-Click WhatsApp Reminders
            </div>
          </article>

        </div>
      </section>

      {/* 4. [RESTORED] POWERFUL MERCHANT UTILITIES GRID */}
      <section className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-[10px] uppercase font-black tracking-widest text-[#00A6FF] block">POWERFUL MERCHANT UTILITIES</span>
          <h2 className="text-2xl md:text-3xl font-serif font-extrabold text-[#0E1338]">All-In-One Automated Bookkeeping</h2>
          <p className="text-xs text-gray-400 max-w-lg mx-auto">
            Skip complex manual spreadsheets. Yeedem books records raw trade streams and handles tax formulas automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          
          {/* Item 1: FIRS Standard Compliance */}
          <article className="bg-white rounded-2xl p-6 border border-gray-150 shadow-xs space-y-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileCheck size={18} />
            </div>
            <h3 className="text-xs font-bold text-[#0E1338]">FIRS Standard Compliance</h3>
            <p className="text-gray-450 text-[11px] leading-relaxed">
              Automatically formats sales into templates compliant with Nigerian tax codes. Dynamically calculates sales percentages, withholding rates, and product classifications out of the box.
            </p>
            <div className="text-[9px] font-bold text-purple-600 uppercase font-mono">✓ Compliant Formats</div>
          </article>

          {/* Item 2: Local Cache & Cloud Sync */}
          <article className="bg-white rounded-2xl p-6 border border-gray-150 shadow-xs space-y-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <HardDrive size={18} />
            </div>
            <h3 className="text-xs font-bold text-[#0E1338]">Local Cache & Cloud Sync</h3>
            <p className="text-gray-450 text-[11px] leading-relaxed">
              Log transactions offline when network speeds in open markets drop. Ledger data caches securely inside local browser files, auto-syncing soon as connectivity is restored.
            </p>
            <div className="text-[9px] font-bold text-blue-600 uppercase font-mono">✓ Persistent Cache</div>
          </article>

          {/* Item 3: WhatsApp Debt Dispatch */}
          <article className="bg-white rounded-2xl p-6 border border-gray-150 shadow-xs space-y-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Share2 size={18} />
            </div>
            <h3 className="text-xs font-bold text-[#0E1338]">WhatsApp Debt Dispatch</h3>
            <p className="text-gray-450 text-[11px] leading-relaxed">
              Draft professional pre-composed debt balance statements in seconds. Send polite ledger details instantly to distribution clients over WhatsApp to collect receivables faster.
            </p>
            <div className="text-[9px] font-bold text-emerald-600 uppercase font-mono">✓ Fast Collection</div>
          </article>

          {/* Item 4: Encrypted Cloud Backups */}
          <article className="bg-white rounded-2xl p-6 border border-gray-150 shadow-xs space-y-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Lock size={18} />
            </div>
            <h3 className="text-xs font-bold text-[#0E1338]">Encrypted Cloud Backups</h3>
            <p className="text-gray-450 text-[11px] leading-relaxed">
              Avoid ledger losses due to lost phones. Create manual snapshots or authorize automated backup triggers. Re-migrate complete catalogs with a single administrative restore token.
            </p>
            <div className="text-[9px] font-bold text-rose-600 uppercase font-mono">✓ Failsafe Restores</div>
          </article>

          {/* Item 5: Multi-Operator Clerk Roles */}
          <article className="bg-white rounded-2xl p-6 border border-gray-150 shadow-xs space-y-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users size={18} />
            </div>
            <h3 className="text-xs font-bold text-[#0E1338]">Multi-Operator Clerk Roles</h3>
            <p className="text-gray-450 text-[11px] leading-relaxed">
              Assign restricted logins to shop clerks or cashiers. Operators can record sales and print receipts, but only the business owner's primary PIN can delete records or view margins.
            </p>
            <div className="text-[9px] font-bold text-amber-600 uppercase font-mono">✓ Dual Role Securities</div>
          </article>

          {/* Item 6: Enterprise Margin Insights */}
          <article className="bg-white rounded-2xl p-6 border border-gray-150 shadow-xs space-y-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <LineChart size={18} />
            </div>
            <h3 className="text-xs font-bold text-[#0E1338]">Enterprise Margin Insights</h3>
            <p className="text-gray-450 text-[11px] leading-relaxed">
              Monitor live graphs of cash sales versus credit liabilities. Review daily trade trends, highlight top distributing clients, and see products with high wholesale turnover rates.
            </p>
            <div className="text-[9px] font-bold text-cyan-600 uppercase font-mono">✓ Dynamic Dashboards</div>
          </article>

        </div>
      </section>

      {/* 5. [RESTORED] SIMPLE LEDGER TRANSITION SECTION */}
      <section className="max-w-6xl mx-auto px-4 space-y-8 bg-gradient-to-b from-slate-50 to-white py-12 rounded-[32px] border border-gray-100">
        <div className="text-center space-y-2">
          <span className="text-[10px] uppercase font-black tracking-widest text-[#00A6FF] block">SIMPLE LEDGER TRANSITION</span>
          <h2 className="text-2xl md:text-3xl font-serif font-extrabold text-[#0E1338]">Streamlined Setup in 3 Simple Steps</h2>
          <p className="text-xs text-gray-400 max-w-lg mx-auto">
            Get your retail floor up and running on Yeedem in less than five minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
          
          {/* Step 1 */}
          <div className="relative p-6 bg-white rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between">
            <div className="absolute -top-4 -left-4 w-9 h-9 rounded-xl bg-[#0E1338] text-white flex items-center justify-center font-bold text-xs font-mono shadow-md">
              01
            </div>
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold text-[#0E1338]">Create Your Master Profile</h3>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Verify your email, upload your corporate logo, choose customizable background accents, and configure default headers.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative p-6 bg-white rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between">
            <div className="absolute -top-4 -left-4 w-9 h-9 rounded-xl bg-[#00A6FF] text-white flex items-center justify-center font-bold text-xs font-mono shadow-md">
              02
            </div>
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold text-[#0E1338]">Populate Your Catalogs</h3>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Quickly add stock items or distributor names. Easily handle multi-item purchases and record deposits or unpaid balances.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative p-6 bg-white rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between">
            <div className="absolute -top-4 -left-4 w-9 h-9 rounded-xl bg-emerald-500JS text-white bg-emerald-600 flex items-center justify-center font-bold text-xs font-mono shadow-md">
              03
            </div>
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold text-[#0E1338]">Lock & Rest Assured</h3>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Protect operations using high-defense storefront lock-screens and back up everything to secure servers automatically.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* 6. NAIRA CORE PRICING GRID */}
      <section className="max-w-7xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-[10px] uppercase font-black tracking-widest text-[#00A6FF] block">TRANSPARENT NAIRA PRICING</span>
          <h2 className="text-2xl md:text-3xl font-serif font-extrabold text-[#0E1338]">Flexible & Simple Commercial Licenses</h2>
          <p className="text-xs text-gray-400 max-w-lg mx-auto">No complex contracts, cancel anytime. Perfect for family shops and wholesale operations alike.</p>
        </div>
        <PricingGrid onNavigate={onNavigate} onUpgrade={onUpgrade} customPrices={customPrices} />
      </section>

      {/* 7. IMMERSIVE NIGERIAN LOCAL TESTIMONIAL CARDS */}
      <section 
        className="bg-[#0E1338] text-white rounded-[32px] p-8 md:p-12 max-w-5xl mx-auto px-4 space-y-8 relative overflow-hidden shadow-2xl border border-white/5"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full filter blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#00A6FF]/5 rounded-full filter blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
          <div className="space-y-2 text-center md:text-left">
            <span className="text-[10px] uppercase font-mono font-black tracking-widest text-[#00A6FF] bg-[#00A6FF]/10 px-3 py-1 rounded-full border border-[#00A6FF]/25">
              REAL NIGERIAN MERCHANTS
            </span>
            <h2 className="text-2xl md:text-3xl font-serif font-black tracking-tight mt-2 text-white">
              Trusted in Alaba, Kano, and Onitsha
            </h2>
            <p className="text-xs text-gray-300 max-w-md">
              Learn how wholesalers protect cash flows and manage retail distributions with Yeedem Books.
            </p>
          </div>

          <div className="flex items-center justify-center gap-1.5 shrink-0 self-center md:self-end pb-1">
            {TESTIMONIALS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveTestimonial(idx)}
                className="group relative focus:outline-none"
                aria-label={`Go to testimonial ${idx + 1}`}
              >
                <div className={`h-1.5 rounded-full transition-all duration-350 cursor-pointer ${activeTestimonial === idx ? 'w-8 bg-[#00A6FF]' : 'w-2 bg-white/20 hover:bg-white/40'}`} />
              </button>
            ))}
          </div>
        </div>

        <div className="relative z-10 min-h-[220px] md:min-h-[180px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTestimonial}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 space-y-6 relative overflow-hidden backdrop-blur-sm hover:border-[#00A6FF]/30 transition"
            >
              <Quote className="absolute right-4 top-4 w-16 h-16 text-white/[0.03] pointer-events-none select-none" />
              <p className="text-xs md:text-sm text-gray-200 italic leading-relaxed font-serif">
                "{TESTIMONIALS[activeTestimonial].quote}"
              </p>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#00A6FF] to-[#0E1338] border border-[#00A6FF]/30 flex items-center justify-center text-xs font-black text-white shrink-0 shadow-lg">
                    {TESTIMONIALS[activeTestimonial].initials}
                  </div>
                  <div>
                    <h4 className="text-xs md:text-sm font-bold text-white flex items-center gap-1.5 flex-wrap">
                      {TESTIMONIALS[activeTestimonial].name}
                      <span className="text-[10px] text-gray-400 font-normal font-sans">({TESTIMONIALS[activeTestimonial].role})</span>
                    </h4>
                    <p className="text-[9px] text-[#00A6FF] uppercase font-mono tracking-wider font-extrabold">{TESTIMONIALS[activeTestimonial].market}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-end pt-2 relative z-10">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 hover:text-[#00A6FF] transition text-gray-300 cursor-pointer"
              aria-label="Previous story"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNext}
              className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 hover:text-[#00A6FF] transition text-gray-300 cursor-pointer"
              aria-label="Next story"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* 8. FAQ ACCORDION PRE-OPTIMIZED FOR GOOGLE RICH SNIPPETS */}
      <section className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <header className="text-center space-y-2">
          <span className="text-[10px] uppercase font-black tracking-widest text-[#00A6FF] block flex items-center justify-center gap-1">
            <HelpCircle size={12} className="text-[#00A6FF]" /> KNOWLEDGE PORTAL & CLERICAL INQUIRIES
          </span>
          <h2 className="text-xl md:text-2xl font-serif font-extrabold text-[#0E1338]">Frequently Asked Questions on Smart Offline Invoicing</h2>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Find answers to common questions about small business accounting, text parsers, and credit logs on Yeedem.
          </p>
        </header>

        <div className="space-y-3.5">
          {faqs.map((faq, i) => {
            const isExpanded = expandedFaq === i;
            return (
              <article 
                key={i} 
                className="bg-white border border-gray-150 rounded-2xl overflow-hidden transition-all duration-300 shadow-sm"
              >
                <button
                  onClick={() => setExpandedFaq(isExpanded ? null : i)}
                  className="w-full p-4 text-left flex justify-between items-center gap-4 hover:bg-slate-50 transition cursor-pointer"
                  aria-expanded={isExpanded}
                >
                  <span className="text-xs sm:text-sm font-bold text-[#0E1338]">
                    {faq.question}
                  </span>
                  <div className={`w-6 h-6 rounded-lg bg-slate-150/50 flex items-center justify-center text-gray-450 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-[#00A6FF]' : ''}`}>
                    <ChevronDown size={14} />
                  </div>
                </button>
                <div 
                  className={`transition-all duration-350 ease-in-out ${isExpanded ? 'max-h-[250px] border-t border-gray-100 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}
                >
                  <div className="p-4 text-xs text-gray-500 leading-relaxed bg-[#FAFCFF]">
                    {faq.answer}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 9. SECURE CALL TO ACTION */}
      <section className="bg-white rounded-3xl p-8 border border-gray-150 text-center space-y-4 max-w-7xl mx-auto px-4">
        <h3 className="text-md sm:text-lg font-bold text-[#0E1338]">Ready to Protect Wholesaler Profits?</h3>
        <p className="text-gray-400 text-xs max-w-lg mx-auto">
          Start recording high-accuracy transaction ledgers. Track store debtors on phone easily, generate receipts, and download clean tax-compliant invoice templates.
        </p>
        <button
          onClick={() => onNavigate('login')}
          className="px-6 py-3 bg-[#00A6FF] hover:bg-[#0095E6] text-white text-xs font-bold rounded-xl transition shadow duration-300 flex items-center gap-2 mx-auto cursor-pointer"
        >
          Begin Free Ledger Account <ArrowRight size={13} />
        </button>
      </section>

    </div>
  );
}
