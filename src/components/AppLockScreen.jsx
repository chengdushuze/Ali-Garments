import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Unlock, Delete, KeyRound, AlertCircle, Eye, EyeOff, X, Clock } from 'lucide-react';
import { apiFetch } from '../services/apiClient';
import {
  getRateLimitStatus,
  recordRateLimitFailure,
  resetRateLimit,
  checkAccountPasswordRateLimit,
  recordAccountPasswordFailure,
  resetAccountPasswordRateLimit,
  formatSecondsToTimer
} from '../services/rateLimiter';

const PIN_RATE_LIMIT_KEY = 'app_lock_pin';

export default function AppLockScreen({
  isLocked,
  onUnlock,
  configuredPin,
  currentUser,
}) {
  const [enteredPin, setEnteredPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isUnlockSuccess, setIsUnlockSuccess] = useState(false);
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [fallbackError, setFallbackError] = useState('');

  // Rate Limiting & Lockout Countdown states
  const [pinLockoutSeconds, setPinLockoutSeconds] = useState(0);
  const [pwLockoutSeconds, setPwLockoutSeconds] = useState(0);
  const [isPwSuspended, setIsPwSuspended] = useState(false);

  // Check rate limiting on mount & every second
  const pwKey = currentUser?.email || 'app_lock_password';

  useEffect(() => {
    const updateRateLimits = () => {
      const pinStatus = getRateLimitStatus(PIN_RATE_LIMIT_KEY, 5);
      setPinLockoutSeconds(pinStatus.secondsLeft);

      const pwStatus = checkAccountPasswordRateLimit(pwKey);
      setPwLockoutSeconds(pwStatus.secondsLeft);
      setIsPwSuspended(pwStatus.isSuspended);
      if (pwStatus.isSuspended) {
        setFallbackError(pwStatus.errorMessage);
      }
    };

    updateRateLimits();
    const timer = setInterval(updateRateLimits, 1000);
    return () => clearInterval(timer);
  }, [isLocked, showPasswordFallback, pwKey]);

  // Reset state when locked status changes
  useEffect(() => {
    if (isLocked) {
      setEnteredPin('');
      setErrorMessage('');
      setShowPasswordFallback(false);
      setAccountPassword('');
      setFallbackError('');
    }
  }, [isLocked]);

  // Support physical keyboard typing
  useEffect(() => {
    if (!isLocked || showPasswordFallback || pinLockoutSeconds > 0) return;

    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, enteredPin, showPasswordFallback, pinLockoutSeconds]);

  if (!isLocked) return null;

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(15);
      } catch (e) {}
    }
  };

  const triggerError = (msg) => {
    // Enforce zero dots in authentication messages
    const cleanMsg = (msg || '').replace(/\./g, '');
    setErrorMessage(cleanMsg);
    setIsShaking(true);
    setEnteredPin('');
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([40, 60, 40]);
      } catch (e) {}
    }
    setTimeout(() => {
      setIsShaking(false);
    }, 600);
  };

  const handleDigit = (digit) => {
    if (pinLockoutSeconds > 0) return;
    triggerHaptic();

    if (enteredPin.length >= 4) return;
    const nextPin = enteredPin + digit;
    setEnteredPin(nextPin);
    setErrorMessage('');

    if (nextPin.length === 4) {
      if (nextPin === configuredPin) {
        setIsUnlockSuccess(true);
        resetRateLimit(PIN_RATE_LIMIT_KEY);
        resetRateLimit(FORGOT_PW_RATE_LIMIT_KEY);
        setTimeout(() => {
          onUnlock();
          setIsUnlockSuccess(false);
        }, 650);
      } else {
        const res = recordRateLimitFailure(PIN_RATE_LIMIT_KEY, 5, 30);
        setPinLockoutSeconds(res.secondsLeft);
        triggerError(res.errorMessage);
      }
    }
  };

  const handleBackspace = () => {
    if (pinLockoutSeconds > 0) return;
    triggerHaptic();
    setEnteredPin(prev => prev.slice(0, -1));
    setErrorMessage('');
  };

  const handleClear = () => {
    if (pinLockoutSeconds > 0) return;
    triggerHaptic();
    setEnteredPin('');
    setErrorMessage('');
  };

  // Fallback unlock via account password with 3-attempt/15-min rate limit & 6-try auto-suspension
  const handlePasswordUnlock = async (e) => {
    e.preventDefault();
    if (isPwSuspended) return;
    if (pwLockoutSeconds > 0) return;

    if (!accountPassword) {
      setFallbackError('Please enter your account password');
      return;
    }

    setIsVerifyingPassword(true);
    setFallbackError('');

    try {
      const res = await apiFetch('/api/admin/verify-admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: accountPassword,
          action: 'app_lock_unlock',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setIsUnlockSuccess(true);
        resetRateLimit(PIN_RATE_LIMIT_KEY);
        resetAccountPasswordRateLimit(pwKey);
        setTimeout(() => {
          onUnlock();
          setIsUnlockSuccess(false);
        }, 650);
      } else {
        const rl = recordAccountPasswordFailure(pwKey, currentUser?.email);
        setPwLockoutSeconds(rl.secondsLeft);
        setIsPwSuspended(rl.isSuspended);
        const errText = rl.isSuspended
          ? rl.errorMessage
          : rl.isLocked
          ? rl.errorMessage
          : (data.error ? String(data.error).replace(/\./g, '') : rl.errorMessage);
        setFallbackError(errText);
      }
    } catch (err) {
      setFallbackError('Verification failed Please check network connection');
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const isLockedOut = pinLockoutSeconds > 0;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 select-none animate-in fade-in duration-300">
      {/* Background ambient glowing shapes */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Lock Container */}
      <div className="w-full max-w-sm flex flex-col items-center relative z-10">
        {isUnlockSuccess ? (
          <div className="flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-300 space-y-4">
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping opacity-80" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-2xl shadow-emerald-950/80 scale-105 transition-all">
                <Unlock className="w-10 h-10 stroke-[2.5] animate-bounce" />
              </div>
            </div>

            <div>
              <h2 className="text-xl font-black text-white tracking-tight">
                PIN Verified • پن درست ہے
              </h2>
              <p className="text-xs font-semibold text-emerald-400 mt-1">
                Access Granted • خوش آمدید
              </p>
            </div>

            <div className="w-48 bg-slate-800/80 h-2 rounded-full overflow-hidden p-0.5 border border-slate-700/60 mt-3">
              <div className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full animate-[pulse_0.6s_infinite] w-full" />
            </div>
          </div>
        ) : (
          <>
            {/* Brand Logo & Lock Status */}
            <div className="relative mb-3">
          <img
            src="/logo.png"
            alt="ALI Garments"
            className="w-16 h-16 rounded-2xl object-contain border border-emerald-500/30 bg-white p-1 shadow-xl shadow-emerald-950/40"
          />
          <div className="absolute -bottom-1 -right-1 p-1.5 bg-emerald-600 rounded-full text-white shadow-md">
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>

        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-1.5">
          <span>ALI GARMENTS KHATA</span>
        </h2>
        <p className="text-xs text-emerald-400 font-semibold tracking-wider uppercase mt-0.5">
          App Locked • سیکیورٹی لاک
        </p>

        {!showPasswordFallback ? (
          <>
            <p className="text-xs text-slate-400 text-center mt-2 mb-6">
              Enter your 4-digit security PIN to access ledgers
            </p>

            {/* 4-Dot PIN Indicator with Shake on error */}
            <div className={`flex items-center justify-center gap-4 mb-4 transition-transform duration-200 ${isShaking ? 'translate-x-[-10px] animate-bounce' : ''}`}>
              {[0, 1, 2, 3].map((idx) => {
                const isFilled = enteredPin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                      isFilled
                        ? 'bg-emerald-400 border-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.8)] scale-110'
                        : isLockedOut
                        ? 'bg-rose-950/50 border-rose-800'
                        : 'bg-slate-900 border-slate-700'
                    }`}
                  />
                );
              })}
            </div>

            {/* Error & Lockout Countdown Message */}
            <div className="h-7 mb-2 flex items-center justify-center text-center px-2">
              {isLockedOut ? (
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5 animate-pulse bg-rose-950/50 border border-rose-800/60 px-3 py-1 rounded-full">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Too many attempts Try again in {formatSecondsToTimer(pinLockoutSeconds)}</span>
                </span>
              ) : errorMessage ? (
                <span className="text-xs font-semibold text-rose-400 flex items-center gap-1 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errorMessage}
                </span>
              ) : null}
            </div>

            {/* Ultra-Smooth Numeric Keypad (Optimized for Android APK & Mobile Touch) */}
            <div className="grid grid-cols-3 gap-3 w-64 mt-1 mb-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={isLockedOut}
                  style={{ touchAction: 'manipulation' }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleDigit(String(num));
                  }}
                  className={`h-14 rounded-2xl text-xl font-bold border transition-all shadow-sm flex items-center justify-center select-none ${
                    isLockedOut
                      ? 'bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                      : 'bg-slate-900/90 hover:bg-slate-800 active:bg-emerald-600/40 active:scale-90 active:border-emerald-500/60 text-white border-slate-800 cursor-pointer'
                  }`}
                >
                  {num}
                </button>
              ))}

              {/* Clear button */}
              <button
                type="button"
                disabled={isLockedOut}
                style={{ touchAction: 'manipulation' }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleClear();
                }}
                className={`h-14 rounded-2xl text-xs font-bold transition-all flex items-center justify-center select-none ${
                  isLockedOut
                    ? 'bg-slate-900/20 text-slate-600 cursor-not-allowed opacity-50'
                    : 'bg-slate-900/40 hover:bg-slate-800 text-slate-400 active:scale-90 active:bg-slate-800 cursor-pointer'
                }`}
              >
                Clear
              </button>

              {/* Zero */}
              <button
                type="button"
                disabled={isLockedOut}
                style={{ touchAction: 'manipulation' }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleDigit('0');
                }}
                className={`h-14 rounded-2xl text-xl font-bold border transition-all shadow-sm flex items-center justify-center select-none ${
                  isLockedOut
                    ? 'bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                    : 'bg-slate-900/90 hover:bg-slate-800 active:bg-emerald-600/40 active:scale-90 active:border-emerald-500/60 text-white border-slate-800 cursor-pointer'
                }`}
              >
                0
              </button>

              {/* Backspace */}
              <button
                type="button"
                disabled={isLockedOut}
                style={{ touchAction: 'manipulation' }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleBackspace();
                }}
                className={`h-14 rounded-2xl transition-all flex items-center justify-center select-none ${
                  isLockedOut
                    ? 'bg-slate-900/20 text-slate-600 cursor-not-allowed opacity-50'
                    : 'bg-slate-900/40 hover:bg-slate-800 text-slate-300 active:scale-90 active:bg-slate-800 cursor-pointer'
                }`}
                title="Backspace"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Unlock with Account Password Link */}
            <button
              type="button"
              onClick={() => setShowPasswordFallback(true)}
              className="text-xs font-medium text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer py-1"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span>Forgot PIN? Unlock with Password</span>
            </button>
          </>
        ) : (
          /* Password Fallback View */
          <div className="w-full bg-slate-900/90 p-5 rounded-2xl border border-slate-800 mt-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                Account Verification
              </span>
              <button
                type="button"
                onClick={() => setShowPasswordFallback(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Enter your account password for <strong className="text-slate-200">{currentUser?.email || 'this session'}</strong> to unlock:
            </p>

            {pwLockoutSeconds > 0 && (
              <div className="mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-300 font-semibold animate-pulse">
                <Clock className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Too many failed attempts (3 maximum) Locked for {formatSecondsToTimer(pwLockoutSeconds)}</span>
              </div>
            )}

            <form onSubmit={handlePasswordUnlock} className="space-y-3">
              <div className="relative">
                <input
                  type={showAccountPassword ? 'text' : 'password'}
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  disabled={pwLockoutSeconds > 0 || isVerifyingPassword}
                  placeholder="Enter account password..."
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 ${
                    pwLockoutSeconds > 0 ? 'border-rose-500/50 opacity-60 cursor-not-allowed' : 'border-slate-700'
                  }`}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowAccountPassword(!showAccountPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showAccountPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {fallbackError && (
                <div className="text-xs text-rose-400 font-medium">
                  {fallbackError}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPasswordFallback(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Back to PIN
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingPassword || pwLockoutSeconds > 0}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-1.5 ${
                    pwLockoutSeconds > 0
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 cursor-pointer'
                  }`}
                >
                  {isVerifyingPassword ? 'Verifying...' : pwLockoutSeconds > 0 ? `Locked (${formatSecondsToTimer(pwLockoutSeconds)})` : 'Unlock App'}
                </button>
              </div>
            </form>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
