import React, { useState } from 'react';
import { ShieldAlert, KeyRound, Check, Loader2, ArrowLeft } from 'lucide-react';

interface ResetPinScreenProps {
  onComplete: (newPin: string) => void;
  onCancel: () => void;
  phoneOrEmail: string;
}

export default function ResetPinScreen({ onComplete, onCancel, phoneOrEmail }: ResetPinScreenProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.length !== 4 || isNaN(Number(pin))) {
      setError('Please enter a 4-digit master PIN.');
      return;
    }
    if (pin !== confirmPin) {
      setError('The security PINs do not match. Please key them in again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const sid = localStorage.getItem('session_id') || '';
      const response = await fetch('/api/auth/reset-pin-authenticated', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sid}`,
          'x-session-id': sid
        },
        body: JSON.stringify({ pin })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update security PIN.');
      }

      setSuccess(true);
      setTimeout(() => {
        onComplete(pin);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Verification gateway unreachable. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-[#161C48] rounded-[32px] p-8 border border-white/10 shadow-2xl space-y-6 max-w-md mx-auto relative overflow-hidden" id="reset-pin-viewport">
      
      {/* Header Banner */}
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="w-14 h-14 bg-[#00A6FF]/10 border border-[#00A6FF]/20 text-[#00A6FF] rounded-full flex items-center justify-center">
          <KeyRound className="w-6 h-6 animate-pulse" />
        </div>
        <h2 className="text-white text-xl font-bold font-sans tracking-tight">Reset Security PIN</h2>
        <p className="text-slate-300 text-xs leading-relaxed font-sans max-w-xs">
          Set a new 4-digit security master PIN to protect your SME financial ledgers under account <span className="text-white font-semibold">{phoneOrEmail}</span>.
        </p>
      </div>

      {success ? (
        <div className="flex flex-col items-center justify-center py-6 space-y-3 text-center animate-fadeIn">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
            <Check className="w-6 h-6" />
          </div>
          <p className="text-emerald-400 font-bold text-sm">Security PIN updated!</p>
          <p className="text-slate-400 text-xs">Redirecting you to dashboard...</p>
        </div>
      ) : (
        <form onSubmit={handleResetPin} className="space-y-4">
          <div className="space-y-3 text-left">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans ml-1">New 4-Digit Security PIN</label>
              <input
                type="password"
                maxLength={4}
                pattern="\d{4}"
                placeholder="••••"
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val.length <= 4) setPin(val);
                }}
                className="w-full p-4 rounded-xl bg-white/10 text-white text-center text-xl tracking-[1.5em] placeholder:text-white/20 border border-white/5 focus:border-[#00A6FF] outline-none font-sans"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans ml-1">Confirm Security PIN</label>
              <input
                type="password"
                maxLength={4}
                pattern="\d{4}"
                placeholder="••••"
                value={confirmPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val.length <= 4) setConfirmPin(val);
                }}
                className="w-full p-4 rounded-xl bg-white/10 text-white text-center text-xl tracking-[1.5em] placeholder:text-white/20 border border-white/5 focus:border-[#00A6FF] outline-none font-sans"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs text-center font-medium font-sans flex items-center justify-center gap-1.5 bg-red-400/10 p-3 rounded-lg border border-red-500/15">
              <ShieldAlert className="w-3.5 h-3.5" />
              {error}
            </p>
          )}

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={loading || pin.length !== 4 || confirmPin.length !== 4}
              className="w-full bg-[#00A6FF] hover:bg-[#0095e6] disabled:opacity-50 disabled:hover:bg-[#00A6FF] p-4 rounded-xl text-white font-bold transition duration-200 cursor-pointer shadow-lg flex items-center justify-center gap-2 font-sans text-base"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? 'Securing account...' : 'Save New Security PIN'}
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white text-xs py-2 font-sans font-medium hover:underline transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Cancel &amp; Go Back
            </button>
          </div>
        </form>
      )}

    </div>
  );
}
