import React from 'react';
import { CreditCard, Users, DollarSign } from 'lucide-react';
import { formatNaira } from '../utils/currency';

interface QuickActionsProps {
  metrics: {
    salesTotal: number;
    paidTotal: number;
    netProfit: number;
    outstandingTotal: number;
  };
  kpisPref?: Array<{ id: string; label: string; visible: boolean }>;
}

export function DashboardQuickActions({ metrics, kpisPref }: QuickActionsProps) {
  const defaultCards = [
    { id: 'collected', title: 'Total Collected', value: metrics.paidTotal, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'debt', title: 'Pending Debt', value: metrics.outstandingTotal, icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
    { id: 'profit', title: 'Real Net Profit', value: metrics.netProfit, icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  // Map settings to render in specified order & filter hidden ones
  const activeCards = kpisPref 
    ? kpisPref
        .filter(pref => pref.visible)
        .map(pref => defaultCards.find(card => card.id === pref.id))
        .filter((card): card is typeof defaultCards[0] => !!card)
    : defaultCards;

  if (activeCards.length === 0) return null;

  return (
    <div className={`grid grid-cols-1 md:grid-cols-${Math.min(3, activeCards.length)} gap-6 mb-6`}>
      {activeCards.map((card, idx) => (
        <div key={card.id} className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-150 flex items-center gap-4 animate-scaleIn">
          <div className={`${card.bg} p-4 rounded-2xl`}>
            <card.icon className={`w-6 h-6 ${card.color}`} />
          </div>
          <div>
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{card.title}</p>
            <p className="text-xl font-extrabold text-gray-900 mt-1">{formatNaira(card.value)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
