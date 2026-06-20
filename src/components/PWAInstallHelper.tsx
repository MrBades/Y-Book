import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Share, PlusSquare, Check, X, Shield, RefreshCw } from 'lucide-react';

interface PWAInstallHelperProps {
  deferredPrompt: any;
  isAppInstalled: boolean;
  onInstall: () => void;
}

export default function PWAInstallHelper({
  deferredPrompt,
  isAppInstalled,
  onInstall
}: PWAInstallHelperProps) {
  const [isIOS, setIsIOS] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    // Detect if running on an iOS device
    const userAgent = window.navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(ios);
  }, []);

  if (!showBanner) return null;

  return (
    <div id="pwa-install-container" className="bg-gradient-to-br from-[#0E1338] to-[#1E255A] text-white rounded-[24px] shadow-lg border border-white/10 overflow-hidden transition-all duration-300">
      <div className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 bg-[#00A6FF]/20 text-[#00A6FF] px-3 py-1 rounded-full text-xs font-bold leading-none">
              <Smartphone className="w-3.5 h-3.5 animate-pulse" />
              <span>Progressive Web App (PWA)</span>
            </div>
            
            <h2 className="text-xl md:text-2xl font-display font-extrabold tracking-tight">
              Install Yeedem Books on Mobile
            </h2>
            <p className="text-sm text-gray-300 leading-relaxed">
              Access your digital ledgers instantly from your home screen. Our PWA operates with full offline protections, fast load times, and minimal storage footprint.
            </p>
          </div>

          <div className="flex flex-shrink-0 flex-col sm:flex-row gap-3">
            {isAppInstalled ? (
              <div className="flex items-center gap-2.5 bg-green-500/10 border border-green-500/30 text-green-400 px-5 py-3 rounded-2xl font-bold text-sm">
                <Check className="w-4 h-4" />
                Already Installed & Active
              </div>
            ) : isIOS ? (
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl max-w-sm space-y-2.5 text-xs text-gray-300">
                <p className="font-bold text-white flex items-center gap-1.5 mb-1 text-sm">
                  <Share className="w-4 h-4 text-[#00A6FF]" /> iOS Safari Setup Strategy
                </p>
                <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
                  <li>Tap the <strong className="text-[#00A6FF]">Share</strong> menu button at the bottom of Safari.</li>
                  <li>Scroll down and select <strong className="text-white">"Add to Home Screen"</strong> (<PlusSquare className="inline-block w-3.5 h-3.5" />).</li>
                  <li>Tap <strong className="text-[#00A6FF]">Add</strong> in the top-right corner to install Yeedem Books!</li>
                </ol>
              </div>
            ) : deferredPrompt ? (
              <button
                id="pwa-trigger-install-btn"
                onClick={onInstall}
                className="bg-[#00A6FF] hover:bg-[#0091E0] text-white active:scale-95 transition-all text-sm font-bold h-12 px-6 rounded-2xl flex items-center justify-center gap-2.5 shadow-md shadow-[#00A6FF]/20"
              >
                <Download className="w-4 h-4" />
                Install Yeedem Books
              </button>
            ) : (
              <div className="bg-white/5 border border-white/15 p-4 rounded-2xl max-w-sm text-xs text-gray-300 space-y-2 flex flex-col justify-center">
                <p className="font-bold text-white flex items-center gap-1.5 text-xs leading-none">
                  <Shield className="w-3.5 h-3.5 text-amber-500" /> Platform Installation Alert
                </p>
                <p className="leading-relaxed">
                  If you do not see the install prompt, simple tap your browser's menu (three dots icon <span className="font-mono">⋮</span> or Safari Share) and click <strong>"Install App"</strong> or <strong>"Add to Home Screen"</strong> directly!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Feature Highlights Footer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10 text-xs text-gray-400">
          <div className="flex items-start gap-2.5">
            <div className="p-1 rounded bg-[#00A6FF]/10 text-[#00A6FF] mt-0.5">
              <Check className="w-3 h-3" />
            </div>
            <div>
              <p className="font-bold text-gray-200">Instant Access</p>
              <p className="text-[11px] leading-relaxed">No store downloads or space required.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="p-1 rounded bg-[#00A6FF]/10 text-[#00A6FF] mt-0.5">
              <Check className="w-3 h-3" />
            </div>
            <div>
              <p className="font-bold text-gray-200">Offline Ledger Defense</p>
              <p className="text-[11px] leading-relaxed">Cache records locally and synchronize safely.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="p-1 rounded bg-[#00A6FF]/10 text-[#00A6FF] mt-0.5">
              <Check className="w-3 h-3" />
            </div>
            <div>
              <p className="font-bold text-gray-200">Compact Footprint</p>
              <p className="text-[11px] leading-relaxed">Lightweight assets updates smoothly at runtime.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
