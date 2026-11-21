import React from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';

export default function LoadingScreen({ message = 'Connecting to Secure Edge Session...' }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 sm:p-8 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white select-none">
      {/* Top Status Pill */}
      <div className="w-full flex justify-end pt-2 sm:pt-4">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-3 py-1 rounded-full shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Enterprise Secure Portal</span>
        </div>
      </div>

      {/* Center Branding & Loading Animation */}
      <div className="flex flex-col items-center text-center space-y-6 my-auto max-w-sm px-4">
        {/* Animated Brand Emblem */}
        <div className="relative">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white p-1 shadow-2xl shadow-emerald-500/30 border-2 border-emerald-500/40 animate-pulse flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Rana ALI Garments Logo"
              className="w-full h-full object-contain rounded-2xl"
            />
          </div>
        </div>

        {/* Brand Name */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-200 bg-clip-text text-transparent">
            ALI GARMENTS
          </h1>
          <p className="text-emerald-400 text-xs sm:text-sm font-medium mt-1 tracking-wide">
            Enterprise Khata & Secure Multi-User Ledger
          </p>
        </div>

        {/* Custom Progress Bar */}
        <div className="w-full max-w-xs space-y-2">
          <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden border border-slate-700/50">
            <div className="bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 h-full rounded-full animate-indeterminate"></div>
          </div>
          <p className="text-[12px] text-slate-400 font-mono tracking-tight animate-pulse">
            {message}
          </p>
        </div>

        {/* Security Badge */}
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono bg-slate-900/90 px-3.5 py-1.5 rounded-xl border border-slate-800/80">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">Web Crypto PBKDF2 & HMAC Protected</span>
        </div>
      </div>

      {/* Footer Note */}
      <div className="text-center pb-2 text-[11px] text-slate-500">
        Chengdu Shuze International • Ali Garments System
      </div>
    </div>
  );
}
