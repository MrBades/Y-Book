import { useState, FormEvent, useEffect } from 'react';
import { BookOpen, Sparkles, UserCheck, ArrowRight, ArrowLeft, HelpCircle, CheckCircle2, Info, Lock } from 'lucide-react';

interface OnboardingProps {
  onCompleteOnboarding: (
    fullName: string,
    email: string,
    businessName: string,
    phone: string,
    address: string,
    businessType: 'buy_and_sell' | 'service',
    template: 'classic' | 'modern_blue' | 'kiosk_compact',
    pin: string,
    skippedOnboarding?: boolean
  ) => void;
  initialEmail?: string;
  initialFullName?: string;
  initialPhone?: string;
}

export default function Onboarding({ 
  onCompleteOnboarding, 
  initialEmail = '', 
  initialFullName = '',
  initialPhone = '' 
}: OnboardingProps) {
  // Wizard Steps:
  // Step 1: Security PIN (Passwords)
  // Step 2: Merchant Identity (Full Name & Email)
  // Step 3: Ledger Settings (Business Name, Phone, Address, Type, Theme Layout)
  const [step, setStep] = useState(1); 
  
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [username, setUsername] = useState(initialFullName);
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState(initialPhone);
  const [address, setAddress] = useState('');
  const [businessType, setBusinessType] = useState<'buy_and_sell' | 'service'>('buy_and_sell');
  const [selectedTemplate, setSelectedTemplate] = useState<'classic' | 'modern_blue' | 'kiosk_compact'>('classic');
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (initialFullName) {
      setUsername(initialFullName);
    }
  }, [initialFullName]);

  useEffect(() => {
    if (initialPhone) {
      setPhone(initialPhone);
    }
  }, [initialPhone]);

  // Dynamic progress calculation based on user input state
  const calculateProgress = () => {
    if (step === 1) {
      return pin.length === 4 ? 33 : 15;
    }
    if (step === 2) {
      let score = 33;
      if (username.trim()) score += 15;
      if (email.trim().includes('@')) score += 15;
      return score;
    }
    let score = 66;
    if (businessName.trim()) score += 14;
    if (phone.trim()) score += 10;
    if (address.trim()) score += 10;
    return score;
  };

  const currentPercent = calculateProgress();

  const handleNext = (e: FormEvent) => {
    e.preventDefault();
    if (!navigator.onLine) {
      alert("⚠️ Network Offline: You must be connected to the internet to set up or register bookkeeping accounts on Yeedem servers.");
      return;
    }

    if (step === 1) {
      if (!pin || pin.length !== 4 || isNaN(Number(pin))) {
        alert("Please set a secure 4-digit login PIN.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!username || !username.trim()) {
        alert("Please specify your full name.");
        return;
      }
      if (!email || !email.trim().includes('@')) {
        alert("Please specify a valid email contact address.");
        return;
      }
      setStep(3);
    } else {
      if (!businessName || !phone || !address) {
        alert("Please complete the store trading name, telephone number, and address.");
        return;
      }
      onCompleteOnboarding(username, email, businessName, phone, address, businessType, selectedTemplate, pin);
    }
  };

  const toggleTooltip = (fieldId: string) => {
    if (activeTooltip === fieldId) {
      setActiveTooltip(null);
    } else {
      setActiveTooltip(fieldId);
    }
  };

  return (
    <div className="bg-white max-w-lg w-full mx-auto rounded-[32px] border border-gray-150 shadow-2xl overflow-hidden mt-8 text-xs text-[#0E1338] animate-fadeIn">
      
      {/* Visual Header with Cohesive Deep Navy Theme */}
      <div className="bg-[#0E1338] px-8 py-10 text-white text-center space-y-3 relative overflow-hidden">
        {/* Abstract background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#00A6FF]/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="w-14 h-14 bg-white/10 text-[#00A6FF] rounded-2xl flex items-center justify-center mx-auto border border-white/15 shadow-inner">
          <BookOpen className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-display font-extrabold tracking-tight">Yeedem Books Setup</h1>
        <p className="text-gray-300 max-w-xs mx-auto text-[11px] leading-relaxed">
          The premier AI-First Accounting & Invoicing Ledger built for micro-traders and shop managers.
        </p>
      </div>

      <div className="p-8 space-y-6">
        
        {/* Dynamic Interactive Progress Bar Indicator */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 tracking-wider uppercase">
            <span>Setup Progress</span>
            <span className="text-[#00A6FF] font-mono">{currentPercent}% Done</span>
          </div>
          
          {/* Animated Progress Bar */}
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden p-[1px] border border-gray-150">
            <div 
              className="h-full bg-gradient-to-r from-[#0E1338] to-[#00A6FF] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${currentPercent}%` }}
            ></div>
          </div>

          {/* Stepper Steps Row */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-[10px]">
            <div className={`flex items-center gap-1.5 pb-1 border-b-2 transition ${step >= 1 ? 'border-[#00a6ff]' : 'border-gray-100'}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] ${
                step >= 1 ? 'bg-[#0E1338] text-white' : 'bg-gray-150 text-gray-500'
              }`}>1</span>
              <span className={`font-bold uppercase tracking-wider ${step === 1 ? 'text-[#0E1338]' : 'text-gray-400'}`}>
                PIN Key
              </span>
            </div>
            
            <div className={`flex items-center gap-1.5 pb-1 border-b-2 transition ${step >= 2 ? 'border-[#00a6ff]' : 'border-gray-100'}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] ${
                step >= 2 ? 'bg-[#0E1338] text-white' : 'bg-gray-150 text-gray-500'
              }`}>2</span>
              <span className={`font-bold uppercase tracking-wider ${step === 2 ? 'text-[#0E1338]' : 'text-gray-400'}`}>
                Merchant
              </span>
            </div>

            <div className={`flex items-center gap-1.5 pb-1 border-b-2 transition ${step === 3 ? 'border-[#00a6ff]' : 'border-gray-100'}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] ${
                step === 3 ? 'bg-[#0E1338] text-white' : 'bg-gray-150 text-gray-500'
              }`}>3</span>
              <span className={`font-bold uppercase tracking-wider ${step === 3 ? 'text-[#0E1338]' : 'text-gray-400'}`}>
                Ledger Settings
              </span>
            </div>
          </div>
        </div>

        {/* STEP 1: SECURITY PIN (PASSWORDS) */}
        {step === 1 && (
          <form onSubmit={handleNext} className="space-y-5">
            <div className="space-y-1 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
              <h2 className="text-sm font-extrabold text-[#0E1338] flex items-center gap-1.5 leading-none">
                <Lock className="w-4 h-4 text-[#00A6FF]" />
                Set Security PIN (Password)
              </h2>
              <p className="text-gray-500 text-[11px] leading-relaxed pt-0.5">
                Establish a highly secure 4-digit numerical code. This PIN locks your merchant database, secures counter sales, and allows instant logins.
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block font-extrabold text-[#4A5568] uppercase tracking-wider text-[10px]">
                    Create Account Sign-in PIN (4 Digits)
                  </label>
                  
                  <div className="relative">
                    <button 
                      type="button"
                      onMouseEnter={() => setActiveTooltip('pin')}
                      onMouseLeave={() => setActiveTooltip(null)}
                      onClick={() => toggleTooltip('pin')}
                      className="p-1 hover:bg-gray-100 rounded-full text-[#00A6FF] transition cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                    
                    {activeTooltip === 'pin' && (
                      <div className="absolute right-0 bottom-6 z-20 w-64 bg-[#0E1338] text-white text-[11px] p-3 rounded-xl shadow-xl border border-white/10 animate-fadeIn">
                        <p className="font-bold mb-1 text-[#00A6FF]">Why a Security PIN?</p>
                        <p className="text-gray-300 leading-normal">
                          Yeedem Books utilizes localized 4-digit codes instead of complex alphanumeric passwords to permit fast touch-pad switching for shop assistants.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <input
                  type="password"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/\D/g, '');
                    setPin(cleanVal);
                  }}
                  placeholder="••••"
                  className="w-full text-center tracking-widest font-mono text-xl font-extrabold rounded-xl border border-gray-200 focus:border-[#00a6ff] focus:ring-1 focus:ring-[#00a6ff] p-3.5 bg-gray-50/50 text-[#0E1338] transition"
                  required
                />
                
                {pin.length > 0 && pin.length < 4 && (
                  <p className="text-xs text-amber-500 font-semibold text-center mt-2 animate-pulse">
                    Please key in exactly 4 digits. ({pin.length}/4)
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={pin.length !== 4}
              className={`w-full py-3.5 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-md mt-2 cursor-pointer uppercase tracking-wider text-[11px] ${
                pin.length === 4 ? 'bg-[#0E1338] hover:bg-opacity-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <span>Set Sign-in PIN</span>
              <ArrowRight className="w-4 h-4 text-[#00A6FF]" />
            </button>

            <div className="pt-2 border-t border-gray-150/50 mt-4 space-y-2">
              <button
                type="button"
                disabled={pin.length !== 4}
                onClick={() => {
                  if (pin.length === 4) {
                    onCompleteOnboarding(
                      username || 'No Name Provided',
                      email || 'no-email@yeedem.com',
                      'My Business Ledger',
                      phone || '0000000000',
                      'No physical address logged',
                      'buy_and_sell',
                      'classic',
                      pin,
                      true // skippedOnboarding
                    );
                  }
                }}
                className={`w-full py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider transition border text-center flex items-center justify-center gap-1.5 ${
                  pin.length === 4 
                    ? 'border-gray-200 hover:bg-gray-50 text-gray-500 cursor-pointer hover:border-gray-300' 
                    : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                }`}
                title={pin.length === 4 ? "Skip remaining store configuration & launch default ledger" : "Specify a active 4-digit PIN to Skip Onboarding"}
              >
                <span>Skip Store Configuration</span>
                <span className="text-[9px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Bypass</span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: PROFILE/MERCHANT IDENTITY */}
        {step === 2 && (
          <form onSubmit={handleNext} className="space-y-5">
            <div className="space-y-1 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
              <h2 className="text-sm font-extrabold text-[#0E1338] flex items-center gap-1.5 leading-none">
                <Sparkles className="w-4 h-4 text-[#00A6FF]" />
                Create Private Merchant Key Account
              </h2>
              <p className="text-gray-500 text-[11px] leading-relaxed pt-0.5">
                Register your store manager credentials to preserve sync points on Yeedem databases.
              </p>
            </div>

            <div className="space-y-4">
              
              {/* Input 1: Full Name */}
              <div className="relative">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block font-extrabold text-[#4A5568] uppercase tracking-wider text-[10px]">
                    Merchant Full Name
                  </label>
                  
                  <div className="relative">
                    <button 
                      type="button"
                      onMouseEnter={() => setActiveTooltip('username')}
                      onMouseLeave={() => setActiveTooltip(null)}
                      onClick={() => toggleTooltip('username')}
                      className="p-1 hover:bg-gray-100 rounded-full text-[#00A6FF] transition cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                    
                    {activeTooltip === 'username' && (
                      <div className="absolute right-0 bottom-6 z-20 w-64 bg-[#0E1338] text-white text-[11px] p-3 rounded-xl shadow-xl border border-white/10 animate-fadeIn">
                        <p className="font-bold mb-1 text-[#00A6FF]">Owner Name handle</p>
                        <p className="text-gray-300 leading-normal">
                          This serves as your personal signature identifier inside Yeedem logs and reports.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Chukwuemeka Alaba"
                  className="w-full text-xs rounded-xl border border-gray-200 focus:border-[#00a6ff] focus:ring-1 focus:ring-[#00a6ff] p-3 bg-gray-50/50 text-[#0E1338] transition font-semibold"
                  required
                />
              </div>

              {/* Input 2: Business Email Contacts */}
              <div className="relative">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block font-extrabold text-[#4A5568] uppercase tracking-wider text-[10px]">
                    Business Email Address
                  </label>
                  
                  <div className="relative">
                    <button 
                      type="button"
                      onMouseEnter={() => setActiveTooltip('email')}
                      onMouseLeave={() => setActiveTooltip(null)}
                      onClick={() => toggleTooltip('email')}
                      className="p-1 hover:bg-gray-100 rounded-full text-[#00A6FF] transition cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                    
                    {activeTooltip === 'email' && (
                      <div className="absolute right-0 bottom-6 z-20 w-64 bg-[#0E1338] text-white text-[11px] p-3 rounded-xl shadow-xl border border-white/10 animate-fadeIn">
                        <p className="font-bold mb-1 text-[#00A6FF]">Why email credentials?</p>
                        <p className="text-gray-300 leading-normal">
                          This secures emergency password reminders and critical system sync messages.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. emeka@yeedembooks.com"
                  className="w-full text-xs rounded-xl border border-gray-200 focus:border-[#00a6ff] focus:ring-1 focus:ring-[#00a6ff] p-3 bg-gray-50/50 text-[#0E1338] transition font-semibold"
                  required
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 py-3.5 bg-gray-100 hover:bg-gray-200 text-[#0E1338] font-bold rounded-xl flex items-center justify-center gap-1.5 transition text-[11px]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              
              <button
                type="submit"
                className="w-2/3 py-3.5 bg-[#0E1338] hover:bg-opacity-95 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-md cursor-pointer uppercase tracking-wider text-[11px]"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 text-[#00A6FF]" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: BUSINESS STORE SETTINGS */}
        {step === 3 && (
          <form onSubmit={handleNext} className="space-y-5">
            <div className="space-y-1 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
              <h2 className="text-sm font-extrabold text-[#0E1338] flex items-center gap-1.5 leading-none">
                <Sparkles className="w-4 h-4 text-[#00A6FF]" />
                Establish Business Store Settings
              </h2>
              <p className="text-gray-500 text-[11px] leading-relaxed pt-0.5">
                Customize your trading store configurations and PDF receipt theme rules.
              </p>
            </div>

            <div className="space-y-4">
              
              {/* Input 0: Business Type */}
              <div className="relative">
                <label className="block font-extrabold text-[#4A5568] uppercase tracking-wider text-[10px] mb-1.5">
                  Business Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBusinessType('buy_and_sell')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      businessType === 'buy_and_sell'
                        ? 'border-[#00A6FF] bg-blue-50 text-[#00A6FF] font-bold'
                        : 'border-gray-200 hover:border-gray-300 text-[#4A5568] bg-white'
                    }`}
                  >
                    Buy & Sell
                  </button>
                  <button
                    type="button"
                    onClick={() => setBusinessType('service')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      businessType === 'service'
                        ? 'border-[#00A6FF] bg-blue-50 text-[#00A6FF] font-bold'
                        : 'border-gray-200 hover:border-gray-300 text-[#4A5568] bg-white'
                    }`}
                  >
                    Service
                  </button>
                </div>
              </div>
              
              {/* Input 3: Store telephone */}
              <div className="relative">
                <label className="block font-extrabold text-[#4A5568] uppercase tracking-wider text-[10px] mb-1.5">Store Telephone</label>
                <input 
                  type="text" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. +234 812-345-6789"
                  className="w-full text-xs rounded-xl border border-gray-200 focus:border-[#00a6ff] focus:ring-1 focus:ring-[#00a6ff] p-3 bg-gray-50/50 text-[#0E1338] transition font-semibold"
                  required
                />
              </div>

              {/* Input 4: Business Address */}
              <div className="relative">
                <label className="block font-extrabold text-[#4A5568] uppercase tracking-wider text-[10px] mb-1.5">Trading Address</label>
                <input 
                  type="text" 
                  value={address} 
                  onChange={e => setAddress(e.target.value)}
                  placeholder="e.g. Shop 24B, Alaba Int. Market"
                  className="w-full text-xs rounded-xl border border-gray-200 focus:border-[#00a6ff] focus:ring-1 focus:ring-[#00a6ff] p-3 bg-gray-50/50 text-[#0E1338] transition font-semibold"
                  required
                />
              </div>

              {/* Input 5: Business Store name */}
              <div className="relative">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block font-extrabold text-[#4A5568] uppercase tracking-wider text-[10px]">
                    Business Store Name (Trading Title)
                  </label>
                  
                  <div className="relative">
                    <button 
                      type="button"
                      onMouseEnter={() => setActiveTooltip('store_name')}
                      onMouseLeave={() => setActiveTooltip(null)}
                      onClick={() => toggleTooltip('store_name')}
                      className="p-1 hover:bg-gray-100 rounded-full text-[#00A6FF] transition cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                    
                    {activeTooltip === 'store_name' && (
                      <div className="absolute right-0 bottom-6 z-20 w-64 bg-[#0E1338] text-white text-[11px] p-3 rounded-xl shadow-xl border border-white/10 animate-fadeIn">
                        <p className="font-bold mb-1 text-[#00A6FF]">Store Brand Name</p>
                        <p className="text-gray-300 leading-normal">
                          The absolute business name listed on PDF bills, invoices, receipts, and headers of your ledger reports.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Yeedem Garri & Wholesale Books"
                  className="w-full text-xs rounded-xl border border-gray-200 focus:border-[#00a6ff] focus:ring-1 focus:ring-[#00a6ff] p-3 bg-gray-50/50 text-[#0E1338] transition font-semibold"
                  required
                />
              </div>

              {/* Input 6: PDF Receipts Theme switch */}
              <div className="relative">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block font-extrabold text-[#4A5568] uppercase tracking-wider text-[10px]">
                    Default Receipts Theme Layout
                  </label>
                  
                  <div className="relative">
                    <button 
                      type="button"
                      onMouseEnter={() => setActiveTooltip('theme')}
                      onMouseLeave={() => setActiveTooltip(null)}
                      onClick={() => toggleTooltip('theme')}
                      className="p-1 hover:bg-gray-100 rounded-full text-[#00A6FF] transition cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                    
                    {activeTooltip === 'theme' && (
                      <div className="absolute right-0 bottom-6 z-20 w-64 bg-[#0E1338] text-white text-[11px] p-3 rounded-xl shadow-xl border border-white/10 animate-fadeIn">
                        <p className="font-bold mb-1 text-[#00A6FF]">Visual PDF Layout Themes</p>
                        <p className="text-gray-300 leading-normal">
                          <strong className="text-white">Classic:</strong> Clean black & white design. <br />
                          <strong className="text-white">Modern Blue:</strong> Ocean visual accents with sleek status blocks. <br />
                          <strong className="text-white">Kiosk Compact:</strong> Formatted for neat 58mm roll-paper thermal printers.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate('classic')}
                    className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                      selectedTemplate === 'classic'
                        ? 'border-[#00A6FF] bg-blue-50/30 text-[#00A6FF] ring-1 ring-[#00A6FF]'
                        : 'border-gray-200 hover:border-gray-300 text-[#4A5568] bg-white'
                    }`}
                  >
                    <span className="font-bold scale-95">Classic</span>
                    <span className="text-[8px] text-gray-400 mt-0.5">Monochrome</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTemplate('modern_blue')}
                    className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                      selectedTemplate === 'modern_blue'
                        ? 'border-[#00a6ff] bg-blue-50/30 text-[#00a6ff] ring-1 ring-[#00a6ff]'
                        : 'border-gray-200 hover:border-gray-300 text-[#4A5568] bg-white'
                    }`}
                  >
                    <span className="font-bold scale-95">Modern</span>
                    <span className="text-[8px] text-gray-400 mt-0.5">Sea Blue</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTemplate('kiosk_compact')}
                    className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                      selectedTemplate === 'kiosk_compact'
                        ? 'border-[#00a6ff] bg-blue-50/30 text-[#00a6ff] ring-1 ring-[#00a6ff]'
                        : 'border-gray-200 hover:border-gray-300 text-[#4A5568] bg-white'
                    }`}
                  >
                    <span className="font-bold scale-95">Kiosk</span>
                    <span className="text-[8px] text-gray-400 mt-0.5">Terminal</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Complete workflow info note */}
            <div className="flex gap-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-[#4A5568]">
              <Info className="w-4 h-4 text-[#00A6FF] shrink-0 mt-0.5" />
              <span>You can modify theme layouts and trading assets inside your profile configurations once registered.</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-1/3 py-3.5 bg-gray-100 hover:bg-gray-200 text-[#0E1338] font-bold rounded-xl flex items-center justify-center gap-1.5 transition text-[11px]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                className="w-2/3 py-4 bg-gradient-to-r from-[#0E1338] to-[#161d4e] hover:opacity-95 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-md cursor-pointer uppercase tracking-wider text-[11px]"
              >
                <UserCheck className="w-4 h-4 text-[#00A6FF]" />
                <span>Open Ledgers</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
