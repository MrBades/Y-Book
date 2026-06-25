import React, { useState } from 'react';
import { Copy, MessageCircle } from 'lucide-react';
import { Invoice } from '../types';

interface WhatsAppPayLinkProps {
  invoice: Invoice;
  customPaymentLink?: string;
  customerPhone?: string;
  onTriggerModal: () => void;
  onShare: (phone: string) => void;
}

export function WhatsAppPayLinkGenerator({ 
  invoice, 
  customPaymentLink, 
  customerPhone, 
  onTriggerModal,
  onShare 
}: WhatsAppPayLinkProps) {
  const [copied, setCopied] = useState(false);
  const isConfigured = !!customPaymentLink && customPaymentLink.trim() !== '';

  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isConfigured) return;

    if (!customerPhone || customerPhone.trim() === '') {
      onTriggerModal();
    } else {
      onShare(customerPhone);
    }
  };

  const handleCopy = () => {
    if (!isConfigured || !customPaymentLink) return;
    navigator.clipboard.writeText(customPaymentLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between gap-4 mt-4 relative">
      <div className="flex flex-col">
        <span className="text-xs font-bold text-gray-800">WhatsApp Pay-Link</span>
        <span className="text-[10px] text-gray-500">custom payment link</span>
        {!isConfigured && (
          <span className="text-[8px] font-bold text-amber-600 mt-1 uppercase tracking-wider">
            ⚠️ Not set in Merchant Settings
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button 
          onClick={handleShareClick}
          disabled={!isConfigured}
          title={isConfigured ? "Share Pay-Link via WhatsApp" : "Setup custom payment link to enable"}
          className={`p-2 rounded-lg transition ${
            isConfigured 
              ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 cursor-pointer' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
          }`}
        >
          <MessageCircle size={16} />
        </button>
        <button 
          onClick={handleCopy}
          disabled={!isConfigured}
          title={isConfigured ? "Copy custom payment link" : "Setup custom payment link to enable"}
          className={`p-2 rounded-lg transition ${
            isConfigured 
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
          }`}
        >
          <Copy size={16} />
        </button>
      </div>
      {copied && <span className="absolute -bottom-5 right-2 text-[9px] text-emerald-500 font-bold">Copied!</span>}
    </div>
  );
}
