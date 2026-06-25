import { useState, FormEvent } from 'react';
import DebtorAgingPieChart from './DebtorAgingPieChart';
import { Customer, Invoice } from '../types';
import { 
  Search, 
  UserMinus, 
  Plus, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  DollarSign as NairaIcon, 
  MessageSquare, 
  Smartphone, 
  Send, 
  Check, 
  MessageCircle, 
  CheckCheck 
} from 'lucide-react';

interface DebtorsListProps {
  customers: Customer[];
  onRecordPayment: (customerId: string, amount: number) => void;
  onSelectCustomerInvoiceFeed: (customerName: string) => void;
  businessName?: string;
}

export default function DebtorsList({ 
  customers, 
  onRecordPayment, 
  onSelectCustomerInvoiceFeed,
  businessName
}: DebtorsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  // SMS Simulation states
  const [smsCustomer, setSmsCustomer] = useState<Customer | null>(null);
  const [smsPhone, setSmsPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsStatus, setSmsStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [smsLog, setSmsLog] = useState<string[]>([]);

  // WhatsApp Simulation states
  const [waCustomer, setWaCustomer] = useState<Customer | null>(null);
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');
  const [waStatus, setWaStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [waLog, setWaLog] = useState<string[]>([]);

  const handleOpenSmsModal = (cust: Customer) => {
    setSmsCustomer(cust);
    setSmsPhone(cust.phone || '+234 ');
    const displayBalance = cust.activeDebtBalance.toLocaleString(undefined, { minimumFractionDigits: 2 });
    const activeBizName = businessName ? businessName : 'Yeedem Books';
    
    const unpaidInvoices = cust.invoices ? cust.invoices.filter(inv => inv.debtBalance > 0) : [];
    const invoiceLinks = unpaidInvoices.map(inv => {
      const previewToken = "yb_token_" + inv.id.substring(0, 8);
      return `${window.location.origin}/receipts/token/${previewToken}/`;
    });
    const linkSuffix = invoiceLinks.length > 0 ? ` View invoice: ${invoiceLinks[0]}` : '';

    setSmsMessage(`Dear ${cust.name}, this is an automated SMS reminder from ${activeBizName}. You have an outstanding balance of ₦${displayBalance}. Kindly assist with swift payment to offset this balance.${linkSuffix} Thank you!`);
    setSmsStatus('idle');
    setSmsLog([]);
  };

  const handleSendSms = async () => {
    if (!smsPhone || smsPhone.trim() === '') {
      alert("Please specify a valid mobile number.");
      return;
    }
    setSmsStatus('sending');
    setSmsLog(['Initializing GSM gateway handshake...', 'Allocating simulated virtual carrier band...', 'Encrypting payload format...']);
    
    await new Promise(resolve => setTimeout(resolve, 650));
    setSmsLog(prev => [...prev, 'encoding base-channels and frequencies...', `transmitting to SMS Center +234803000000...`, `clearing packet dispatch to: ${smsPhone}`]);
    
    await new Promise(resolve => setTimeout(resolve, 650));
    setSmsLog(prev => [...prev, 'Simulated SMS packet successfully dispatched & confirmed.']);
    setSmsStatus('success');
  };

  const handleOpenWhatsappModal = (cust: Customer) => {
    setWaCustomer(cust);
    setWaPhone(cust.phone || '+234 ');
    const displayBalance = cust.activeDebtBalance.toLocaleString(undefined, { minimumFractionDigits: 2 });
    const activeBizName = businessName ? businessName : 'Yeedem Books';

    const unpaidInvoices = cust.invoices ? cust.invoices.filter(inv => inv.debtBalance > 0) : [];
    const invoiceLinks = unpaidInvoices.map(inv => {
      const previewToken = "yb_token_" + inv.id.substring(0, 8);
      return `${window.location.origin}/receipts/token/${previewToken}/`;
    });
    const invoiceLinksStr = invoiceLinks.length > 0 
      ? `\n\n*View Invoice Ledger${invoiceLinks.length > 1 ? 's' : ''}*:\n${invoiceLinks.map(link => `• ${link}`).join('\n')}` 
      : '';

    setWaMessage(`*Hello ${cust.name}*,\n\nThis is an automated reminder from *${activeBizName}*.\n\nWe would like to gently request your assistance with settling your outstanding ledger balance:\n*Outstanding Amount*: *₦${displayBalance}*${invoiceLinksStr}\n\nPlease let us know when we can expect a transfer. Thank you for your continued patronage!\n\nBest regards,\n*Accounts Management at ${activeBizName}*`);
    setWaStatus('idle');
    setWaLog([]);
  };

  const handleSendWhatsapp = async () => {
    if (!waPhone || waPhone.trim() === '') {
      alert("Please specify a valid mobile number.");
      return;
    }
    setWaStatus('sending');
    setWaLog([
      'Establishing connection with simulated WhatsApp API gateway...',
      'Verifying target WhatsApp account availability on global server network...',
      'Configuring rich template message parameters...',
    ]);
    
    await new Promise(resolve => setTimeout(resolve, 650));
    setWaLog(prev => [
      ...prev,
      'Translating asterisk bold markers to WhatsApp layout representation...',
      'Encrypting message components end-to-end...',
      `Message payload dispatched successfully to broadcast node.`
    ]);
    
    await new Promise(resolve => setTimeout(resolve, 650));
    setWaLog(prev => [...prev, 'Simulated WhatsApp broadcast delivered with delivery tick acknowledgements.']);
    setWaStatus('success');
  };

  // 1. Calculations
  const debtors = customers.filter(
    (c) => c.activeDebtBalance > 0 && c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const overallOutstanding = customers.reduce((acc, cr) => acc + cr.activeDebtBalance, 0);

  // Compute aged metrics (0-15 days, 16-30 days, 30+ days)
  let aged0to15 = 0;
  let aged16to30 = 0;
  let agedOver30 = 0;

  customers.forEach((cust) => {
    cust.invoices.forEach((inv) => {
      const debt = inv.debtBalance;
      if (debt <= 0) return;

      const createdDate = new Date(inv.createdAt);
      const diffTime = Math.abs(new Date().getTime() - createdDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 15) {
        aged0to15 += debt;
      } else if (diffDays <= 30) {
        aged16to30 += debt;
      } else {
        agedOver30 += debt;
      }
    });
  });

  const handlePaymentSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please specify a valid payment deposit amount.");
      return;
    }

    if (amount > selectedCustomer.activeDebtBalance) {
      alert("Payment exceeds the outstanding debit total!");
      return;
    }

    onRecordPayment(selectedCustomer.id, amount);
    setPaymentAmount('');
    setSelectedCustomer(null);
  };

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Outstanding */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Total Active Credit</span>
            <p className="text-2xl font-bold text-red-500 font-sans tracking-tight mt-1">
              ₦{overallOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 bg-red-50 text-red-500 rounded-xl">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        {/* 0-15 Days Aging */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">New Debt (0-15d)</span>
            <p className="text-md font-bold text-gray-800 font-sans tracking-tight mt-1">
              ₦{aged0to15.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-2.5 bg-gray-50 text-gray-400 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* 16-30 Days Aging */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Mild Debt (16-30d)</span>
            <p className="text-md font-bold text-amber-600 font-sans tracking-tight mt-1">
              ₦{aged16to30.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Over 30 Days Aging */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Critical Debt (30d+)</span>
            <p className="text-md font-bold text-red-600 font-sans tracking-tight mt-1">
              ₦{agedOver30.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-2.5 bg-red-50 text-red-500 rounded-xl">
            <AlertTriangle className="w-5 h-5 animate-bounce" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Debtors List View */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-lg text-gray-900">Interactive Outstanding Accounts</h2>
            <div className="relative w-48">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search debtor..."
                className="w-full text-xs pl-9 pr-4 py-2 bg-gray-50 rounded-lg border-0 focus:ring-1 focus:ring-blue-500 focus:bg-white text-gray-800 transition"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-gray-600">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Debtor / Client Name</th>
                  <th className="py-3 px-4 text-right">Owed Amount</th>
                  <th className="py-3 px-4 text-center">Invoices Count</th>
                  <th className="py-3 px-4 text-right">Age Indicator</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {debtors.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 italic">
                      No matching outstanding accounts found. Everything is fully settled!
                    </td>
                  </tr>
                ) : (
                  debtors.map((cust) => {
                    // Find his oldest outstanding unpaid invoice
                    const unpaidInvoices = cust.invoices.filter((i) => i.totalAmount - i.amountPaid > 0);
                    let daysOldest = 0;
                    if (unpaidInvoices.length > 0) {
                      const dates = unpaidInvoices.map((i) => new Date(i.createdAt).getTime());
                      const oldestTime = Math.min(...dates);
                      daysOldest = Math.ceil(Math.abs(new Date().getTime() - oldestTime) / (1000 * 60 * 60 * 24));
                    }

                    return (
                      <tr key={cust.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                        <td className="py-3.5 px-4 font-semibold text-gray-800 font-sans">
                          {cust.name}
                          <span className="block text-[10px] font-normal text-gray-400 mt-0.5">Joined {cust.createdDate}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-red-500 font-bold font-mono text-sm">
                          ₦{cust.activeDebtBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-center font-medium text-gray-700">
                          {cust.invoices.length}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            daysOldest > 30 
                              ? 'bg-red-50 text-red-600 border border-red-100' 
                              : daysOldest > 15 
                                ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                                : 'bg-gray-100 text-gray-600'
                          }`}>
                            {daysOldest}d outstanding
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedCustomer(cust)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100/80 text-amber-700 font-medium text-[10px] rounded transition whitespace-nowrap"
                            >
                              Repay
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectCustomerInvoiceFeed(cust.name)}
                              className="px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium text-[10px] rounded transition whitespace-nowrap"
                            >
                              Receipt
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenSmsModal(cust)}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-[10px] rounded transition inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <Smartphone className="w-2.5 h-2.5" />
                              <span>SMS</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenWhatsappModal(cust)}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium text-[10px] rounded transition inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <MessageCircle className="w-2.5 h-2.5" />
                              <span>WhatsApp</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Repayment Settlement Console */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="font-display font-semibold text-lg text-gray-900 border-b pb-2">Aging Visualization</h2>
            <DebtorAgingPieChart data0to15={aged0to15} data16to30={aged16to30} dataOver30={agedOver30} />
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="font-display font-semibold text-lg text-gray-900 border-b pb-2">Repayment Desk</h2>

            {selectedCustomer ? (
              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100 text-xs">
                  <span className="text-gray-400 text-[10px] uppercase font-semibold">Active Ledger Customer</span>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{selectedCustomer.name}</p>
                  
                  <div className="mt-2 text-red-600 flex justify-between">
                    <span>Pending Outstanding:</span>
                    <span className="font-bold">₦{selectedCustomer.activeDebtBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase">Payment Amount (₦)</label>
                  <input
                    type="number"
                    step="any"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full text-sm rounded-xl border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 p-3"
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="flex-1 py-1 px-3 bg-gray-50 hover:bg-gray-150 rounded-xl text-xs font-semibold text-gray-700 border"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-1 px-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-semibold text-white transition shadow"
                  >
                    Record Payment
                  </button>
                </div>
              </form>
            ) : (
              <div className="py-12 text-center text-gray-400 italic text-xs space-y-2">
                <UserMinus className="w-8 h-8 mx-auto text-gray-300" />
                <p>Select "Add Repayment" on any client left to settle outstanding accounts.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* SMS Simulation Modal overlay */}
      {smsCustomer && (
        <div className="fixed inset-0 bg-[#070914]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-lg w-full shadow-2xl border border-gray-150 overflow-hidden flex flex-col max-h-[90vh] animate-fadeIn">
            {/* Modal Header */}
            <div className="p-6 bg-slate-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-slate-900">Broadcast SMS Reminder</h3>
                  <p className="text-[11px] text-gray-400 font-sans mt-0.5">Automated SMS dispatcher (Simulation Suite)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSmsCustomer(null)}
                className="text-gray-400 hover:text-gray-650 bg-gray-100 hover:bg-gray-200 transition p-1.5 rounded-full text-xs font-bold w-7 h-7 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1 select-none">
              <div className="space-y-4">
                {/* Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 font-semibold text-[10px] uppercase tracking-wider mb-1.5">Recipient Full Name</label>
                    <input
                      type="text"
                      value={smsCustomer.name}
                      readOnly
                      disabled
                      className="w-full text-xs bg-gray-50 text-gray-500 border border-gray-200 rounded-xl p-3 cursor-not-allowed font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 font-semibold text-[10px] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Recipient Mobile</span>
                      {!smsCustomer.phone && <span className="text-amber-500 font-mono text-[9px] lowercase font-normal">(Defaulted info)</span>}
                    </label>
                    <input
                      type="text"
                      value={smsPhone || ''}
                      onChange={(e) => setSmsPhone(e.target.value)}
                      placeholder="e.g. +234 803 123 4567"
                      className="w-full text-xs font-mono bg-white text-gray-800 border border-gray-200 focus:border-[#008AE6] focus:ring-1 focus:ring-[#008AE6] rounded-xl p-3"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-500 font-semibold text-[10px] uppercase tracking-wider mb-1.5">SMS Message Body</label>
                  <textarea
                    rows={3}
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    className="w-full text-xs font-sans bg-white text-gray-800 border border-gray-200 focus:border-[#008AE6] focus:ring-1 focus:ring-[#008AE6] rounded-xl p-3 resize-none leading-relaxed"
                  />
                  <div className="flex justify-between items-center text-[10px] text-gray-400 mt-1">
                    <span>Outstanding: <b className="text-red-500">₦{smsCustomer.activeDebtBalance.toLocaleString()}</b></span>
                    <span>{smsMessage.length} characters</span>
                  </div>
                </div>
              </div>

              {/* Physical Mobile Smartphone Simulation Center */}
              <div className="bg-slate-900 rounded-[32px] p-4 pt-11 pb-6 border-4 border-slate-750 shadow-inner relative max-w-xs mx-auto overflow-hidden">
                {/* Speaker pill */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-950 rounded-full flex items-center justify-center">
                  <div className="w-12 h-1 bg-slate-800 rounded-full"></div>
                </div>
                
                {/* Mock phone status bar */}
                <div className="flex justify-between px-3 text-[9px] text-white/40 font-mono mb-2">
                  <span>🚀 Yeedem Carrier</span>
                  <span>10:32 AM</span>
                  <span>🔋 98%</span>
                </div>

                {/* Smartphone screen contents */}
                <div className="bg-slate-950 rounded-2xl p-3 min-h-[150px] flex flex-col justify-between">
                  {/* Sender title */}
                  <div className="text-center font-bold text-[9px] text-white/80 border-b border-white/5 pb-1.5 mb-2 uppercase tracking-wide">
                    💬 Text Message: YeedemSMS
                  </div>

                  {/* Message bubble */}
                  <div className="bg-[#00A6FF] text-white rounded-2xl rounded-tr-none px-3 py-2 text-[10.5px] max-w-[90%] ml-auto shadow-sm leading-relaxed">
                    {smsMessage || <em className="text-sky-300">Constructing message body...</em>}
                  </div>

                  {/* SMS Status indicators */}
                  <div className="text-right text-[9px] text-white/30 font-mono mt-2">
                    {smsStatus === 'sending' && <span className="text-amber-400 animate-pulse">📡 Discharging packet...</span>}
                    {smsStatus === 'success' && <span className="text-emerald-400 flex items-center gap-1 justify-end">✓ Delivered (Simulated)</span>}
                    {smsStatus === 'idle' && <span>Ready to transmit</span>}
                  </div>
                </div>
              </div>

              {/* Simulated Network Logs */}
              {smsLog.length > 0 && (
                <div className="bg-slate-950 font-mono rounded-xl p-3.5 text-[9.5px] text-emerald-400 border border-emerald-500/10 space-y-1">
                  <p className="text-gray-400 font-sans font-bold uppercase mb-1 flex items-center gap-1.5 tracking-wider text-[8.5px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    GSM Broadcast Gateway Stream
                  </p>
                  {smsLog.map((log, lIdx) => (
                    <div key={lIdx} className="flex gap-2 leading-relaxed">
                      <span className="text-white/20">[{lIdx + 1}]</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-6 bg-slate-50 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={() => setSmsCustomer(null)}
                className="flex-1 py-2.5 px-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 transition"
                disabled={smsStatus === 'sending'}
              >
                Close Desk
              </button>
              
              {smsStatus === 'success' ? (
                <div className="flex-1 py-2.5 px-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5 animate-fadeIn">
                  <Check className="w-4 h-4" />
                  Dispatched Successfully
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSendSms}
                  disabled={smsStatus === 'sending'}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white transition shadow flex items-center justify-center gap-1.5 ${
                    smsStatus === 'sending'
                      ? 'bg-amber-500 hover:bg-amber-600 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  {smsStatus === 'sending' ? 'Transmitting...' : 'Send Simulated SMS'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Simulation Modal Overlay */}
      {waCustomer && (
        <div className="fixed inset-0 bg-[#070914]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-lg w-full shadow-2xl border border-gray-150 overflow-hidden flex flex-col max-h-[90vh] animate-fadeIn">
            {/* Modal Header */}
            <div className="p-6 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-500 text-white rounded-xl flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-emerald-950">Broadcast WhatsApp Reminder</h3>
                  <p className="text-[11px] text-emerald-600 font-sans mt-0.5">Automated WhatsApp transmitter (Simulation Suite)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaCustomer(null)}
                className="text-emerald-700 hover:text-emerald-900 bg-emerald-100/50 hover:bg-emerald-100 transition p-1.5 rounded-full text-xs font-bold w-7 h-7 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1 select-none">
              <div className="space-y-4">
                {/* Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 font-semibold text-[10px] uppercase tracking-wider mb-1.5">Recipient Full Name</label>
                    <input
                      type="text"
                      value={waCustomer.name}
                      readOnly
                      disabled
                      className="w-full text-xs bg-gray-50 text-gray-500 border border-gray-200 rounded-xl p-3 cursor-not-allowed font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 font-semibold text-[10px] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>WhatsApp Number</span>
                      {!waCustomer.phone && <span className="text-amber-500 font-mono text-[9px] lowercase font-normal">(Defaulted info)</span>}
                    </label>
                    <input
                      type="text"
                      value={waPhone || ''}
                      onChange={(e) => setWaPhone(e.target.value)}
                      placeholder="e.g. +234 803 123 4567"
                      className="w-full text-xs font-mono bg-white text-gray-800 border border-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-500 font-semibold text-[10px] uppercase tracking-wider mb-1.5">WhatsApp Message Body</label>
                  <textarea
                    rows={6}
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                    className="w-full text-xs font-sans bg-white text-gray-800 border border-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 resize-none leading-relaxed font-medium"
                  />
                  <div className="flex justify-between items-center text-[10px] text-gray-400 mt-1">
                    <span>Outstanding: <b className="text-red-500">₦{waCustomer.activeDebtBalance.toLocaleString()}</b></span>
                    <span>{waMessage.length} characters</span>
                  </div>
                </div>
              </div>

              {/* Physical Mobile Smartphone Simulation Center formatted as WhatsApp */}
              <div className="bg-slate-900 rounded-[32px] p-4 pt-11 pb-6 border-4 border-slate-750 shadow-inner relative max-w-xs mx-auto overflow-hidden">
                {/* Speaker pill */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-950 rounded-full flex items-center justify-center">
                  <div className="w-12 h-1 bg-slate-800 rounded-full"></div>
                </div>
                
                {/* Mock phone status bar */}
                <div className="flex justify-between px-3 text-[9px] text-white/40 font-mono mb-2">
                  <span>🚀 WhatsApp Network</span>
                  <span>10:32 AM</span>
                  <span>🔋 98%</span>
                </div>

                {/* Smartphone WhatsApp Theme Custom screen */}
                <div className="bg-[#efeae2] rounded-2xl overflow-hidden flex flex-col min-h-[190px] border border-gray-200 shadow-sm justify-between">
                  {/* WhatsApp Custom Header */}
                  <div className="bg-[#075E54] text-white px-3 py-2 flex items-center gap-2 text-[10px] font-sans">
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[8px] flex items-center justify-center shadow-sm uppercase shrink-0">
                      {waCustomer.name.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate text-[10px] leading-tight text-white">{waCustomer.name}</p>
                      <p className="text-[7px] text-emerald-100 leading-none mt-0.5">Online</p>
                    </div>
                  </div>

                  {/* WhatsApp chat message body bubble container */}
                  <div className="p-2 space-y-2 flex-1 flex flex-col justify-end">
                    <div className="bg-[#DCF8C6] text-gray-800 rounded-xl rounded-tr-none px-2.5 py-1.5 text-[9px] max-w-[92%] ml-auto shadow-xs leading-relaxed relative border border-emerald-100/10">
                      <p className="whitespace-pre-wrap">{waMessage || <em className="text-emerald-700">Type message details...</em>}</p>
                      <div className="flex items-center justify-end gap-1 text-[7px] text-gray-400 font-mono mt-1 text-right">
                        <span>10:32 AM</span>
                        {waStatus === 'success' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-[#34B7F1]" />
                        ) : (
                          <Check className="w-2.5 h-2.5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* WA Status state bars */}
                  <div className="bg-[#f0f0f0] border-t border-gray-200 py-1 px-3.5 flex justify-between items-center text-[8px] text-gray-500 font-mono">
                    {waStatus === 'sending' && <span className="text-amber-600 animate-pulse">📡 Broadcasting API Packet...</span>}
                    {waStatus === 'success' && <span className="text-emerald-600 font-bold">✓ Sent & Delivered (Cloud Simulation)</span>}
                    {waStatus === 'idle' && <span>Ready to broadcast</span>}
                  </div>
                </div>
              </div>

              {/* Simulated WhatsApp logs inside Console */}
              {waLog.length > 0 && (
                <div className="bg-slate-950 font-mono rounded-xl p-3.5 text-[9.5px] text-emerald-400 border border-emerald-500/10 space-y-1">
                  <p className="text-gray-400 font-sans font-bold uppercase mb-1 flex items-center gap-1.5 tracking-wider text-[8.5px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    WhatsApp cloud simulation webhook logs
                  </p>
                  {waLog.map((log, lIdx) => (
                    <div key={lIdx} className="flex gap-2 leading-relaxed">
                      <span className="text-white/20">[{lIdx + 1}]</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal actions */}
            <div className="p-6 bg-slate-50 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={() => setWaCustomer(null)}
                className="flex-1 py-2.5 px-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 transition"
                disabled={waStatus === 'sending'}
              >
                Close Desk
              </button>

              {waStatus === 'success' ? (
                <div className="flex-1 py-2.5 px-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5 animate-fadeIn">
                  <CheckCheck className="w-4 h-4 text-emerald-600" />
                  Delivered on WhatsApp
                </div>
              ) : (
                <div className="flex-1 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleSendWhatsapp}
                    disabled={waStatus === 'sending'}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white transition shadow flex items-center justify-center gap-1.5 ${
                      waStatus === 'sending'
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {waStatus === 'sending' ? 'Sending API request...' : 'Send Simulated WhatsApp'}
                  </button>
                  <a
                    href={`https://wa.me/${waPhone.replace(/[\s\+\-\(\)]/g, '')}?text=${encodeURIComponent(waMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-750 text-white rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Open Real WhatsApp App ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
