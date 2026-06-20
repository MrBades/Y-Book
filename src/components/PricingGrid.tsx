import React, { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PricingPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  features: string[];
  buttonText: string;
  featured?: boolean;
}

const plans: PricingPlan[] = [
  {
    id: 'sme_basic',
    name: 'SME Basic',
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'Designed for micro-entrepreneurs managing essential records.',
    features: ['5 manual invoices monthly', 'Manual invoice entry', 'Fuse Search Mode'],
    buttonText: 'Get Started Free',
  },
  {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 4500,
    annualPrice: 45000,
    featured: true,
    description: 'Perfect for scaling shops needing AI-powered efficiency.',
    features: ['200 invoices monthly', 'AI invoice parsing', 'Advanced analytics', 'WhatsApp debt alerts'],
    buttonText: 'Select Growth',
  },
  {
    id: 'starter_pro',
    name: 'Starter Pro',
    monthlyPrice: 7500,
    annualPrice: 75000,
    description: 'Ideal for proactive businesses requiring full automation.',
    features: ['Unlimited ledger logs', 'Up to 3 operator staff clerks', 'Automated Daily Cloud Backups'],
    buttonText: 'Start 14-Day Free Trial',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 20000,
    annualPrice: 200000,
    description: 'Robust unified tracking for massive warehouse operations.',
    features: ['Multi-shop synchronization', 'Unlimited clerk/operator accounts', '24/7 Dedicated Support Managers'],
    buttonText: 'Contact Enterprise',
  },
];

export default function PricingGrid({ 
  onNavigate, 
  onUpgrade,
  currentPlan
}: { 
  onNavigate: (screen: 'login' | 'about' | 'terms' | 'guest_invoice') => void; 
  onUpgrade: (plan: string, billingCycle: 'monthly' | 'annually', amount: number) => void;
  currentPlan?: string;
}) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('monthly');
  const [confirmPlan, setConfirmPlan] = useState<PricingPlan | null>(null);

  return (
    <div className="py-12 space-y-8">
      {/* Toggle */}
      <div className="flex justify-center">
        <div className="bg-gray-100 p-1 rounded-full flex items-center gap-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${billingCycle === 'monthly' ? 'bg-white shadow-sm text-[#00A6FF]' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annually')}
            className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${billingCycle === 'annually' ? 'bg-white shadow-sm text-[#00A6FF]' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Annually
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map(plan => {
          const getPlanTier = (planName?: string): number => {
              if (!planName) return 1;
              const lower = planName.toLowerCase();
              if (lower.includes('enterprise')) return 4;
              if (lower.includes('pro') || lower.includes('starter pro') || lower.includes('starter')) return 3;
              if (lower.includes('growth')) return 2;
              return 1; // SME Basic / Free
            };

            const isCurrent = plan.name === currentPlan;
            const currentTier = getPlanTier(currentPlan);
            const targetTier = getPlanTier(plan.name);
            const isDowngrade = currentTier > targetTier;

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-3xl p-6 border transition-all duration-300 flex flex-col justify-between ${
                  isCurrent
                    ? 'border-2 border-emerald-500 shadow-md ring-1 ring-emerald-100 ring-offset-2'
                    : plan.featured 
                      ? 'border-2 border-[#00A6FF] shadow-lg relative' 
                      : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-3 right-4 bg-emerald-500 text-white text-[9px] font-black uppercase px-3 py-1 rounded-full tracking-wider">
                    Current Plan
                  </span>
                )}
                {plan.featured && !isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00A6FF] text-white text-[9px] font-black uppercase px-3 py-1 rounded-full tracking-wider">
                    💥 MOST POPULAR
                  </span>
                )}
                
                <div className="space-y-4">
                  <div>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest ${isCurrent ? 'bg-emerald-50 text-emerald-600' : plan.featured ? 'bg-blue-50 text-[#00A6FF]' : 'bg-gray-100 text-gray-650'}`}>
                      {plan.name}
                    </span>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-[#0E1338]">
                        ₦{billingCycle === 'monthly' ? plan.monthlyPrice.toLocaleString() : (plan.annualPrice / 12).toLocaleString()}
                      </span>
                      <span className="text-gray-400 text-[10px] font-bold">/mo</span>
                    </div>
                    {billingCycle === 'annually' && plan.annualPrice > 0 && (
                      <p className="text-green-600 text-[9px] font-bold mt-1">Save 16% (₦{plan.annualPrice.toLocaleString()} billed yearly)</p>
                    )}
                  </div>
                  
                  <p className="text-gray-450 text-[11px] leading-relaxed">
                    {plan.description}
                  </p>
                  
                  <div className="border-t border-gray-100 pt-4 space-y-3 text-[11px] text-gray-600">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle2 size={14} className={plan.featured ? 'text-[#00A6FF]' : 'text-gray-400'} />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  disabled={isCurrent}
                  onClick={() => {
                    if (isCurrent) return;
                    if (isDowngrade) {
                      alert(`⚠️ Plan Restriction\n\nYou are currently on the higher-tier ${currentPlan} plan. Downgrading to the ${plan.name} plan is disabled directly to prevent features/data cutoff. Please contact Yeedem customer support if you explicitly need to switch tiers.`);
                      return;
                    }
                    setConfirmPlan(plan);
                  }}
                  className={`mt-6 w-full h-10 rounded-xl text-xs font-bold transition shadow-sm ${
                    isCurrent
                      ? 'bg-emerald-50 text-emerald-600 cursor-not-allowed border border-emerald-200'
                      : isDowngrade
                        ? 'border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                        : plan.featured 
                          ? 'bg-[#00A6FF] text-white hover:bg-[#0095E6]' 
                          : 'border border-gray-200 hover:bg-slate-50 text-[#0E1338]'
                  }`}
                >
                  {isCurrent ? 'Active Plan' : isDowngrade ? 'Downgrade Blocked' : plan.buttonText}
                </button>
              </div>
            );
          })}
        </div>

      <AnimatePresence>
        {confirmPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-6 rounded-3xl w-full max-w-sm space-y-4"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">Confirm Upgrade - {confirmPlan.name} Plan</h3>
                <button onClick={() => setConfirmPlan(null)}><X size={20}/></button>
              </div>
              <p className="text-gray-600 text-sm">
                Upgrading to the <span className="font-bold text-[#00A6FF]">{confirmPlan.name}</span> plan unlocks:
              </p>
              <ul className="text-sm text-gray-500 list-disc list-inside space-y-1">
                {confirmPlan.features.map((feature, i) => <li key={i}>{feature}</li>)}
              </ul>
              <p className="text-gray-600 text-sm">Are you sure you want to proceed?</p>
              <button
                onClick={() => {
                  const amt = billingCycle === 'monthly' ? confirmPlan.monthlyPrice : confirmPlan.annualPrice;
                  onUpgrade(confirmPlan.name, billingCycle, amt);
                  setConfirmPlan(null);
                }}
                className="w-full bg-[#00A6FF] text-white py-2 rounded-xl font-bold hover:bg-[#0095E6] transition"
              >
                Confirm & Pay ₦{billingCycle === 'monthly' ? confirmPlan.monthlyPrice.toLocaleString() : confirmPlan.annualPrice.toLocaleString()}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
