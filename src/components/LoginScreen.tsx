import React, { useState, useEffect } from 'react';
import { Lock, Smartphone, ShieldCheck, ArrowRightLeft, Sparkles, AlertTriangle, Key } from 'lucide-react';
import LogoImg from '../assets/images/yeedem_books_logo_1779553023368.png';
import { nodeFetch } from '../lib/api';

const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || "+234 802 841 6553";
const SUPPORT_PHONE_CLEAN = SUPPORT_PHONE.replace(/[^\d]/g, '');

export function normalizeContact(phoneOrEmailStr: string): string {
  let input = phoneOrEmailStr.trim();
  if (!input) return '';

  const cleanPhoneCheck = input.replace(/[\s\-\(\)]/g, '');
  const isEmail = input.includes('@') && input.includes('.');
  const isPhone = /^\+?[0-9]{8,15}$/.test(cleanPhoneCheck);

  if (isPhone && !isEmail) {
    if (cleanPhoneCheck.startsWith('0') && cleanPhoneCheck.length === 11) {
      return '+234' + cleanPhoneCheck.slice(1);
    } else if (!cleanPhoneCheck.startsWith('+') && !cleanPhoneCheck.startsWith('0') && cleanPhoneCheck.length === 10) {
      return '+234' + cleanPhoneCheck;
    } else {
      return (cleanPhoneCheck.startsWith('+') ? '+' : '') + cleanPhoneCheck.replace(/\D/g, '');
    }
  }
  return input;
}

interface LoginScreenProps {
  onLogin: (session_id: string, phone_or_email: string, user?: any) => void;
  deviceFingerprint: string;
  approxRegion: string;
  onNavigate?: (screen: 'landing' | 'login' | 'about' | 'terms' | 'guest_invoice' | 'dashboard' | 'debtors' | 'profile' | 'invoice_preview' | 'products' | 'invoices' | 'customers' | 'terminal') => void;
}

export default function LoginScreen({ onLogin, deviceFingerprint, approxRegion, onNavigate }: LoginScreenProps) {
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [step, setStep] = useState<'pin_lock' | 'phone' | 'otp' | 'whatsapp_verify' | 'set_pin' | 'confirm_pin' | 'enter_name' | 'enter_business' | 'forgot_phone' | 'forgot_otp' | 'forgot_new_pin' | 'forgot_confirm_pin' | 'check_email'>('phone');
  
  const [pinAttempt, setPinAttempt] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState<'buy_and_sell' | 'service'>('buy_and_sell');
  
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [simulatedOtpNotice, setSimulatedOtpNotice] = useState('');
  
  // WhatsApp State
  const [verificationCode, setVerificationCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(180);
  const [isResetFlow, setIsResetFlow] = useState(() => localStorage.getItem('should_reset_pin_flow') === 'true');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [debugUrl, setDebugUrl] = useState('');
  const [infoNotice, setInfoNotice] = useState('');
  
  const storedPhone = localStorage.getItem('authorized_phone_or_email') || '';

  useEffect(() => {
    if (storedPhone) {
      const normalized = normalizeContact(storedPhone);
      setPhoneOrEmail(normalized);
      setStep('pin_lock');
    }
  }, [storedPhone]);

  // WhatsApp-specific: Timer & Polling
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'whatsapp_verify' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const headers = {
    'Content-Type': 'application/json',
    'x-device-fingerprint': deviceFingerprint || 'unknown_fp',
    'x-approx-region': approxRegion || 'NG-Lagos'
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'whatsapp_verify') {
      interval = setInterval(async () => {
        const cleanContact = normalizeContact(phoneOrEmail);
        const res = await nodeFetch('/api/auth/check-verification-status', {
            method: 'POST',
            headers,
            body: JSON.stringify({ phone_or_email: cleanContact })
        });
        const data = await res.json();
        
        if (data.status === 'verified') {
           clearInterval(interval);
           if (data.user && data.session_id) {
               onLogin(data.session_id, cleanContact, data.user);
           }
        }
      }, 3000); // Poll every 3s
    }
    return () => clearInterval(interval);
  }, [step, phoneOrEmail]);

  const probeUser = async () => {
    const rawInput = phoneOrEmail.trim();
    if (!rawInput) {
      setError('Please enter your phone number or email first.');
      return;
    }

    // Direct parser to check if input is Email
    const isEmail = rawInput.includes('@');
    let finalInput = rawInput;

    if (!isEmail) {
      const cleanPhone = rawInput.replace(/[\s\-\(\)]/g, '');
      if (/^\+?[0-9]{7,15}$/.test(cleanPhone)) {
        if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
          finalInput = '+234' + cleanPhone.slice(1);
        } else if (!cleanPhone.startsWith('+') && !cleanPhone.startsWith('0') && cleanPhone.length === 10) {
          finalInput = '+234' + cleanPhone;
        } else {
          finalInput = (cleanPhone.startsWith('+') ? '+' : '') + cleanPhone.replace(/\D/g, '');
        }
      } else {
        setError('Please enter a valid email or phone number (e.g. +234..., 080...).');
        return;
      }
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawInput)) {
        setError('Please enter a valid email address (e.g. name@domain.com).');
        return;
      }
    }
    
    setLoading(true);
    setError('');
    
    try {
      const res = await nodeFetch('/api/auth/initiate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone_or_email: finalInput })
      });
      if (!res.ok) {
        let errMsg = 'Could not connect to authentication gateway.';
        try {
          const errorData = await res.json();
          errMsg = errorData.error || errorData.message || errMsg;
        } catch (e) {
          try {
            const txt = await res.text();
            if (txt) errMsg = txt;
          } catch (_) {}
        }
        throw new Error(errMsg);
      }
      const data = await res.json();
      
      localStorage.setItem('hasPin', String(data.hasPin));
      setPhoneOrEmail(finalInput); // Ensure current key is saved correctly
      if (data.debugUrl) {
         setDebugUrl(data.debugUrl);
      } else {
         setDebugUrl('');
      }
      if (data.message) {
         setInfoNotice(data.message);
      } else {
         setInfoNotice('');
      }

      if (data.method === 'pin') {
        setStep('pin_lock');
      } else if (data.method === 'email') {
        setStep('check_email');
      } else {
        // Phone Authentication: WhatsApp Flow
        if (!data.newUser && data.hasPin) {
          setStep('pin_lock');
        } else {
          setStep('whatsapp_verify');
          setVerificationCode(data.verificationCode);
          setTimeLeft(180);
        }
      }
    } catch (e: any) {
      setError(e.message || 'Verification gateway unreachable. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipVerification = async () => {
    setLoading(true);
    setError('');
    const cleanContact = normalizeContact(phoneOrEmail);
    try {
      const res = await nodeFetch('/api/auth/skip-verification', {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone_or_email: cleanContact })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to skip verification.');
      }
      const data = await res.json();
      if (data.session_id) {
        onLogin(data.session_id, cleanContact, data.user);
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred while skipping verification.');
    } finally {
      setLoading(false);
    }
  };

  const triggerPinLogin = async (pin: string) => {
    const cleanContact = normalizeContact(phoneOrEmail);
    setLoading(true);
    try {
      const res = await nodeFetch('/api/auth/pin-login', {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone_or_email: cleanContact, pin })
      });
      const data = await res.json();
      
      if (res.status === 403 || data.is_suspicious_locked) {
        onLogin(data.session_id || 'suspended_session', cleanContact, data.user);
      } else if (res.ok && data.session_id) {
        onLogin(data.session_id, cleanContact, data.user);
      } else {
        setPinAttempt('');
        setError(data.error || 'Incorrect 4-digit Master PIN code.');
      }
    } catch (err) {
      setError('Hardware connection error. Please try again.');
      setPinAttempt('');
    } finally {
      setLoading(false);
    }
  };
    
  const handlePinInput = (value: string) => {
      setError('');
      if (/^\d{0,4}$/.test(value)) {
          setPinAttempt(value);
          if (value.length === 4) {
              triggerPinLogin(value);
          }
      }
  };

  useEffect(() => {
    if (step === 'pin_lock' && pinInputRef.current) {
        pinInputRef.current.focus();
    }
  }, [step]);

  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'OAUTH_AUTH_SUCCESS') {
        const { session_id, phone_or_email } = event.data;
        if (session_id && phone_or_email) {
          onLogin(session_id, phone_or_email);
          if (onNavigate) {
            onNavigate('dashboard');
          }
        }
      }
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [onLogin, onNavigate]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const { auth, googleProvider } = await import('../lib/firebase');
      const { signInWithPopup } = await import('firebase/auth');
      
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      if (user && user.email) {
        const res = await fetch('/api/auth/google/firebase-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-device-fingerprint': deviceFingerprint || 'unknown_fp',
            'x-approx-region': approxRegion || 'NG-Lagos'
          },
          body: JSON.stringify({
            email: user.email,
            displayName: user.displayName || '',
            uid: user.uid
          })
        });
        
        if (!res.ok) {
          throw new Error('Failed to synchronize authenticated Google user session on the server.');
        }
        
        const data = await res.json();
        if (data.session_id && data.phone_or_email) {
          onLogin(data.session_id, data.phone_or_email, data.user);
          if (onNavigate) {
            onNavigate('dashboard');
          }
        } else {
          throw new Error('Response payload from backend lacked valid login characteristics.');
        }
      } else {
        throw new Error('Completed authentication but received no Google email associated with the account.');
      }
    } catch (err: any) {
      console.warn("Firebase Client OAuth failed, trying backend fallback:", err);
      const url = phoneOrEmail && phoneOrEmail.includes('@') 
          ? `/api/auth/google?email=${encodeURIComponent(phoneOrEmail.trim())}` 
          : '/api/auth/google';
      const w = 550;
      const h = 650;
      const left = window.screen.width / 2 - w / 2;
      const top = window.screen.height / 2 - h / 2;
      const popup = window.open(url, 'Google Sign-In', `width=${w},height=${h},top=${top},left=${left},status=no,resizable=yes,scrollbars=yes`);
      if (!popup) {
        setError('Popup blocked! Please allow popups or use another login method.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };
    
  const pinInputRef = React.useRef<HTMLInputElement>(null);

  const clearAuthProfile = () => {
    localStorage.removeItem('authorized_phone_or_email');
    localStorage.removeItem('session_id');
    localStorage.removeItem('should_reset_pin_flow');
    setIsResetFlow(false);
    setPhoneOrEmail('');
    setPinAttempt('');
    setOtp('');
    setNewPin('');
    setConfirmPin('');
    setError('');
    setStep('phone');
  };

  const renderTermsDisclaimer = () => {
    if (!onNavigate) return null;
    return (
      <p className="text-[11px] text-slate-400 mt-4 leading-relaxed text-center">
        By creating an account, you agree to the{" "}
        <button
          type="button"
          onClick={() => onNavigate('terms')}
          className="text-[#00A6FF] hover:underline font-bold focus:outline-none cursor-pointer inline-block"
        >
          terms and conditions
        </button>{" "}
        of this platform by signing up.
      </p>
    );
  };

  // Helper for WhatsApp
  const waLink = `https://wa.me/${SUPPORT_PHONE_CLEAN}?text=Verify%20my%20Yeedem%20account%20code:%20${verificationCode}`;

  return (
    <div className="w-full bg-[#161C48] rounded-[32px] p-8 border border-white/10 shadow-2xl text-center space-y-6 max-w-md mx-auto relative overflow-hidden">
        
        {/* Simplified Header */}
        <div className="flex justify-center">
            <div className="w-16 h-16 bg-white border border-white/20 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden p-1.5 ">
                <img src={LogoImg} alt="Yeedem Books" className="w-full h-full object-contain rounded-xl" referrerPolicy="no-referrer" />
            </div>
        </div>

        {/* Step: Phone Entry */}
        {step === 'phone' && (
            <div className="space-y-5" id="form-login-entry">
                <h2 className="text-white text-xl font-bold font-sans tracking-tight">Sign in to Yeedem books</h2>
                
                 <button 
                    onClick={(e) => {
                        e.preventDefault();
                        handleGoogleSignIn();
                    }}
                    disabled={googleLoading}
                    className="w-full bg-white hover:bg-slate-50 text-slate-800 p-4 rounded-xl font-bold transition duration-250 cursor-pointer shadow-lg inline-flex items-center justify-center gap-2.5 font-sans text-sm border border-slate-200 disabled:opacity-80"
                    id="btn-google-oauth-signin"
                >
                    {googleLoading ? (
                        <div className="w-4 h-4 border-2 border-slate-500 border-t-slate-800 rounded-full animate-spin shrink-0"></div>
                    ) : (
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                        </svg>
                    )}
                    {googleLoading ? 'Signing in...' : 'Continue with Google'}
                </button>

                <div className="relative flex items-center justify-center my-4">
                    <div className="border-t border-white/10 w-full"></div>
                    <span className="absolute px-3 bg-[#111639] bg-[#161C48] text-[10px] text-slate-400 font-sans font-bold uppercase tracking-widest">or</span>
                </div>

                {/* Email or Phone label with input */}
                <div className="text-left space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-sans ml-1">Email or Phone Number</label>
                    <input
                        type="text"
                        value={phoneOrEmail}
                        onChange={(e) => setPhoneOrEmail(e.target.value)}
                        placeholder="e.g. name@domain.com or +234..."
                        className="w-full p-4 rounded-xl bg-white/10 text-white placeholder:text-white/40 border border-white/5 focus:border-[#00A6FF] outline-none font-sans"
                        id="input-login-identity"
                    />
                </div>

                <button 
                    onClick={probeUser}
                    disabled={loading}
                    className="w-full bg-[#00A6FF] hover:bg-[#0095e6] p-4 rounded-xl text-white font-bold transition duration-200 cursor-pointer shadow-lg inline-flex items-center justify-center font-sans text-base"
                    id="btn-login-submit"
                >
                    {loading ? 'Processing...' : 'Continue'}
                </button>

                {error && <p className="text-red-400 text-xs text-center font-medium font-sans">{error}</p>}
                {renderTermsDisclaimer()}
            </div>
        )}

        {/* Step: Check Email Verification Link View */}
        {step === 'check_email' && (
            <div className="space-y-6 text-center py-4" id="view-check-email-magic">
                <div className="flex justify-center text-[#00A6FF]">
                    <ShieldCheck className="w-14 h-14 animate-pulse" />
                </div>
                <h2 className="text-white text-xl font-bold font-sans tracking-tight">Check your email</h2>
                {infoNotice ? (
                    <div className="text-left bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl space-y-2 mt-2">
                        <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                            <span>⚠️ Email Delivery Notice</span>
                        </div>
                        <p className="text-slate-300 text-xs leading-relaxed">
                            {infoNotice}
                        </p>
                    </div>
                ) : (
                    <>
                        <p className="text-slate-300 text-sm leading-relaxed font-sans mt-2">
                            We sent a secure sign-in link to <strong className="text-white font-semibold">{phoneOrEmail}</strong>.
                        </p>
                        <p className="text-slate-400 text-xs font-sans">
                            Click the link in the email to sign in automatically.
                        </p>
                    </>
                )}

                {debugUrl && (
                    <div className="bg-blue-500/10 border border-blue-550/20 p-4 rounded-xl text-left text-xs space-y-2 mt-4 text-slate-300 animate-fadeIn">
                        <p className="text-[#00A6FF] font-bold uppercase tracking-wider text-[10px]">Dev / Sandbox Mode</p>
                        <p className="leading-relaxed text-[11px]">
                            Since the email delivery was bypassed or restricted by the Resend Sandbox, log in instantly using the link below:
                        </p>
                        <a 
                            href={debugUrl} 
                            className="inline-block bg-[#00A6FF] hover:bg-[#0095e6] text-white font-bold py-2 px-4 rounded-lg mt-1 transition text-xs select-none shadow-md shadow-blue-500/20 cursor-pointer"
                        >
                            Open Verification Link
                        </a>
                    </div>
                )}

                <button 
                    onClick={clearAuthProfile}
                    className="text-slate-400 hover:text-white text-xs underline block w-full mt-4 font-sans font-medium"
                    id="btn-switch-check-email"
                >
                    Back to Sign In
                </button>
            </div>
        )}

        {/* Step: PIN Lock */}
        {step === 'pin_lock' && (
            <div className="space-y-4">
                <h2 className="text-white text-xl font-bold">Enter PIN</h2>
                <div className="flex justify-center gap-2 relative">
                    <input 
                        type="number" 
                        ref={pinInputRef} 
                        value={pinAttempt} 
                        onChange={(e) => handlePinInput(e.target.value)} 
                        className="opacity-0 absolute inset-0 w-full h-full cursor-default"
                        onBlur={() => { if(step === 'pin_lock') pinInputRef.current?.focus() }}
                    />
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className={`w-4 h-4 rounded-full ${i < pinAttempt.length ? 'bg-white' : 'bg-white/20'}`}></div>
                    ))}
                </div>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                
                {/* Keypad */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                    {[1,2,3,4,5,6,7,8,9,0].map((num) => (
                        <button key={num} onClick={() => handlePinInput(pinAttempt + num.toString())} className="bg-white/10 text-white p-4 rounded-xl text-xl font-bold">
                            {num}
                        </button>
                    ))}
                    <button onClick={() => setPinAttempt(pinAttempt.slice(0, -1))} className="bg-white/5 text-white p-4 rounded-xl text-sm font-bold">Del</button>
                </div>
                
                <div className="flex flex-col items-center gap-2 pt-2">
                    <button onClick={clearAuthProfile} className="text-white/60 text-xs underline hover:text-white transition">Switch Account</button>
                    {phoneOrEmail.includes('@') ? (
                        <button 
                            type="button"
                            onClick={async () => {
                                setLoading(true);
                                setError('');
                                try {
                                    localStorage.setItem('should_reset_pin_flow', 'true');
                                    setIsResetFlow(true);
                                    const res = await nodeFetch('/api/auth/initiate', {
                                        method: 'POST',
                                        headers,
                                        body: JSON.stringify({ phone_or_email: phoneOrEmail, force_magic_link: true })
                                    });
                                    if (!res.ok) {
                                        const errorData = await res.json();
                                        throw new Error(errorData.error || 'Could not dispatch secure verification link.');
                                    }
                                    const data = await res.json();
                                    if (data.debugUrl) {
                                        setDebugUrl(data.debugUrl);
                                    } else {
                                        setDebugUrl('');
                                    }
                                    if (data.message) {
                                        setInfoNotice(data.message);
                                    } else {
                                        setInfoNotice('');
                                    }
                                    setStep('check_email');
                                } catch (err: any) {
                                    setError(err.message);
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            className="text-[#00A6FF] hover:underline text-xs font-semibold"
                            disabled={loading}
                        >
                            {loading ? 'Sending verification link...' : 'Forgot PIN? Send secure verification link to email'}
                        </button>
                    ) : (
                        <button 
                            type="button"
                            onClick={async () => {
                                setLoading(true);
                                setError('');
                                try {
                                    localStorage.setItem('should_reset_pin_flow', 'true');
                                    setIsResetFlow(true);
                                    const res = await nodeFetch('/api/auth/initiate', {
                                        method: 'POST',
                                        headers,
                                        body: JSON.stringify({ phone_or_email: phoneOrEmail })
                                    });
                                    if (!res.ok) {
                                        const errorData = await res.json();
                                        throw new Error(errorData.error || 'Could not initiate WhatsApp verification.');
                                    }
                                    const data = await res.json();
                                    setStep('whatsapp_verify');
                                    setVerificationCode(data.verificationCode);
                                    setTimeLeft(180);
                                } catch (err: any) {
                                    setError(err.message);
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            className="text-[#00A6FF] hover:underline text-xs font-semibold active:opacity-70"
                            disabled={loading}
                        >
                            {loading ? 'Initiating reset...' : 'Forgot PIN? Verify via WhatsApp to reset'}
                        </button>
                    )}
                </div>
            </div>
        )}

        {/* Example of WhatsApp Verify View */}
        {step === 'whatsapp_verify' && (
            <div className="space-y-4">
                <h2 className="text-white text-xl font-bold font-sans">Verify via WhatsApp</h2>
                <p className="text-[#a0aec0] text-xs leading-relaxed font-sans">
                  We sent a 6-digit verification handshake prompt to your WhatsApp line. Please click the button below to authorize.
                </p>
                <a 
                    href={waLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block bg-emerald-600 hover:bg-emerald-500 font-sans p-4 rounded-xl text-white font-bold transition"
                >
                    Verify via WhatsApp
                </a>

                <p className="text-white text-xs font-mono">Expires in {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}</p>
                <p className="text-slate-300 text-[10px] text-center font-sans mt-2 bg-white/5 p-2 rounded-lg border border-white/5 leading-normal">
                   Manual message hook: <br />
                   <span className="font-mono text-[#00A6FF] text-xs font-bold leading-none select-all font-semibold">Verify my Yeedem account code: {verificationCode}</span> to <span className="font-semibold text-white">{SUPPORT_PHONE}</span>
                </p>
                {error && <p className="text-red-400 text-xs font-semibold text-center">{error}</p>}

                <button onClick={clearAuthProfile} className="text-white/60 hover:text-white transition text-xs underline mt-2 block w-full font-medium">Switch Account</button>
            </div>
        )}
    </div>
  );
}
