import React, { useEffect, useState } from 'react';
import { Heart, Sparkles, ShieldCheck } from 'lucide-react';

export default function SplashScreen({ onComplete }) {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFade(true);
      setTimeout(onComplete, 400); // Wait for fade out
    }, 2200);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      onClick={() => {
        setFade(true);
        setTimeout(onComplete, 300);
      }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-8 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 text-white cursor-pointer transition-opacity duration-500 ${
        fade ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="w-full flex justify-end pt-4">
        <span className="text-xs uppercase tracking-widest text-emerald-400/70 font-mono bg-emerald-950/80 border border-emerald-800/40 px-3 py-1 rounded-full">
          v1.0.0 • Digital Ledger
        </span>
      </div>

      <div className="flex flex-col items-center text-center space-y-6 my-auto">
        {/* Custom Official Rana ALI Garments Logo */}
        <div className="relative">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-white p-1.5 shadow-2xl shadow-emerald-500/30 border-2 border-emerald-500/40 hover:scale-105 transition-transform">
            <img
              src="/logo.png"
              alt="Rana ALI Garments Logo"
              className="w-full h-full object-contain rounded-2xl"
            />
          </div>
        </div>

        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-200 bg-clip-text text-transparent">
            ALI GARMENTS
          </h1>
          <p className="text-emerald-400 text-sm sm:text-base font-medium mt-1 tracking-wide">
            Smart Khata & Digital Ledger System
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-300 font-medium bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Offline-First • Real-Time Cloud Khata</span>
        </div>
      </div>

      {/* Required Credit Footer */}
      <div className="text-center space-y-2 pb-4">
        <div className="flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium text-slate-300">
          <span>Made With</span>
          <Heart className="w-4 h-4 text-rose-500 fill-rose-500 inline-block animate-bounce" />
          <span>By</span>
          <span className="font-semibold text-white tracking-wide">
            Chengdu Shuze International
          </span>
        </div>
        <p className="text-[11px] text-slate-500">Tap anywhere to launch</p>
      </div>
    </div>
  );
}
