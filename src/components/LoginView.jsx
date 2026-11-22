import React, { useState, useEffect } from 'react';
import { Lock, Mail, Shield, AlertCircle, ArrowRight, Eye, EyeOff, CheckCircle2, Clock } from 'lucide-react';
import { getCachedAuthUser, setCachedAuthUser } from '../services/storage';
import { apiFetch, setStoredToken } from '../services/apiClient';
import {
  checkAccountPasswordRateLimit,
  recordAccountPasswordFailure,
  resetAccountPasswordRateLimit,
  formatSecondsToTimer
} from '../services/rateLimiter';

export default function LoginView({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loginSuccessUser, setLoginSuccessUser] = useState(null);

  // Rate Limiting & Auto-Suspension Live Cache States
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);
  const [isAutoSuspended, setIsAutoSuspended] = useState(false);

  // Live countdown timer check (ticking every 1s from cache)
  useEffect(() => {
    const updateRateLimitCache = () => {
      const cleanEmail = email.trim().toLowerCase();
      const lastEmail = typeof window !== 'undefined' ? (window.localStorage?.getItem('ag_rl_last_email') || '') : '';
      const targetIdentifier = cleanEmail || lastEmail || 'account_password';

      const status = checkAccountPasswordRateLimit(targetIdentifier);

      if (status.secondsLeft > 0) {
        setLockoutSecondsLeft(status.secondsLeft);
      } else {
        setLockoutSecondsLeft(0);
      }

      setIsAutoSuspended(!!status.isSuspended);
    };

    updateRateLimitCache();
    const timer = setInterval(updateRateLimitCache, 1000);
    return () => clearInterval(timer);
  }, [email]);

  const triggerSuccessAnimation = (user) => {
    setLoginSuccessUser(user);
    setTimeout(() => {
      if (onLoginSuccess) {
        onLoginSuccess(user);
      }
    }, 750);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both your email and password');
      return;
    }

    // 1. Client-Side Cache Lockout: 3 wrong passwords -> 15-minute lock
    // Prevents sending any request to the server (Worker or D1)
    const rlStatus = checkAccountPasswordRateLimit(cleanEmail);
    if (rlStatus.isLocked && rlStatus.secondsLeft > 0) {
      setLockoutSecondsLeft(rlStatus.secondsLeft);
      setErrorMessage(`Too many failed password attempts (3 maximum) For your security login is locked for ${formatSecondsToTimer(rlStatus.secondsLeft)}`);
      return; // STOP! No network request sent to server
    }

    // 2. Note: If 6 failed attempts done and user suspended, rlStatus.isLocked is false
    // The login screen allows sending the request to the server so user can attempt login / authorized access
    setIsLoading(true);

    try {
      let response = null;
      try {
        response = await apiFetch('/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: cleanEmail,
            password,
          }),
        });
      } catch (fetchErr) {
        console.warn('Network login failed, checking offline session cache:', fetchErr);
      }

      if (response) {
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success && data.user) {
          resetAccountPasswordRateLimit(cleanEmail);
          resetAccountPasswordRateLimit('login_' + cleanEmail);
          if (data.token) {
            setStoredToken(data.token);
          }
          await setCachedAuthUser(data.user);
          triggerSuccessAnimation(data.user);
          return;
        } else {
          // If 403 Auto-Suspended or Administrator Suspended
          if (data.isSuspended || response.status === 403) {
            const rl = recordAccountPasswordFailure(cleanEmail, cleanEmail);
            setIsAutoSuspended(true);
            if (rl.secondsLeft > 0) {
              setLockoutSecondsLeft(rl.secondsLeft);
            }
            const rawMsg = data.error || 'Your account has been automatically suspended due to unusual failed password attempts Please contact administrator';
            setErrorMessage(rawMsg.replace(/\./g, ''));
            setIsLoading(false);
            return;
          }

          // If 429 Rate limited (3 attempts / 15 minutes)
          if (response.status === 429 || data.isRateLimited) {
            const rl = recordAccountPasswordFailure(cleanEmail, cleanEmail);
            const seconds = rl.secondsLeft || 900;
            setLockoutSecondsLeft(seconds);
            const rawMsg = `Too many failed password attempts (3 maximum) For your security login is locked for ${formatSecondsToTimer(seconds)}`;
            setErrorMessage(rawMsg.replace(/\./g, ''));
            setIsLoading(false);
            return;
          }

          // Failed credentials (401 or other) - record client failure toward 3-lock / 6-suspend
          const rl = recordAccountPasswordFailure(cleanEmail, cleanEmail);
          if (rl.secondsLeft > 0) {
            setLockoutSecondsLeft(rl.secondsLeft);
          } else {
            setLockoutSecondsLeft(0);
          }
          if (rl.isSuspended) {
            setIsAutoSuspended(true);
          }
          const rawMsg = rl.isSuspended
            ? rl.errorMessage
            : rl.isLocked
            ? `Too many failed password attempts (3 maximum) For your security login is locked for ${formatSecondsToTimer(rl.secondsLeft)}`
            : (data.error || rl.errorMessage || 'Email or Password Are incorrect');
          setErrorMessage(rawMsg.replace(/\./g, ''));
          setIsLoading(false);
          return;
        }
      }

      // Offline fallback: Check if this user had a previously verified active session on this device
      const cached = await getCachedAuthUser();
      if (cached && cached.email?.toLowerCase() === cleanEmail) {
        if (cached.status === 'suspended' && cached.role !== 'super_admin') {
          setErrorMessage('Your account has been temporarily suspended by an administrator');
          setIsLoading(false);
          return;
        }
        triggerSuccessAnimation(cached);
        return;
      }

      // If server could not be reached and no offline cached session exists
      setErrorMessage('Cannot reach the authentication server Please check your internet connection');
    } catch (err) {
      console.error('Login request failed:', err);
      setErrorMessage('Something went wrong Please check your connection and try again');
    } finally {
      setIsLoading(false);
    }
  };

  if (loginSuccessUser) {
    return (
      <div className="h-screen max-h-screen overflow-hidden w-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-slate-100 p-4 select-none animate-in fade-in duration-300">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-sm w-full bg-slate-900/90 border border-slate-800/80 rounded-3xl p-8 text-center shadow-2xl space-y-5 animate-in zoom-in-95 duration-300 relative z-10 backdrop-blur-md">
          <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping opacity-75" />
            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-2xl shadow-emerald-950/80 scale-105">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5] animate-bounce" />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Welcome Back! • خوش آمدید
            </h2>
            <p className="text-xs font-semibold text-emerald-400 mt-1">
              Login Successful • لاگ اِن کامیاب
            </p>
            <p className="text-xs font-mono text-slate-400 mt-2 truncate">
              {loginSuccessUser.name || loginSuccessUser.email}
            </p>
          </div>

          <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
            <div className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full animate-[pulse_0.6s_infinite] w-full" />
          </div>

          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Loading Ledgers & Cloudflare D1...</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen max-h-screen overflow-hidden w-full flex flex-col justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-slate-100 p-3 sm:p-6 select-none pt-safe pb-safe">
      {/* Top Bar with System Badge */}
      <div className="w-full flex justify-between items-center max-w-sm sm:max-w-md mx-auto pt-8 sm:pt-4 px-2 shrink-0">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="Rana ALI Garments"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg shadow-md shadow-emerald-500/20 object-contain bg-white p-0.5 border border-slate-700"
          />
          <span className="font-extrabold tracking-tight text-white text-sm sm:text-base whitespace-nowrap">
            ALI GARMENTS
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-800/40 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full whitespace-nowrap">
          <Shield className="w-3 h-3 text-emerald-400 shrink-0" />
          <span>Closed Portal</span>
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm sm:max-w-md mx-auto my-auto py-1">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl shadow-black/60">
          {/* Header with Custom Rana ALI Garments Logo */}
          <div className="text-center mb-3 sm:mb-4">
            <div className="flex justify-center mb-2">
              <img
                src="/logo.png"
                alt="Rana ALI Garments Logo"
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl shadow-xl shadow-emerald-500/30 border-2 border-emerald-500/40 object-contain bg-white p-1 hover:scale-105 transition-transform"
              />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Sign In to Your Khata
            </h2>
            <p className="text-slate-400 text-[11px] sm:text-xs mt-0.5">
              Authorized personnel only Closed multi-user portal
            </p>
          </div>

          {/* Live 15-Minute Lockout Countdown Banner */}
          {lockoutSecondsLeft > 0 && (
            <div className="mb-3 p-3 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs flex items-center justify-center gap-2.5 shadow-lg animate-pulse font-semibold">
              <Clock className="w-4 h-4 text-rose-400 shrink-0" />
              <div className="flex flex-col items-center">
                <span className="text-[11px] text-rose-300">Too many failed attempts (3 maximum)</span>
                <span className="text-sm font-mono font-bold text-rose-100">
                  Locked: Try again in {formatSecondsToTimer(lockoutSecondsLeft)}
                </span>
              </div>
            </div>
          )}

          {/* 6-Attempt Suspension Notice Banner (login screen shown correctly so user can send request) */}
          {isAutoSuspended && (
            <div className="mb-3 p-3 rounded-xl bg-amber-950/70 border border-amber-700/70 text-amber-200 text-xs flex items-start gap-2.5 shadow-lg animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="flex-1 font-medium leading-tight">
                Your account has been automatically suspended due to unusual failed password attempts Please contact administrator
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && !isAutoSuspended && lockoutSecondsLeft === 0 && (
            <div className="mb-3 p-2.5 rounded-xl bg-rose-950/70 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 font-medium leading-tight whitespace-pre-line">
                {(errorMessage || '').replace(/\./g, '')}
                {errorMessage.includes('VPN') && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage('');
                    }}
                    className="block mt-1.5 text-[11px] text-cyan-300 underline hover:text-cyan-200 font-semibold cursor-pointer"
                  >
                    I turned off VPN (Retry Connection • دوبارہ کوشش کریں)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Email Field */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  disabled={isLoading || lockoutSecondsLeft > 0}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className={`w-full pl-9 pr-3.5 py-2 sm:py-2.5 bg-slate-950/70 border rounded-xl text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                    lockoutSecondsLeft > 0 ? 'border-rose-800/60 opacity-60 cursor-not-allowed' : 'border-slate-700/80'
                  }`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  disabled={isLoading || lockoutSecondsLeft > 0}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={`w-full pl-9 pr-10 py-2 sm:py-2.5 bg-slate-950/70 border rounded-xl text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                    lockoutSecondsLeft > 0 ? 'border-rose-800/60 opacity-60 cursor-not-allowed' : 'border-slate-700/80'
                  }`}
                />
                <button
                  type="button"
                  disabled={lockoutSecondsLeft > 0}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || lockoutSecondsLeft > 0}
              className={`w-full mt-2 py-2.5 sm:py-3 px-4 bg-gradient-to-r text-white font-semibold rounded-xl text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                lockoutSecondsLeft > 0
                  ? 'from-rose-800 to-rose-900 border border-rose-700/60 shadow-rose-950/50 opacity-80 cursor-not-allowed'
                  : 'from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 active:scale-[0.99] disabled:opacity-50 shadow-emerald-700/30'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span className="whitespace-nowrap">Verifying Credentials</span>
                </>
              ) : lockoutSecondsLeft > 0 ? (
                <>
                  <Clock className="w-4 h-4 animate-spin shrink-0" />
                  <span className="whitespace-nowrap">Locked ({formatSecondsToTimer(lockoutSecondsLeft)})</span>
                </>
              ) : (
                <>
                  <span className="whitespace-nowrap">Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Closed Registration Notice */}
          <div className="mt-3.5 pt-3 border-t border-slate-800 text-center">
            <p className="text-[11px] text-slate-400 leading-tight">
              Administrative portal Public registration permanently disabled for system security
            </p>
          </div>
        </div>
      </div>

      {/* Footer & Watermark */}
      <div className="w-full text-center text-slate-400 text-[11px] sm:text-xs py-2 shrink-0 space-y-1">
        <p className="flex items-center justify-center gap-1.5 font-medium text-slate-300">
          <span>Made with</span>
          <span className="text-rose-500 animate-pulse text-sm">❤️</span>
          <span className="font-semibold text-slate-200">By Chengdu Shuze International</span>
        </p>
        <p className="text-[10px] text-slate-500">ALI Garments Khata • 5-Day Auto Security Verification</p>
      </div>
    </div>
  );
}
