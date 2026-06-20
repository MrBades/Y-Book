import React, { useState, useEffect } from 'react';
import { formatNaira } from '../utils/currency';
import { 
  Shield, 
  Settings, 
  Sliders, 
  Coins, 
  Database, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Radio, 
  Flame, 
  Compass, 
  Lock, 
  Unlock, 
  Tag, 
  Plus, 
  DollarSign, 
  TrendingUp, 
  Activity, 
  UserCheck,
  Globe
} from 'lucide-react';
import { apiFetch } from '../lib/api';

interface DjangoAdminControllerProps {
  customers: any[];
  products: any[];
  restockLogs: any[];
  onUpdateCustomers: (updated: any[]) => void;
  onUpdateProducts: (updated: any[]) => void;
  userEmail: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  type: 'INFO' | 'WARN' | 'SUCCESS' | 'CRITICAL';
  code: string;
  message: string;
}

export default function DjangoAdminController({
  customers,
  products,
  restockLogs,
  onUpdateCustomers,
  onUpdateProducts,
  userEmail
}: DjangoAdminControllerProps) {
  // Telemetry Metrics
  const totalOutstandingDebt = customers.reduce((sum, c) => sum + (Number(c.activeDebtBalance) || 0), 0);
  const totalProductsCount = products.length;
  const lowStockCount = products.filter(p => p.stock <= (p.minQuantityCount ?? 5)).length;
  
  // Custom Controls Input States
  const [priceAdjustmentPercent, setPriceAdjustmentPercent] = useState<number>(10);
  const [targetMinStock, setTargetMinStock] = useState<number>(25);
  const [simulatedRegion, setSimulatedRegion] = useState<string>('NG-Lagos');
  const [deviceFpMock, setDeviceFpMock] = useState<string>('fp_default_owner');
  const [isLockoutTriggered, setIsLockoutTriggered] = useState(false);
  const [telemetryRefreshes, setTelemetryRefreshes] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/auth/whatsapp-webhook` 
    : 'https://yeedem.alwaysdata.net/api/auth/whatsapp-webhook';

  const verifyTokenVal = "yeedem_verification_token";

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(verifyTokenVal);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };
  
  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    {
      id: '1',
      timestamp: new Date().toLocaleTimeString(),
      type: 'INFO',
      code: 'SYS_BOOT',
      message: 'Django administrative control engine synchronized with active local ledger.'
    }
  ]);

  const addAuditLog = (type: 'INFO' | 'WARN' | 'SUCCESS' | 'CRITICAL', code: string, message: string) => {
    const newLog: AuditLog = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      code,
      message
    };
    setAuditLogs(prev => [newLog, ...prev].slice(0, 15)); // Keep latest 15
  };

  // Trigger quick telemetry refresh visualization
  const handleReloadTelemetry = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setTelemetryRefreshes(p => p + 1);
      addAuditLog('SUCCESS', 'DB_REFRESH', 'Re-parsed database records and compiled fresh telemetry reports.');
    }, 6000);
  };

  // Control action 1: Bulk adjust prices
  const handleAdjustPrices = (direction: 'increase' | 'decrease') => {
    const factor = direction === 'increase' ? (1 + priceAdjustmentPercent / 100) : (1 - priceAdjustmentPercent / 100);
    const updated = products.map(prod => {
      const currentPrice = Number(prod.price || prod.unit_price || 0);
      const newPrice = Math.max(50, Math.round(currentPrice * factor));
      return { 
        ...prod, 
        price: newPrice,
        unit_price: newPrice 
      };
    });
    
    onUpdateProducts(updated);
    addAuditLog(
      'SUCCESS', 
      'SYS_MUTATION_PRICING', 
      `Bulk modified unit prices for ${products.length} catalog items by ${direction === 'increase' ? '+' : '-'}${priceAdjustmentPercent}%.`
    );
  };

  // Control action 2: Clear debt balances for all customers
  const handleClearAllDebt = () => {
    if (!window.confirm("⚠️ Are you sure you want to write-off and clear all customer debts across the ledger store? This is an administrative simulation.")) {
      return;
    }
    const updated = customers.map(cust => ({
      ...cust,
      activeDebtBalance: 0,
      invoices: (cust.invoices || []).map((inv: any) => ({
        ...inv,
        amountPaid: inv.totalAmount,
        status: 'PAID',
        debtBalance: 0
      }))
    }));
    
    onUpdateCustomers(updated);
    addAuditLog('CRITICAL', 'ADMIN_DEBT_WIPE', 'Wiped out all customer credit balances. Registered as store goodwill write-offs.');
  };

  // Control action 3: Restock all low-stock warning items
  const handleRestockWarnings = () => {
    const updated = products.map(prod => {
      const isLowStock = prod.stock <= (prod.minQuantityCount ?? 5);
      if (isLowStock) {
        return {
          ...prod,
          stock: targetMinStock
        };
      }
      return prod;
    });

    onUpdateProducts(updated);
    addAuditLog('SUCCESS', 'RESTOCK_LOW_UNITS', `Auto-stocked all low items up to safe reserves of ${targetMinStock} units.`);
  };

  // Emergency Server Session Unlock API
  const handleUnlockAllServerSessions = async () => {
    setIsSyncing(true);
    try {
      const res = await apiFetch('/api/admin/unlock-all');
      if (res.ok) {
        const payload = await res.json();
        addAuditLog('SUCCESS', 'SERVER_UNLOCK', 'Command accepted. Remotely bypassed and unlocked all suspicious login states.');
        alert("🎉 Success! All developer/clerk login sessions have been successfully unlocked on the Express server.");
      } else {
        throw new Error("Server rejected unlock instruction.");
      }
    } catch (err: any) {
      addAuditLog('WARN', 'SERVER_REJECT', `Remoted lock bypass failed or offline: ${err.message}`);
      alert("⚠️ Request failed. Retrying direct secure bypass simulations.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Mock a security lockout
  const handleLockoutSelfSimulate = () => {
    setIsLockoutTriggered(!isLockoutTriggered);
    if (!isLockoutTriggered) {
      addAuditLog('CRITICAL', 'ANOMALY_LOCK', `Mismatched fingerprinted device '${deviceFpMock}' flagged at coordinates relative to '${simulatedRegion}'. Session locked.`);
    } else {
      addAuditLog('INFO', 'ANOMALY_CLEARED', `Administrative master keys re-verified. Security lock resolved.`);
    }
  };

  return (
    <div id="django-admin-profile-container" className="bg-[#0b0c15] text-slate-100 rounded-[24px] border border-blue-500/20 shadow-2xl shadow-blue-950/20 overflow-hidden transition-all duration-300">
      
      {/* Django Admin Header Shield */}
      <div className="bg-gradient-to-r from-[#0d162d] to-[#040813] border-b border-blue-500/10 p-5 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00A6FF] to-[#0142ff] flex items-center justify-center text-white font-extrabold shadow-lg shadow-blue-500/15">
            <Shield className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#00A6FF] bg-blue-500/10 px-2 py-0.5 rounded">
                SYSTEM ENGINE
              </span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-display font-black tracking-tight flex items-center gap-1.5 mt-0.5">
              Control Desk
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleReloadTelemetry}
            className={`flex items-center gap-2 bg-blue-500/15 hover:bg-blue-500/25 text-[#00A6FF] rounded-xl px-4 py-2 text-xs font-bold transition-all border border-blue-500/20 active:scale-95 ${isSyncing ? 'animate-pulse' : ''}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? "Syncing..." : "Scan Database"}
          </button>
        </div>
      </div>

      {/* Grid of Information Panels */}
      <div className="p-5 md:p-6 space-y-6">
        
        {/* Core Live Database Stat Widgets */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-white/[0.02] hover:bg-white/[0.04] p-4 rounded-2xl border border-white/5 transition flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 text-[#00A6FF] rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider font-mono">Ledger Inventory</p>
              <p className="text-lg font-black mt-0.5">{totalProductsCount} Items</p>
            </div>
          </div>

          <div className="bg-white/[0.02] hover:bg-white/[0.04] p-4 rounded-2xl border border-white/5 transition flex items-center gap-3">
            <div className="p-3 bg-red-500/10 text-red-400 rounded-xl">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider font-mono">Low Stock Alarms</p>
              <p className="text-lg font-black mt-0.5 text-red-400">
                {lowStockCount} alert{lowStockCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="bg-white/[0.02] hover:bg-white/[0.04] p-4 rounded-2xl border border-white/5 transition flex items-center gap-3">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider font-mono">Outstanding Book Debt</p>
              <p className="text-lg font-black mt-0.5 text-[#00A6FF]">
                {formatNaira(totalOutstandingDebt)}
              </p>
            </div>
          </div>

          <div className="bg-white/[0.02] hover:bg-white/[0.04] p-4 rounded-2xl border border-white/5 transition flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider font-mono">Live Sessions DB</p>
              <p className="text-lg font-black mt-0.5 text-emerald-400">Active & Sync</p>
            </div>
          </div>

        </div>

        {/* Administrative Control Dashboard & Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Mutation Controllers */}
          <div className="lg:col-span-12 space-y-5">
            <h3 className="text-xs font-bold text-gray-400 font-mono uppercase tracking-widest flex items-center gap-1.5 border-b border-white/5 pb-2">
              <Sliders className="w-3.5 h-3.5 text-[#00A6FF]" /> Master Database Mutation Controllers
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              {/* Product Price Increaser & Decreaser */}
              <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold font-mono text-gray-300 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-[#00A6FF]" /> 1. Bulk Catalog Price Adjuster
                  </p>
                  <span className="text-[11px] font-mono font-bold text-[#00A6FF]">{priceAdjustmentPercent}% scale</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Allows instant, live adjustments of unit prices upward or downward by a custom percentage offset modifier.
                </p>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" 
                    min="1" 
                    max="50" 
                    value={priceAdjustmentPercent}
                    onChange={(e) => setPriceAdjustmentPercent(Number(e.target.value))}
                    className="w-full accent-[#00A6FF] h-1.5 bg-gray-700 rounded-lg cursor-pointer"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleAdjustPrices('decrease')}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 py-1.5 px-2 rounded-xl text-xs font-bold border border-red-500/20 transition-all"
                  >
                    Reduce prices (-{priceAdjustmentPercent}%)
                  </button>
                  <button
                    onClick={() => handleAdjustPrices('increase')}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 py-1.5 px-2 rounded-xl text-xs font-bold border border-emerald-500/20 transition-all"
                  >
                    Raise prices (+{priceAdjustmentPercent}%)
                  </button>
                </div>
              </div>

              {/* Automatic Stock Warnings Restocker */}
              <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold font-mono text-gray-300 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-emerald-400" /> 2. Smart Alarm Stock Booster
                  </p>
                  <span className="text-[11px] font-mono font-bold text-emerald-400">Target: {targetMinStock} units</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Scans all active low stock warnings. For any items with stock levels 5 or below, administrative triggers boost levels to target units instantly.
                </p>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    value={targetMinStock}
                    onChange={(e) => setTargetMinStock(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
                  />
                </div>
                <button
                  onClick={handleRestockWarnings}
                  className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 py-2 px-3 rounded-xl text-xs font-bold border border-emerald-500/20 transition-all flex items-center justify-center gap-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Boost and Dismiss Low Warnings
                </button>
              </div>

              {/* Zero-out Outstanding Debt */}
              <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 space-y-2.5">
                <p className="text-xs font-bold font-mono text-gray-300 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-amber-400" /> 3. Goodwill Store Credit Write-Off
                </p>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Instantly zero-out all store debt logs or outstanding client balances. This acts as an automated simulated global debt settlement action.
                </p>
                <button
                  onClick={handleClearAllDebt}
                  className="w-full mt-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 py-2.5 px-3 rounded-xl text-xs font-bold border border-amber-500/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" /> Clear All Customer Outstanding Debts
                </button>
              </div>

              {/* Remote Server Session Overrides */}
              <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 space-y-2.5">
                <p className="text-xs font-bold font-mono text-gray-300 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-purple-400" /> 4. Live Server Session Unlock
                </p>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Remotely instruct our Express server system to override all lockout states for secure user sessions under the anomaly heuristic model.
                </p>
                <button
                  onClick={handleUnlockAllServerSessions}
                  className="w-full mt-1 bg-purple-500/10 hover:bg-purple-500/25 text-purple-400 py-2.5 px-3 rounded-xl text-xs font-bold border border-purple-500/15 transition-all flex items-center justify-center gap-1.5"
                >
                  <Unlock className="w-4 h-4" /> Reset Server Lockout Flag Database
                </button>
              </div>

            </div>

          </div>

        </div>

        {/* Real-time Administrative Telemetry Audit Logs */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h3 className="text-xs font-bold text-gray-400 font-mono uppercase tracking-widest flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-[#00A6FF] animate-pulse" /> Live Telemetry & Audit Logs
            </h3>
            <span className="text-[10px] font-mono font-bold text-slate-500">Real-time update streams</span>
          </div>

          <div className="bg-[#05060b] rounded-2xl border border-white/5 p-4 font-mono text-xs overflow-y-auto max-h-[180px] space-y-2 text-gray-300">
            {auditLogs.map(log => {
              const badgeColor = {
                INFO: 'text-blue-400',
                WARN: 'text-amber-400',
                SUCCESS: 'text-emerald-400',
                CRITICAL: 'text-red-400'
              }[log.type];

              return (
                <div key={log.id} className="flex items-start gap-2.5 leading-relaxed text-[11px] py-0.5 border-b border-white/[0.01] last:border-0 hover:bg-white/[0.01]">
                  <span className="text-slate-500 flex-shrink-0">[{log.timestamp}]</span>
                  <span className={`font-bold uppercase flex-shrink-0 ${badgeColor}`}>[{log.code}]</span>
                  <span className="text-slate-200">{log.message}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
