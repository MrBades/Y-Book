import React, { useState } from 'react';
import { Copy, MessageCircle } from 'lucide-react';
import { Invoice } from '../types';

interface WhatsAppPayLinkProps {
  invoice: Invoice;
  businessPhone: string;
}

export function WhatsAppPayLinkGenerator({ invoice, businessPhone }: WhatsAppPayLinkProps) {
  const [copied, setCopied] = useState(false);
  const message = `Verify invoice #${invoice.id.substring(0, 8)} payment. Amount: ${invoice.totalAmount}.`;
  
  // Basic cleaning of phone number
  const formattedPhone = businessPhone.replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(whatsappUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between gap-4 mt-4 relative">
      <div className="flex flex-col">
        <span className="text-xs font-bold text-gray-800">WhatsApp Pay-Link</span>
        <span className="text-[10px] text-gray-500">Quick link to verify invoice payment.</span>
      </div>
      <div className="flex items-center gap-2">
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition">
          <MessageCircle size={16} />
        </a>
        <button onClick={handleCopy} className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition">
          <Copy size={16} />
        </button>
      </div>
      {copied && <span className="absolute -bottom-5 right-2 text-[9px] text-emerald-500 font-bold">Copied!</span>}
    </div>
  );
}
