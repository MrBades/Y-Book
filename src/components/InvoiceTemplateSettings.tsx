import { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';
import { BusinessProfile, Invoice, TextSectionStyles } from '../types';
import { 
  Palette, 
  Upload, 
  Award, 
  ShieldAlert, 
  CheckCircle2, 
  Sliders, 
  Eye, 
  FileText, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles 
} from 'lucide-react';
import BrandingPreviewModal from './BrandingPreviewModal';

interface InvoiceTemplateSettingsProps {
  business: BusinessProfile;
  onSaveSettings: (settings: BusinessProfile) => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  verification_skipped?: boolean;
  skippedOnboarding?: boolean;
  onAccountVerify?: () => Promise<boolean>;
}

// Fixed realistic mock invoice for the live-customisation preview panel
const dummyInvoiceSample: Invoice = {
  id: "inv_demo_984",
  customerName: "Gbenga Adeniyi",
  productName: "Wholesale Flour & Sugar Sacks",
  items: [
    { name: "Golden Penny Flour Sack", quantity: 2, price: 32000, total: 64000 },
    { name: "White Sugar Sacks (Big)", quantity: 1, price: 28000, total: 28000 },
    { name: "Custard Buckets (Yellow)", quantity: 1, price: 7500, total: 7500 }
  ],
  totalAmount: 99500,
  amountPaid: 75000,
  debtBalance: 24500,
  transactionType: 'sale',
  createdAt: new Date().toISOString()
};

export default function InvoiceTemplateSettings({ 
  business, 
  onSaveSettings, 
  darkMode = false, 
  onToggleDarkMode,
  verification_skipped = false,
  skippedOnboarding = false,
  onAccountVerify
}: InvoiceTemplateSettingsProps) {
  const [businessName, setBusinessName] = useState(business.businessName);
  const [address, setAddress] = useState(business.address || '');
  const [phone, setPhone] = useState(business.phone || '');
  const [businessType, setBusinessType] = useState(business.businessType || 'buy_and_sell');
  const [template, setTemplate] = useState(business.invoiceTemplatePreference);
  const [logoBase64, setLogoBase64] = useState(business.businessLogo || '');
  
  // Custom template attributes state
  const [accentColor, setAccentColor] = useState(business.customAccentColor || '#00A6FF');
  const [logoWidth, setLogoWidth] = useState(business.logoWidth || 50);
  const [logoHeight, setLogoHeight] = useState(business.logoHeight || 50);
  const [logoRotation, setLogoRotation] = useState(business.logoRotation || 0);

  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>(business.customFontSize || 'md');
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif' | 'mono'>(business.customFontFamily || 'sans');
  const [showLogo, setShowLogo] = useState(business.customShowLogo !== false);
  const [headerTitle, setHeaderTitle] = useState(business.customHeaderTitle || 'TAX INVOICE');
  const [footerNotes, setFooterNotes] = useState(business.customFooterNotes || 'Thank you for your business!');
  const [shadowStyle, setShadowStyle] = useState<'none' | 'sm' | 'md' | 'lg' | 'xl'>(business.customShadowStyle || 'md');
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false);

  // Section-by-section stylistic attributes state
  const [headerStyle, setHeaderStyle] = useState<TextSectionStyles>(business.headerStyles || {
    fontSize: 'lg',
    fontFamily: 'sans',
    fontWeight: 'bold',
    textColor: '#0E1338'
  });
  const [customerStyle, setCustomerStyle] = useState<TextSectionStyles>(business.customerStyles || {
    fontSize: 'sm',
    fontFamily: 'sans',
    fontWeight: 'medium',
    textColor: '#374151'
  });
  const [tableStyle, setTableStyle] = useState<TextSectionStyles>(business.tableStyles || {
    fontSize: 'sm',
    fontFamily: 'sans',
    fontWeight: 'semibold',
    textColor: '#111827'
  });
  const [footerStyle, setFooterStyle] = useState<TextSectionStyles>(business.footerStyles || {
    fontSize: 'xs',
    fontFamily: 'sans',
    fontWeight: 'normal',
    textColor: '#6B7280'
  });

  useEffect(() => {
    if (business) {
      setBusinessName(business.businessName || '');
      setAddress(business.address || '');
      setPhone(business.phone || '');
      setBusinessType(business.businessType || 'buy_and_sell');
      setTemplate(business.invoiceTemplatePreference || 'classic');
      setLogoBase64(business.businessLogo || '');
      setAccentColor(business.customAccentColor || '#00A6FF');
      setLogoWidth(business.logoWidth || 50);
      setLogoHeight(business.logoHeight || 50);
      setLogoRotation(business.logoRotation || 0);
      setFontSize(business.customFontSize || 'md');
      setFontFamily(business.customFontFamily || 'sans');
      setShowLogo(business.customShowLogo !== false);
      setHeaderTitle(business.customHeaderTitle || 'TAX INVOICE');
      setFooterNotes(business.customFooterNotes || 'Thank you for your business!');
      setShadowStyle(business.customShadowStyle || 'md');
      setHeaderStyle(business.headerStyles || {
        fontSize: 'lg',
        fontFamily: 'sans',
        fontWeight: 'bold',
        textColor: '#0E1338'
      });
      setCustomerStyle(business.customerStyles || {
        fontSize: 'sm',
        fontFamily: 'sans',
        fontWeight: 'medium',
        textColor: '#374151'
      });
      setTableStyle(business.tableStyles || {
        fontSize: 'sm',
        fontFamily: 'sans',
        fontWeight: 'semibold',
        textColor: '#111827'
      });
      setFooterStyle(business.footerStyles || {
        fontSize: 'xs',
        fontFamily: 'sans',
        fontWeight: 'normal',
        textColor: '#6B7280'
      });
    }
  }, [business]);

  const [activeAccordion, setActiveAccordion] = useState<string | null>('headerStyles');
  const [isSaved, setIsSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const PRESET_LAYOUTS = [
    { id: 'classic', label: 'Monochrome Classic', desc: 'Traditional structured retail ledger layout for general trading.', icon: '📜', badge: 'Classic', color: 'bg-gray-100 text-gray-800 border-gray-200' },
    { id: 'modern_blue', label: 'Ocean Sapphire Blue', desc: 'Corporate blueprint styled with sapphire color borders, grids and clean headings.', icon: '💎', badge: 'Sapphire', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { id: 'kiosk_compact', label: 'Compact Kiosk Ticket', desc: 'Simulated 58mm thermal ticket receipt roll, optimal for quick sales.', icon: '🎫', badge: 'Kiosk', color: 'bg-amber-50 text-amber-950 border-amber-200' },
    { id: 'custom_build', label: 'Custom Designer Canvas', desc: 'Advanced sandbox styling allowing custom typography, colors, and shadows.', icon: '🎨', badge: 'Sandbox', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
  ];

  const currentIdx = PRESET_LAYOUTS.findIndex(p => p.id === template);
  const activePresetIdx = currentIdx >= 0 ? currentIdx : 0;

  const navigatePreset = (direction: 'prev' | 'next') => {
    let nextIdx = activePresetIdx;
    if (direction === 'prev') {
      nextIdx = (activePresetIdx - 1 + PRESET_LAYOUTS.length) % PRESET_LAYOUTS.length;
    } else {
      nextIdx = (activePresetIdx + 1) % PRESET_LAYOUTS.length;
    }
    handleFieldChange('template', PRESET_LAYOUTS[nextIdx].id);
  };

  // Helper to instantly persist and mirror settings up to global State
  const handleFieldChange = (field: string, val: any) => {
    let bName = businessName;
    let addr = address;
    let tel = phone;
    let bType = businessType;
    let tmpl = template;
    let logo = logoBase64;
    let accent = accentColor;
    let sz = fontSize;
    let fam = fontFamily;
    let sl = showLogo;
    let hTitle = headerTitle;
    let fNotes = footerNotes;
    let shadow = shadowStyle;

    if (field === 'businessName') { bName = val; setBusinessName(val); }
    else if (field === 'address') { addr = val; setAddress(val); }
    else if (field === 'phone') { tel = val; setPhone(val); }
    else if (field === 'businessType') { bType = val; setBusinessType(val); }
    else if (field === 'template') { tmpl = val; setTemplate(val); }
    else if (field === 'logoBase64') { logo = val; setLogoBase64(val); }
    else if (field === 'accentColor') { accent = val; setAccentColor(val); }
    else if (field === 'fontSize') { sz = val; setFontSize(val); }
    else if (field === 'fontFamily') { fam = val; setFontFamily(val); }
    else if (field === 'showLogo') { sl = val; setShowLogo(val); }
    else if (field === 'headerTitle') { hTitle = val; setHeaderTitle(val); }
    else if (field === 'footerNotes') { fNotes = val; setFooterNotes(val); }
    else if (field === 'shadowStyle') { shadow = val; setShadowStyle(val); }

    onSaveSettings({
      ...business,
      businessName: bName,
      address: addr,
      phone: tel,
      businessType: bType,
      invoiceTemplatePreference: tmpl,
      businessLogo: logo,
      customAccentColor: accent,
      customFontSize: sz,
      customFontFamily: fam,
      customShowLogo: sl,
      customHeaderTitle: hTitle,
      customFooterNotes: fNotes,
      customShadowStyle: shadow,
      headerStyles: headerStyle,
      customerStyles: customerStyle,
      tableStyles: tableStyle,
      footerStyles: footerStyle
    });
  };

  const handleStyleChange = (section: 'header' | 'customer' | 'table' | 'footer', updated: Partial<TextSectionStyles>) => {
    let freshHeader = headerStyle;
    let freshCustomer = customerStyle;
    let freshTable = tableStyle;
    let freshFooter = footerStyle;

    if (section === 'header') {
      freshHeader = { ...headerStyle, ...updated };
      setHeaderStyle(freshHeader);
    } else if (section === 'customer') {
      freshCustomer = { ...customerStyle, ...updated };
      setCustomerStyle(freshCustomer);
    } else if (section === 'table') {
      freshTable = { ...tableStyle, ...updated };
      setTableStyle(freshTable);
    } else if (section === 'footer') {
      freshFooter = { ...footerStyle, ...updated };
      setFooterStyle(freshFooter);
    }

    onSaveSettings({
      ...business,
      businessName,
      address,
      phone,
      invoiceTemplatePreference: template,
      businessLogo: logoBase64,
      customAccentColor: accentColor,
      customFontSize: fontSize,
      customFontFamily: fontFamily,
      customShowLogo: showLogo,
      customHeaderTitle: headerTitle,
      customFooterNotes: footerNotes,
      customShadowStyle: shadowStyle,
      headerStyles: freshHeader,
      customerStyles: freshCustomer,
      tableStyles: freshTable,
      footerStyles: freshFooter
    });
  };

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setLogoBase64(reader.result);
          handleFieldChange('logoBase64', reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearLogo = () => {
    setLogoBase64('');
    handleFieldChange('logoBase64', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      alert("Business Name is required!");
      return;
    }
    onSaveSettings({
      ...business,
      businessName,
      address,
      phone,
      businessType,
      invoiceTemplatePreference: template,
      businessLogo: logoBase64,
      customAccentColor: accentColor,
      customFontSize: fontSize,
      customFontFamily: fontFamily,
      customShowLogo: showLogo,
      customHeaderTitle: headerTitle,
      customFooterNotes: footerNotes,
      customShadowStyle: shadowStyle,
      headerStyles: headerStyle,
      customerStyles: customerStyle,
      tableStyles: tableStyle,
      footerStyles: footerStyle
    });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 4500);
  };

  // -----------------------------------------------------------------
  // LIVE PREVIEW SUB-RENDER DIRECTLY MATCHING THE PDF & SHEET OUTPUTS
  // -----------------------------------------------------------------
  const renderLiveClassicPreview = () => (
    <div className="border-4 border-black p-6 bg-white text-black font-serif uppercase tracking-tight shadow-md select-none">
      <div className="border-b-4 border-black pb-3 flex justify-between items-start">
        <div>
          {logoBase64 && (
            <img src={logoBase64} alt="Logo" className="max-h-12 w-auto mb-2 object-contain" />
          )}
          <h1 className="text-lg font-bold tracking-tighter">{businessName || 'Business Name'}</h1>
          <p className="text-[9px] mt-0.5 font-mono tracking-widest">{address || "LAGOS, NIGERIA"}</p>
          <p className="text-[9px] font-mono tracking-widest">TEL: {phone || "+234 812-345-6789"}</p>
        </div>
        <div className="text-right">
          <h2 className="text-sm font-extrabold border-2 border-black px-2 py-0.5 bg-black text-white">JOURNAL RECEIPT</h2>
          <p className="text-[10px] font-mono mt-1">NO: YB-2026-DEMO</p>
        </div>
      </div>
      <div className="py-3 grid grid-cols-2 gap-2 border-b-2 border-black text-[10px]">
        <div>
          <span className="font-bold block text-[8px]">BILLED TO CUSTOMER:</span>
          <span className="font-semibold block">{dummyInvoiceSample.customerName}</span>
        </div>
        <div className="text-right">
          <span className="font-bold block text-[8px]">ENTRY STATE:</span>
          <span className="font-mono">Wholesale Trade Log</span>
        </div>
      </div>
      <div className="py-3">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b-2 border-black font-extrabold">
              <th className="pb-1 text-left">ITEM</th>
              <th className="pb-1 text-center">QTY</th>
              <th className="pb-1 text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {dummyInvoiceSample.items!.map((itm, idx) => (
              <tr key={idx} className="border-b border-gray-300">
                <td className="py-1.5 text-left font-semibold">{itm.name}</td>
                <td className="py-1.5 text-center font-mono">{itm.quantity}</td>
                <td className="py-1.5 text-right font-mono font-bold">₦{itm.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex border-t-2 border-black pt-3 text-[10px]">
        <div className="w-1/2 text-[8px] italic leading-tight">
          <span>* Real-time classic offline-print preview simulation</span>
        </div>
        <div className="w-1/2 space-y-0.5 text-right">
          <div className="flex justify-between">
            <span>TOTAL:</span>
            <span>₦{dummyInvoiceSample.totalAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold border-t border-black pt-0.5">
            <span>DUE CREDIT:</span>
            <span>₦{dummyInvoiceSample.debtBalance.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLiveModernBluePreview = () => (
    <div className="bg-white rounded-2xl p-6 shadow-md overflow-hidden font-sans text-gray-800 text-[11px] select-none">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-950 -mx-6 -mt-6 px-6 py-4 text-white flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          {logoBase64 ? (
            <div className="p-0.5 rounded bg-white shadow flex items-center justify-center">
              <img src={logoBase64} alt="Logo" className="max-h-8 w-auto object-contain" />
            </div>
          ) : (
            <div className="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-[9px]">YB</div>
          )}
          <div>
            <h1 className="text-xs font-semibold leading-none">{businessName || 'Business Name'}</h1>
            <span className="text-[8px] opacity-75">{address || "Lagos, NG"}</span>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-[9px] font-bold tracking-widest uppercase bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-400/20">
            TAX SLIP
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/20">
        <div>
          <span className="text-[8px] uppercase font-bold text-blue-600">Client Recipient</span>
          <p className="font-semibold text-gray-900 leading-tight mt-0.5">{dummyInvoiceSample.customerName}</p>
        </div>
        <div className="text-right">
          <span className="text-[8px] uppercase font-bold text-gray-400">Date Issued</span>
          <p className="font-semibold text-gray-950 mt-0.5">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="space-y-1 py-1.5 border-b border-gray-100">
        {dummyInvoiceSample.items!.map((itm, idx) => (
          <div key={idx} className="flex justify-between font-medium py-0.5 text-gray-700">
            <span>{itm.name} <span className="text-gray-400">x{itm.quantity}</span></span>
            <span className="font-bold text-gray-900 font-mono">₦{itm.total.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center pt-3 mt-1 font-semibold">
        <span className="text-[9px] text-gray-400">Verified Oceans Blueprint</span>
        <div className="w-32 space-y-0.5 text-right font-mono">
          <div className="flex justify-between text-gray-500 text-[10px]">
            <span>Total:</span>
            <span>₦{dummyInvoiceSample.totalAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-blue-800 font-bold border-t border-gray-100 pt-0.5">
            <span>Debt:</span>
            <span>₦{dummyInvoiceSample.debtBalance.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLiveKioskPreview = () => (
    <div className="bg-amber-50/10 p-5 border-2 border-dashed border-gray-300 font-mono text-[10px] text-gray-650 space-y-3 select-none">
      <div className="text-center space-y-0.5">
        {logoBase64 && (
          <img src={logoBase64} alt="Logo" className="h-8 w-auto mx-auto object-contain pb-1" />
        )}
        <h1 className="font-bold uppercase tracking-wide">{businessName || 'Business Name'}</h1>
        <p className="text-[8px] text-gray-400">{address || "Lagos Shop, NG"}</p>
      </div>

      <div className="border-t border-dashed border-gray-200 py-1.5 space-y-0.5 text-[8.5px]">
        <p>ORDER: YB-2026-DEMOTICKET</p>
        <p>DATE: {new Date().toLocaleString()}</p>
        <p className="uppercase">CLNT: {dummyInvoiceSample.customerName}</p>
      </div>

      <div className="border-t border-dashed border-gray-200 py-2 space-y-1">
        {dummyInvoiceSample.items!.map((itm, idx) => (
          <div key={idx} className="flex justify-between text-[9px]">
            <span>{itm.name.substring(0, 20)} x{itm.quantity}</span>
            <span>₦{itm.total.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-gray-200 pt-2 space-y-0.5">
        <div className="flex justify-between">
          <span>SUM:</span>
          <span>₦{dummyInvoiceSample.totalAmount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-emerald-600">
          <span>PAID:</span>
          <span>₦{dummyInvoiceSample.amountPaid.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-red-500 font-bold">
          <span>BAL:</span>
          <span>₦{dummyInvoiceSample.debtBalance.toLocaleString()}</span>
        </div>
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

  const renderLiveCustomPreview = () => {
    let fontClass = 'font-sans';
    if (fontFamily === 'serif') fontClass = 'font-serif';
    else if (fontFamily === 'mono') fontClass = 'font-mono';

    let densityPadding = 'p-5 space-y-4';
    let textSizeClass = 'text-[11px]';
    let subTitleSizeClass = 'text-[9.5px]';
    if (fontSize === 'sm') {
      densityPadding = 'p-4 space-y-3';
      textSizeClass = 'text-[10px]';
      subTitleSizeClass = 'text-[8.5px]';
    } else if (fontSize === 'lg') {
      densityPadding = 'p-6 space-y-5';
      textSizeClass = 'text-[12.5px]';
      subTitleSizeClass = 'text-[10.5px]';
    }

    let shadowClass = 'shadow-md';
    if (shadowStyle === 'none') shadowClass = 'shadow-none';
    else if (shadowStyle === 'sm') shadowClass = 'shadow-sm';
    else if (shadowStyle === 'md') shadowClass = 'shadow-md';
    else if (shadowStyle === 'lg') shadowClass = 'shadow-lg';
    else if (shadowStyle === 'xl') shadowClass = 'shadow-xl';

    return (
      <div 
        className={`bg-white rounded-2xl border border-gray-100 overflow-hidden text-gray-800 ${fontClass} ${shadowClass} ${densityPadding} transition-all duration-300 select-none`}
      >
        {/* HEADER SECTION */}
        <div 
          className={`flex justify-between items-start border-b p-3 pb-4 rounded-xl ${getFontFamilyClass(headerStyle.fontFamily)} ${getFontWeightClass(headerStyle.fontWeight)} ${getFontSizeClass(headerStyle.fontSize)}`} 
          style={{ borderColor: `${accentColor}1C`, color: headerStyle.textColor, backgroundColor: headerStyle.backgroundColor || '#F9FAFB' }}
        >
          <div className="flex gap-2.5 items-center">
            {logoBase64 && showLogo && (
              <div className="border border-gray-100 rounded-lg bg-white p-1 shrink-0 flex items-center justify-center">
                <img src={logoBase64} alt="Company logo preview" className="max-h-8 w-auto object-contain" />
              </div>
            )}
            <div>
              <h1 className="font-bold leading-tight" style={{ fontSize: fontSize === 'sm' ? '13px' : fontSize === 'lg' ? '17px' : '15px' }}>
                {businessName || 'Business Name'}
              </h1>
              {address && <p className="opacity-75 mt-0.5 leading-snug whitespace-nowrap overflow-hidden text-ellipsis max-w-[170px] text-[10px]">{address}</p>}
              {phone && <p className="opacity-75 font-medium text-[10px]">Tel: {phone}</p>}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-[8px] uppercase font-extrabold tracking-widest px-2 py-0.5 rounded-full border inline-block" style={{ borderColor: `${headerStyle.textColor}35`, backgroundColor: `${headerStyle.textColor}05`, color: headerStyle.textColor }}>
              {headerTitle || 'TAX INVOICE'}
            </h2>
            <p className="opacity-75 font-mono mt-1 text-[9px]">YB-2026-DEMO</p>
          </div>
        </div>

        {/* CUSTOMER SECTION */}
        <div 
          className={`grid grid-cols-2 gap-2 pb-2 ${getFontFamilyClass(customerStyle.fontFamily)} ${getFontWeightClass(customerStyle.fontWeight)} ${getFontSizeClass(customerStyle.fontSize)}`}
          style={{ color: customerStyle.textColor }}
        >
          <div className="p-2 rounded-lg border border-gray-100/50" style={{ backgroundColor: customerStyle.backgroundColor || '#F9FAFB' }}>
            <span className="text-[7.5px] uppercase font-bold text-gray-400 tracking-wider font-sans block">Client Recipient</span>
            <p className="font-bold leading-none mt-0.5" style={{ fontSize: fontSize === 'sm' ? '10px' : '11px' }}>{dummyInvoiceSample.customerName}</p>
          </div>
          <div className="p-2 rounded-lg border border-gray-100/50 text-right" style={{ backgroundColor: customerStyle.backgroundColor || '#F9FAFB' }}>
            <span className="text-[7.5px] uppercase font-bold text-gray-400 tracking-wider font-sans block">State Record</span>
            <p className="font-bold capitalize leading-none mt-0.5" style={{ fontSize: fontSize === 'sm' ? '10px' : '11px' }}>{dummyInvoiceSample.transactionType}</p>
          </div>
        </div>

        {/* ITEMS TABLE SECTION */}
        <div 
          className={`space-y-1.5 py-1 p-2 rounded-lg ${getFontFamilyClass(tableStyle.fontFamily)} ${getFontWeightClass(tableStyle.fontWeight)} ${getFontSizeClass(tableStyle.fontSize)}`}
          style={{ color: tableStyle.textColor, backgroundColor: tableStyle.backgroundColor || 'transparent' }}
        >
          <div className="uppercase tracking-widest font-bold text-[7.5px] text-gray-400 border-b border-gray-50 pb-1 flex justify-between font-sans">
            <span>Description</span>
            <span>Total</span>
          </div>
          {dummyInvoiceSample.items!.map((itm, index) => (
            <div key={index} className="flex justify-between items-center">
              <span className="font-semibold">{itm.name} <span className="opacity-70 font-normal">x{itm.quantity}</span></span>
              <span className="font-bold font-mono">₦{itm.total.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {/* TOTALS & REMARKS FOOTER SECTION */}
        <div 
          className={`flex p-3 rounded-b-xl pt-4 items-start justify-between gap-4 ${getFontFamilyClass(footerStyle.fontFamily)} ${getFontWeightClass(footerStyle.fontWeight)} ${getFontSizeClass(footerStyle.fontSize)}`} 
          style={{ color: footerStyle.textColor, backgroundColor: footerStyle.backgroundColor || '#F9FAFB' }}
        >
          <div className="w-1/2">
            <p className="text-[7.5px] font-bold text-gray-400 uppercase tracking-widest font-sans">Custom Remarks</p>
            <p className="text-[8.5px] mt-1 whitespace-pre-line leading-relaxed italic line-clamp-2 max-w-[130px] opacity-80">{footerNotes || 'Thanks!'}</p>
          </div>
          <div className="w-1/2 space-y-1">
            <div className="flex justify-between opacity-80">
              <span>Total sum:</span>
              <span className="font-mono">₦{dummyInvoiceSample.totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-extrabold border-t pt-1.5 mt-0.5" style={{ borderColor: `${accentColor}30` }}>
              <span style={{ color: accentColor }}>Outstanding:</span>
              <span className="font-mono" style={{ color: accentColor }}>₦{dummyInvoiceSample.debtBalance.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getActiveLivePreview = () => {
    switch (template) {
      case 'modern_blue':
        return renderLiveModernBluePreview();
      case 'kiosk_compact':
        return renderLiveKioskPreview();
      case 'custom_build':
        return renderLiveCustomPreview();
      case 'classic':
      default:
        return renderLiveClassicPreview();
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {isSaved && (
        <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl flex items-center gap-2.5 text-xs font-semibold animate-fadeIn max-w-2xl mx-auto">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-pulse" />
          <span>Branding configurations saved successfully! Custom receipts will download dynamically using these templates.</span>
        </div>
      )}

      {/* Two Columns Grid Setup for Advanced Live Customising */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* PANEL A: FORMS INTERACTION PANEL OF CONTROLS (Taking 6 Columns) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b pb-4 border-gray-50 animate-fadeIn">
              <div>
                <h2 className="font-serif font-extrabold text-[#0E1338] text-base">Corporate Branding Customiser</h2>
                <p className="text-[10px] text-gray-400 mt-0.5 animate-fadeIn">Build premium invoice templates and company profiles in real-time.</p>
                {business && (
                  <div className="mt-1.5 text-[10px] font-sans font-medium text-gray-500 bg-gray-55/40 border border-gray-100 rounded-lg px-2 py-0.5 inline-flex items-center gap-1.5 transition">
                    <span className="font-black text-[#00A6FF] uppercase tracking-wider">{business.businessName || 'Merchant'}</span>
                    {business.phone && (
                      <>
                        <span className="w-0.5 h-2 border-r border-gray-300"></span>
                        <span className="font-mono text-gray-600 font-extrabold">{business.phone}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <Sliders className="w-4 h-4 text-[#00A6FF]" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs text-gray-600">
              
              {/* Account Contact Verification Status */}
              <div className={`p-3 rounded-2xl border flex items-center gap-2.5 transition-all text-xs ${
                verification_skipped 
                  ? 'bg-amber-55 bg-amber-500/5 border-amber-305 border-amber-500/20 text-amber-850' 
                  : 'bg-emerald-55 bg-emerald-500/5 border-emerald-15 border-emerald-500/10 text-[#1B4F72]'
              }`}>
                {verification_skipped ? (
                  <>
                    <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
                    <div className="flex-1">
                      <span className="block text-[10px] font-extrabold text-amber-700 uppercase tracking-wider">⚠️ Phone/Email Non-Verified</span>
                      <p className="text-[10px] text-gray-500 font-medium leading-relaxed mt-0.5">
                        This merchant contact is in a bypassed/skipped authentication state. To log in securely with full API backups, sign in with verified active SMS channels.
                      </p>
                      {onAccountVerify && (
                        <button
                          type="button"
                          onClick={async () => {
                            const success = await onAccountVerify();
                            if (success) {
                              alert("🎉 Your merchant profile is now verified successfully!");
                            }
                          }}
                          className="mt-2 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-[9px] uppercase tracking-wider transition-all cursor-pointer shadow-sm shadow-amber-600/25"
                        >
                          ⚡ Verify Account Now
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div>
                      <span className="block text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">✓ Phone/Email Secured</span>
                      <p className="text-[10px] text-gray-500 font-medium leading-relaxed mt-0.5">
                        Your WhatsApp contact and register profile are securely verified through our Yeedem cloud verification routing.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Name & phone blocks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-400 uppercase tracking-wider text-[9px] mb-1">Store / Business Name</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => handleFieldChange('businessName', e.target.value)}
                    className="w-full text-xs rounded-xl border border-gray-200 outline-none focus:border-[#00A6FF] p-2.5 bg-gray-55/20 transition-all font-semibold"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-gray-400 uppercase tracking-wider text-[9px]">Store Telephone</label>
                    {verification_skipped ? (
                      <span className="text-[8px] font-black uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        ⚠️ Non-Verified
                      </span>
                    ) : (
                      <span className="text-[8px] font-black uppercase bg-emerald-100 text-[#2ECC71] px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        ✓ Verified
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    placeholder="e.g. +234 812-7000-YB"
                    className="w-full text-xs rounded-xl border border-gray-200 outline-none focus:border-[#00A6FF] p-2.5 bg-gray-55/20 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Trading address */}
              <div>
                <label className="block font-bold text-gray-400 uppercase tracking-wider text-[9px] mb-1">Trading Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  className="w-full text-xs rounded-xl border border-gray-200 outline-none focus:border-[#00A6FF] p-2.5 bg-gray-55/20 transition-all"
                  placeholder="e.g. Shop 24B, Alaba International Market, Ojo, Lagos"
                />
              </div>

              {/* Business Type selector */}
              <div>
                <label className="block font-bold text-gray-400 uppercase tracking-wider text-[9px] mb-1">Business Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleFieldChange('businessType', 'buy_and_sell')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${businessType === 'buy_and_sell' ? 'bg-[#0E1338] text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    Buy & Sell
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFieldChange('businessType', 'service')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${businessType === 'service' ? 'bg-[#0E1338] text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    Service
                  </button>
                </div>
              </div>

              {/* Application Dashboard Theme Controls */}
              <div className="p-4 bg-[#0E1338]/5 rounded-xl space-y-3 border border-gray-100 flex items-center justify-between dark-mode-toggle-card">
                <div>
                  <span className="block font-bold text-gray-700 uppercase tracking-wider text-[9px]">Application Theme Accent</span>
                  <p className="text-[10px] text-gray-400 mt-0.5">Toggle dark theme dashboard for better visibility in low-light environments.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={darkMode}
                    onChange={onToggleDarkMode}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-[#00A6FF]/30 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00A6FF]"></div>
                </label>
              </div>

              {/* Logo upload panel */}
              <div className="p-4 bg-gray-50/40 rounded-xl space-y-3 border border-gray-100/50">
                <span className="block font-bold text-gray-700 uppercase tracking-wider text-[9px]">Trading Company Logo</span>
                
                {logoBase64 ? (
                  <div className="flex items-center gap-4">
                    <div className="border border-gray-150 rounded-xl bg-white p-2.5 flex justify-center items-center h-16 w-24 shrink-0 shadow-sm">
                      <img src={logoBase64} alt="Company logo branding file" className="max-h-12 w-auto object-contain" />
                    </div>
                    <div>
                      <p className="text-[10px] text-emerald-600 font-bold">✓ Company logo active</p>
                      <button
                        type="button"
                        onClick={handleClearLogo}
                        className="mt-1 text-red-600 hover:text-red-700 font-bold transition hover:underline block text-[9px]"
                      >
                        Clear Corporate Logo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl bg-white p-3 h-16 transition hover:border-[#00A6FF] cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                     <Upload className="w-4 h-4 text-gray-400 mb-0.5" />
                    <span className="text-[9px] text-[#00A6FF] font-bold">Select PNG/JPG Corporate Logo</span>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              {/* Layout Presets Visual Carousel & Interactive Dropdown */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-gray-700 uppercase tracking-widest text-[9px]">
                    Invoice Layout Preset Selector
                  </label>
                  <span className="text-[9px] text-gray-400 font-bold bg-white px-1.5 py-0.5 border border-slate-100 rounded">
                    Active Theme: {template || 'classic'}
                  </span>
                </div>

                {/* Dropdown Selector */}
                <div className="relative">
                  <select
                    value={template}
                    onChange={(e) => handleFieldChange('template', e.target.value)}
                    className="w-full text-xs font-bold rounded-xl border border-gray-200 outline-none p-3 bg-white text-gray-800 focus:border-[#00A6FF] shadow-xs cursor-pointer appearance-none"
                  >
                    {PRESET_LAYOUTS.map(preset => (
                      <option key={preset.id} value={preset.id} className="font-semibold text-gray-850">
                        {preset.icon} &nbsp; {preset.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3.5 top-3.5 pointer-events-none text-gray-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>

                {/* VISUAL CAROUSEL INTERFACE */}
                <div className="relative mt-2 bg-white rounded-xl border border-slate-150 p-4 shadow-sm select-none">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => navigatePreset('prev')}
                      className="p-1.5 hover:bg-slate-55 rounded-lg text-gray-400 hover:text-[#0E1338] transition border border-transparent hover:border-slate-150 cursor-pointer"
                      title="Previous template preset"
                    >
                      <ChevronLeft className="w-4.5 h-4.5" />
                    </button>

                    <div className="flex-1 text-center py-1">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-xl">{PRESET_LAYOUTS[activePresetIdx].icon}</span>
                        <div className="text-left">
                          <span className="font-bold text-xs block text-[#0E1338] leading-tight">
                            {PRESET_LAYOUTS[activePresetIdx].label}
                          </span>
                          <span className={`inline-block text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md mt-0.5 border ${PRESET_LAYOUTS[activePresetIdx].color}`}>
                            {PRESET_LAYOUTS[activePresetIdx].badge} theme active
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2 max-w-xs mx-auto leading-relaxed">
                        {PRESET_LAYOUTS[activePresetIdx].desc}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigatePreset('next')}
                      className="p-1.5 hover:bg-slate-55 rounded-lg text-gray-400 hover:text-[#0E1338] transition border border-transparent hover:border-slate-150 cursor-pointer"
                      title="Next template preset"
                    >
                      <ChevronRight className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  {/* Positioning Indicators (Dots Grid) */}
                  <div className="flex justify-center gap-1.5 mt-2.5">
                    {PRESET_LAYOUTS.map((p, idx) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleFieldChange('template', p.id)}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === activePresetIdx ? 'bg-[#00A6FF] w-4' : 'bg-slate-200 hover:bg-slate-350'}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Direct High Fidelity Sandbox PDF Preview modal Launcher */}
                <button
                  type="button"
                  onClick={() => setIsBrandingModalOpen(true)}
                  className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/15 text-amber-850 hover:text-amber-950 rounded-xl text-[10px] font-bold tracking-wide uppercase transition border border-amber-500/15 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> Verify Sandbox PDF Document Output
                </button>
              </div>

              {/* Advanced parameter workspace options for custom creator preference */}
              {template === 'custom_build' && (
                <div className="p-4 bg-amber-50/10 border-2 border-dashed border-amber-200/40 rounded-xl space-y-4 animate-fadeIn">
                  
                  {/* Accent Color selections */}
                  <div>
                    <span className="block font-bold text-gray-400 uppercase tracking-wider text-[9.5px] mb-1.5">Accent Color Branding</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => handleFieldChange('accentColor', e.target.value)}
                        className="w-8 h-8 p-0.5 rounded cursor-pointer bg-white border"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {['#00A6FF', '#10B981', '#111827', '#E11D48', '#8B5CF6', '#F59E0B'].map(col => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => handleFieldChange('accentColor', col)}
                            style={{ backgroundColor: col }}
                            className={`w-5 h-5 rounded-full border ${accentColor === col ? 'ring-2 ring-amber-500 border-white scale-110 shadow-sm' : 'border-gray-200'}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Font Style */}
                  <div>
                    <span className="block font-bold text-gray-400 uppercase tracking-wider text-[9.5px] mb-1.5">Branding Typographic selection</span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { val: 'sans' as const, label: 'Inter Sans', subtitle: 'Modern' },
                        { val: 'serif' as const, label: 'Times Serif', subtitle: 'Classic' },
                        { val: 'mono' as const, label: 'Fira Mono', subtitle: 'Books' }
                      ].map(f => (
                        <button
                          key={f.val}
                          type="button"
                          onClick={() => handleFieldChange('fontFamily', f.val)}
                          className={`p-2 rounded-lg border text-center transition ${fontFamily === f.val ? 'border-amber-500 bg-white text-amber-900 font-bold' : 'border-gray-200 bg-white'}`}
                        >
                          <span className="block leading-none text-xs">{f.label}</span>
                          <span className="text-[8px] opacity-75">{f.subtitle}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Header title */}
                  <div>
                    <label className="block font-bold text-gray-400 uppercase tracking-wider text-[9.5px] mb-1.5">Document Header Title text</label>
                    <input
                      type="text"
                      value={headerTitle}
                      onChange={(e) => handleFieldChange('headerTitle', e.target.value)}
                      placeholder="e.g. OFFICIAL TRADE SLIP, TAX INVOICE"
                      className="w-full text-xs rounded-lg border border-gray-200 outline-none p-2 focus:border-amber-500 bg-white font-semibold"
                    />
                  </div>

                  {/* Logo checkbox, density, and shadow */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block font-bold text-gray-400 uppercase tracking-wider text-[9.5px] mb-1.5">Density / Spacing</span>
                      <div className="flex bg-white rounded-lg border p-0.5">
                        {(['sm', 'md', 'lg'] as const).map(sz => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => handleFieldChange('fontSize', sz)}
                            className={`flex-1 py-1 rounded text-[10px] uppercase font-bold transition-all ${fontSize === sz ? 'bg-amber-600 text-white' : 'text-gray-500'}`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block font-bold text-gray-400 uppercase tracking-wider text-[9.5px] mb-1.5">Shadow Thickness</span>
                      <div className="flex bg-white rounded-lg border p-0.5">
                        {(['none', 'sm', 'md', 'lg'] as const).map(sw => (
                          <button
                            key={sw}
                            type="button"
                            onClick={() => handleFieldChange('shadowStyle', sw)}
                            className={`flex-1 py-1 rounded text-[9px] uppercase font-bold transition-all ${shadowStyle === sw ? 'bg-amber-600 text-white' : 'text-gray-500'}`}
                          >
                            {sw}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 py-1.5">
                    <input
                      type="checkbox"
                      id="opt_show_logo"
                      checked={showLogo}
                      onChange={(e) => handleFieldChange('showLogo', e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <label htmlFor="opt_show_logo" className="font-bold text-gray-700 select-none cursor-pointer">
                      Render Company Logo on PDF output
                    </label>
                  </div>

                  {/* Footer message remarks */}
                  <div>
                    <label className="block font-bold text-gray-400 uppercase tracking-wider text-[9.5px] mb-1">Standard Footer terms & remarks</label>
                    <textarea
                      value={footerNotes}
                      onChange={(e) => handleFieldChange('footerNotes', e.target.value)}
                      placeholder="e.g. Expect quick deliveries. Invoiced net 30 terms."
                      rows={2}
                      className="w-full text-xs rounded-lg border border-gray-200 outline-none p-2 focus:border-amber-500 bg-white resize-none"
                    />
                  </div>

                  {/* Typography & Style Section-by-Section Customise Panel */}
                  <div className="border-t border-amber-200/40 pt-4 mt-2 space-y-4">
                    <span className="block font-bold text-gray-700 uppercase tracking-wider text-[10px]">🎨 Typography & Colors Section-by-Section</span>
                    
                    {/* Header Section */}
                    <div className="bg-white/70 rounded-xl p-3 border border-gray-100 space-y-2">
                      <div className="flex justify-between items-center cursor-pointer" onClick={() => setActiveAccordion(activeAccordion === 'headerStyles' ? null : 'headerStyles')}>
                        <span className="font-bold text-gray-700 text-xs flex items-center gap-1.5">
                          Header Block Typography
                        </span>
                        {activeAccordion === 'headerStyles' ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                      </div>
                      
                      {activeAccordion === 'headerStyles' && (
                        <div className="space-y-3 pt-2 text-[11px] animate-fadeIn">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Font Size</span>
                              <select 
                                value={headerStyle.fontSize} 
                                onChange={(e) => handleStyleChange('header', { fontSize: e.target.value as any })}
                                className="w-full text-xs rounded border border-gray-200 p-1.5 bg-white"
                              >
                                <option value="xs">Extra Small (11px)</option>
                                <option value="sm">Small (12px)</option>
                                <option value="base">Regular (14px)</option>
                                <option value="lg">Heading Lg (16px)</option>
                                <option value="xl">Display Xl (18px)</option>
                                <option value="2xl">Display 2xl (20px)</option>
                                <option value="3xl">Display 3xl (24px)</option>
                              </select>
                            </div>
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Font Family</span>
                              <select 
                                value={headerStyle.fontFamily} 
                                onChange={(e) => handleStyleChange('header', { fontFamily: e.target.value as any })}
                                className="w-full text-xs rounded border border-gray-200 p-1.5 bg-white"
                              >
                                <option value="sans">Inter Sans</option>
                                <option value="serif">Times Serif</option>
                                <option value="mono">Fira Mono</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Thickness (Weight)</span>
                              <select 
                                value={headerStyle.fontWeight} 
                                onChange={(e) => handleStyleChange('header', { fontWeight: e.target.value as any })}
                                className="w-full text-xs rounded border border-gray-200 p-1.5 bg-white"
                              >
                                <option value="normal">Normal</option>
                                <option value="medium">Medium</option>
                                <option value="semibold">Semi-Bold</option>
                                <option value="bold">Bold</option>
                                <option value="extrabold">Extra-Bold</option>
                              </select>
                            </div>
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Text Color</span>
                              <div className="flex gap-1.5 items-center">
                                <input 
                                  type="color" 
                                  value={headerStyle.textColor} 
                                  onChange={(e) => handleStyleChange('header', { textColor: e.target.value })}
                                  className="w-7 h-7 p-0.5 rounded cursor-pointer bg-white border"
                                />
                                <span className="font-mono text-[10px] text-gray-500 uppercase">{headerStyle.textColor}</span>
                              </div>
                            </div>
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Background Color</span>
                              <div className="flex gap-1.5 items-center">
                                <input 
                                  type="color" 
                                  value={headerStyle.backgroundColor || '#F9FAFB'} 
                                  onChange={(e) => handleStyleChange('header', { backgroundColor: e.target.value })}
                                  className="w-7 h-7 p-0.5 rounded cursor-pointer bg-white border"
                                />
                                <span className="font-mono text-[10px] text-gray-500 uppercase">{headerStyle.backgroundColor || '#F9FAFB'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Customer Section */}
                    <div className="bg-white/70 rounded-xl p-3 border border-gray-100 space-y-2">
                      <div className="flex justify-between items-center cursor-pointer" onClick={() => setActiveAccordion(activeAccordion === 'customerStyles' ? null : 'customerStyles')}>
                        <span className="font-bold text-gray-700 text-xs flex items-center gap-1.5">
                          Customer Block Typography
                        </span>
                        {activeAccordion === 'customerStyles' ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                      </div>
                      
                      {activeAccordion === 'customerStyles' && (
                        <div className="space-y-3 pt-2 text-[11px] animate-fadeIn">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Font Size</span>
                              <select 
                                value={customerStyle.fontSize} 
                                onChange={(e) => handleStyleChange('customer', { fontSize: e.target.value as any })}
                                className="w-full text-xs rounded border border-gray-200 p-1.5 bg-white"
                              >
                                <option value="xs">Extra Small (11px)</option>
                                <option value="sm">Small (12px)</option>
                                <option value="base">Regular (14px)</option>
                                <option value="lg">Heading Lg (16px)</option>
                                <option value="xl">Display Xl (18px)</option>
                                <option value="2xl">Display 2xl (20px)</option>
                                <option value="3xl">Display 3xl (24px)</option>
                              </select>
                            </div>
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Font Family</span>
                              <select 
                                value={customerStyle.fontFamily} 
                                onChange={(e) => handleStyleChange('customer', { fontFamily: e.target.value as any })}
                                className="w-full text-xs rounded border border-gray-200 p-1.5 bg-white"
                              >
                                <option value="sans">Inter Sans</option>
                                <option value="serif">Times Serif</option>
                                <option value="mono">Fira Mono</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Thickness (Weight)</span>
                              <select 
                                value={customerStyle.fontWeight} 
                                onChange={(e) => handleStyleChange('customer', { fontWeight: e.target.value as any })}
                                className="w-full text-xs rounded border border-gray-200 p-1.5 bg-white"
                              >
                                <option value="normal">Normal</option>
                                <option value="medium">Medium</option>
                                <option value="semibold">Semi-Bold</option>
                                <option value="bold">Bold</option>
                                <option value="extrabold">Extra-Bold</option>
                              </select>
                            </div>
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Text Color</span>
                              <div className="flex gap-1.5 items-center">
                                <input 
                                  type="color" 
                                  value={customerStyle.textColor} 
                                  onChange={(e) => handleStyleChange('customer', { textColor: e.target.value })}
                                  className="w-7 h-7 p-0.5 rounded cursor-pointer bg-white border"
                                />
                                <span className="font-mono text-[10px] text-gray-500 uppercase">{customerStyle.textColor}</span>
                              </div>
                            </div>
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Background Color</span>
                              <div className="flex gap-1.5 items-center">
                                <input 
                                  type="color" 
                                  value={customerStyle.backgroundColor || '#F9FAFB'} 
                                  onChange={(e) => handleStyleChange('customer', { backgroundColor: e.target.value })}
                                  className="w-7 h-7 p-0.5 rounded cursor-pointer bg-white border"
                                />
                                <span className="font-mono text-[10px] text-gray-500 uppercase">{customerStyle.backgroundColor || '#F9FAFB'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Table Section */}
                    <div className="bg-white/70 rounded-xl p-3 border border-gray-100 space-y-2">
                       <div className="flex justify-between items-center cursor-pointer" onClick={() => setActiveAccordion(activeAccordion === 'tableStyles' ? null : 'tableStyles')}>
                        <span className="font-bold text-gray-700 text-xs flex items-center gap-1.5">
                          Table Items Block Typography
                        </span>
                        {activeAccordion === 'tableStyles' ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                      </div>
                      
                      {activeAccordion === 'tableStyles' && (
                        <div className="space-y-3 pt-2 text-[11px] animate-fadeIn">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Font Size</span>
                              <select 
                                value={tableStyle.fontSize} 
                                onChange={(e) => handleStyleChange('table', { fontSize: e.target.value as any })}
                                className="w-full text-xs rounded border border-gray-200 p-1.5 bg-white"
                              >
                                <option value="xs">Extra Small (11px)</option>
                                <option value="sm">Small (12px)</option>
                                <option value="base">Regular (14px)</option>
                                <option value="lg">Heading Lg (16px)</option>
                                <option value="xl">Display Xl (18px)</option>
                                <option value="2xl">Display 2xl (20px)</option>
                                <option value="3xl">Display 3xl (24px)</option>
                              </select>
                            </div>
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Font Family</span>
                              <select 
                                value={tableStyle.fontFamily} 
                                onChange={(e) => handleStyleChange('table', { fontFamily: e.target.value as any })}
                                className="w-full text-xs rounded border border-gray-200 p-1.5 bg-white"
                              >
                                <option value="sans">Inter Sans</option>
                                <option value="serif">Times Serif</option>
                                <option value="mono">Fira Mono</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Thickness (Weight)</span>
                              <select 
                                value={tableStyle.fontWeight} 
                                onChange={(e) => handleStyleChange('table', { fontWeight: e.target.value as any })}
                                className="w-full text-xs rounded border border-gray-200 p-1.5 bg-white"
                              >
                                <option value="normal">Normal</option>
                                <option value="medium">Medium</option>
                                <option value="semibold">Semi-Bold</option>
                                <option value="bold">Bold</option>
                                <option value="extrabold">Extra-Bold</option>
                              </select>
                            </div>
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Text Color</span>
                              <div className="flex gap-1.5 items-center">
                                <input 
                                  type="color" 
                                  value={tableStyle.textColor} 
                                  onChange={(e) => handleStyleChange('table', { textColor: e.target.value })}
                                  className="w-7 h-7 p-0.5 rounded cursor-pointer bg-white border"
                                />
                                <span className="font-mono text-[10px] text-gray-500 uppercase">{tableStyle.textColor}</span>
                              </div>
                            </div>
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Background Color</span>
                              <div className="flex gap-1.5 items-center">
                                <input 
                                  type="color" 
                                  value={tableStyle.backgroundColor || '#FFFFFF'} 
                                  onChange={(e) => handleStyleChange('table', { backgroundColor: e.target.value })}
                                  className="w-7 h-7 p-0.5 rounded cursor-pointer bg-white border"
                                />
                                <span className="font-mono text-[10px] text-gray-500 uppercase">{tableStyle.backgroundColor || '#FFFFFF'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer Section */}
                    <div className="bg-white/70 rounded-xl p-3 border border-gray-100 space-y-2">
                      <div className="flex justify-between items-center cursor-pointer" onClick={() => setActiveAccordion(activeAccordion === 'footerStyles' ? null : 'footerStyles')}>
                        <span className="font-bold text-[#0E1338] text-xs flex items-center gap-1.5">
                          Remarks & Totals Block Typography
                        </span>
                        {activeAccordion === 'footerStyles' ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                      </div>
                      
                      {activeAccordion === 'footerStyles' && (
                        <div className="space-y-3 pt-2 text-[11px] animate-fadeIn">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Font Size</span>
                              <select 
                                value={footerStyle.fontSize} 
                                onChange={(e) => handleStyleChange('footer', { fontSize: e.target.value as any })}
                                className="w-full text-xs rounded border border-gray-200 p-1.5 bg-white"
                              >
                                <option value="xs">Extra Small (11px)</option>
                                <option value="sm">Small (12px)</option>
                                <option value="base">Regular (14px)</option>
                                <option value="lg">Heading Lg (16px)</option>
                                <option value="xl">Display Lg (18px)</option>
                                <option value="2xl">Display 2xl (20px)</option>
                                <option value="3xl">Display 3xl (24px)</option>
                              </select>
                            </div>
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Font Family</span>
                              <select 
                                value={footerStyle.fontFamily} 
                                onChange={(e) => handleStyleChange('footer', { fontFamily: e.target.value as any })}
                                className="w-full text-xs rounded border border-gray-200 p-1.5 bg-white"
                              >
                                <option value="sans">Inter Sans</option>
                                <option value="serif">Times Serif</option>
                                <option value="mono">Fira Mono</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Thickness (Weight)</span>
                              <select 
                                value={footerStyle.fontWeight} 
                                onChange={(e) => handleStyleChange('footer', { fontWeight: e.target.value as any })}
                                className="w-full text-xs rounded border border-gray-200 p-1.5 bg-white"
                              >
                                <option value="normal">Normal</option>
                                <option value="medium">Medium</option>
                                <option value="semibold">Semi-Bold</option>
                                <option value="bold">Bold</option>
                                <option value="extrabold">Extra-Bold</option>
                              </select>
                            </div>
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Text Color</span>
                              <div className="flex gap-1.5 items-center">
                                <input 
                                  type="color" 
                                  value={footerStyle.textColor} 
                                  onChange={(e) => handleStyleChange('footer', { textColor: e.target.value })}
                                  className="w-7 h-7 p-0.5 rounded cursor-pointer bg-white border"
                                />
                                <span className="font-mono text-[10px] text-gray-500 uppercase">{footerStyle.textColor}</span>
                              </div>
                            </div>
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1">Background Color</span>
                              <div className="flex gap-1.5 items-center">
                                <input 
                                  type="color" 
                                  value={footerStyle.backgroundColor || '#F9FAFB'} 
                                  onChange={(e) => handleStyleChange('footer', { backgroundColor: e.target.value })}
                                  className="w-7 h-7 p-0.5 rounded cursor-pointer bg-white border"
                                />
                                <span className="font-mono text-[10px] text-gray-500 uppercase">{footerStyle.backgroundColor || '#F9FAFB'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                  
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-[#0E1338] hover:bg-black text-white rounded-xl text-xs font-bold shadow-md transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" /> Save Branding Preferences
              </button>
            </form>
          </div>
        </div>

        {/* PANEL B: REAL-TIME LIVE PREVIEW SHEET WORKBENCH (Taking 6 Columns) */}
        <div className="lg:col-span-6 lg:sticky lg:top-6 space-y-4">
          <div className="bg-white/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-[#0E1338]">
              <Eye className="w-4 h-4 text-[#00A6FF]" />
              <span className="text-xs font-bold uppercase tracking-wider">High Fidelity live custom preview</span>
            </div>
            <p className="text-[10px] text-gray-400 leading-none">Instant visual compiling matching downloaded corporate layouts.</p>
            
            {/* Live Document Canvas wrapper */}
            <div className="scale-95 origin-top transition-all duration-300">
              {getActiveLivePreview()}
            </div>
          </div>
        </div>

      </div>

      {isBrandingModalOpen && (
        <BrandingPreviewModal
          isOpen={isBrandingModalOpen}
          onClose={() => setIsBrandingModalOpen(false)}
          invoice={dummyInvoiceSample}
          business={{
            ...business,
            businessName,
            address,
            phone,
            businessType,
            invoiceTemplatePreference: template as any,
            businessLogo: logoBase64,
            customAccentColor: accentColor,
            customFontSize: fontSize,
            customFontFamily: fontFamily,
            customShowLogo: showLogo,
            customHeaderTitle: headerTitle,
            customFooterNotes: footerNotes,
            customShadowStyle: shadowStyle,
            headerStyles: headerStyle,
            customerStyles: customerStyle,
            tableStyles: tableStyle,
            footerStyles: footerStyle
          }}
        />
      )}

    </div>
  );
}
