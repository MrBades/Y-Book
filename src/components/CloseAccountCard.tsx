import React, { useState } from 'react';
import { Trash2, AlertTriangle, ShieldAlert, Loader2, ArrowLeft, CheckSquare, Square } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface CloseAccountCardProps {
  userEmail: string;
  onAccountDeleted: () => void;
}

export default function CloseAccountCard({ userEmail, onAccountDeleted }: CloseAccountCardProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [isAgreed, setIsAgreed] = useState(false);

  const handleInitialVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmInput.trim() !== userEmail.trim()) {
      setError(`Verification contact does not match. Please type: ${userEmail}`);
      return;
    }
    setError('');
    setStep(2);
  };

  const executeDeleteAccount = async () => {
    if (!isAgreed) {
      setError("Please check the declaration box to proceed.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('session_id') || '';
      const response = await apiFetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-session-id': token
        }
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to complete cloud account deletion.');
      }

      // Success - Trigger complete frontend reset and redirect
      onAccountDeleted();
    } catch (err: any) {
      setError(err.message || 'Verification or purge process failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="account-closure-zone-card" className="bg-white rounded-[24px] shadow-sm border border-red-100 overflow-hidden text-xs transition-all duration-300">
      
      {/* Red Alert Banner */}
      <div className="p-5 md:p-6 bg-[#C62828] text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
            <ShieldAlert size={20} className="text-red-100 animate-pulse" />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-sm tracking-tight flex items-center gap-1.5">
              Danger Zone: Master Account Deletion
            </h3>
            <p className="text-[10px] text-red-100">Permanently close and wipe all cloud data, backups, and user credentials.</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5 text-gray-700">
        {step === 1 ? (
          <>
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-2xl border border-red-100">
              <AlertTriangle className="w-5 h-5 text-[#C62828] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-extrabold text-[#C62828] text-[11px] uppercase tracking-wider">Irreversible Action Warning</p>
                <p className="text-gray-600 leading-relaxed font-medium">
                  Closing this merchant profile destroys your database reference in our system. Any and all daily automated backups linked to your phone or email will be permanently destroyed. 
                  <strong> You will not be able to recover this history.</strong>
                </p>
              </div>
            </div>

            <form onSubmit={handleInitialVerify} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Verify Account Identity
                </label>
                <p className="text-gray-500 mb-2 font-medium">
                  To verify deletion authorization, type your exact registered login contact: 
                  <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-800 font-bold ml-1">{userEmail}</span>
                </p>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => {
                    setConfirmInput(e.target.value);
                    setError('');
                  }}
                  placeholder={userEmail}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828] h-11 px-4 rounded-xl text-sm font-semibold transition outline-none"
                  disabled={loading}
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-[#C62828] font-bold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C62828]" />
                  {error}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || confirmInput.trim() !== userEmail.trim()}
                  className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 text-white font-bold tracking-tight text-xs transition duration-200 ${
                    confirmInput.trim() === userEmail.trim()
                      ? 'bg-[#C62828] hover:bg-[#B71C1C] hover:shadow-lg hover:shadow-red-500/10 active:scale-[0.98]'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  Permanently Purge Account & Ledger Clouds
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-200 animate-pulse text-amber-900">
              <ShieldAlert className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-black text-amber-800 text-[11px] uppercase tracking-wider">CRITICAL SECURITY STEP</p>
                <p className="font-semibold text-xs leading-relaxed text-amber-950">
                  This action is final. By confirming, your merchant profile will be wiped. This includes deleting all your invoices, customer databases, revenue trends, and encryption security parameters. None of your logs can be restored.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setStep(1);
                setIsAgreed(false);
                setError('');
              }}
              className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-900 font-bold transition-all text-[11px]"
              disabled={loading}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Go Back & Re-evaluate
            </button>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setIsAgreed(!isAgreed)}
                className="flex items-start gap-3 text-left w-full select-none"
                disabled={loading}
              >
                <div className="shrink-0 mt-0.5 text-red-600">
                  {isAgreed ? (
                    <CheckSquare className="w-5 h-5 fill-red-50 text-red-600" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <span className="font-extrabold text-gray-900 text-[11px] uppercase tracking-wide">Final Declaration</span>
                  <p className="text-gray-500 text-[10.5px] leading-relaxed font-semibold">
                    I explicitly authorize Yeedem Books to permanently delete my merchant account data. I understand there is no recovery option.
                  </p>
                </div>
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-[#C62828] font-bold flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C62828]" />
                {error}
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={executeDeleteAccount}
                disabled={loading || !isAgreed}
                className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 text-white font-extrabold tracking-tight text-xs transition duration-200 ${
                  isAgreed
                    ? 'bg-[#C62828] hover:bg-[#B71C1C] hover:shadow-lg hover:shadow-red-500/10 active:scale-[0.98]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Wiping Cloud Databases Now...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Permanently WIPE Cloud Data & Ledger
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
