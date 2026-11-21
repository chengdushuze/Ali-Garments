import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Delete, KeyRound, AlertCircle, Eye, EyeOff, X } from 'lucide-react';
import { apiFetch } from '../services/apiClient';

export default function AppLockScreen({
  isLocked,
  onUnlock,
  configuredPin,
  currentUser,
}) {
  const [enteredPin, setEnteredPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [fallbackError, setFallbackError] = useState('');

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
    if (!isLocked || showPasswordFallback) return;

    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, enteredPin, showPasswordFallback]);

  if (!isLocked) return null;

  const triggerError = (msg) => {
    setErrorMessage(msg);
    setIsShaking(true);
    setEnteredPin('');
    setTimeout(() => {
      setIsShaking(false);
    }, 600);
  };

  const handleDigit = (digit) => {
    if (enteredPin.length >= 4) return;
    const nextPin = enteredPin + digit;
    setEnteredPin(nextPin);
    setErrorMessage('');

    if (nextPin.length === 4) {
      // Validate PIN
      if (nextPin === configuredPin) {
        onUnlock();
      } else {
        triggerError('Incorrect PIN. Please try again.');
      }
    }
  };

  const handleBackspace = () => {
    setEnteredPin(prev => prev.slice(0, -1));
    setErrorMessage('');
  };

  const handleClear = () => {
    setEnteredPin('');
    setErrorMessage('');
  };

  // Fallback unlock via account password
  const handlePasswordUnlock = async (e) => {
    e.preventDefault();
    if (!accountPassword) {
      setFallbackError('Please enter your account password.');
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
        onUnlock();
      } else {
        setFallbackError(data.error || 'Incorrect account password.');
      }
    } catch (err) {
      setFallbackError('Verification failed. Check network connection.');
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 select-none animate-in fade-in duration-300">
      {/* Background ambient glowing shapes */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Lock Container */}
      <div className="w-full max-w-sm flex flex-col items-center relative z-10">
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
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                      isFilled
                        ? 'bg-emerald-400 border-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.8)] scale-110'
                        : 'bg-slate-900 border-slate-700'
                    }`}
                  />
                );
              })}
            </div>

            {/* Error Message */}
            <div className="h-6 mb-2 flex items-center justify-center">
              {errorMessage && (
                <span className="text-xs font-semibold text-rose-400 flex items-center gap-1 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errorMessage}
                </span>
              )}
            </div>

            {/* Numeric Keypad (Optimized for Mobile APK & Desktop) */}
            <div className="grid grid-cols-3 gap-3 w-64 mt-1 mb-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleDigit(String(num))}
                  className="h-14 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:bg-emerald-600/30 active:scale-95 text-xl font-bold text-white border border-slate-800 transition-all shadow-sm flex items-center justify-center cursor-pointer"
                >
                  {num}
                </button>
              ))}

              {/* Clear button */}
              <button
                type="button"
                onClick={handleClear}
                className="h-14 rounded-2xl bg-slate-900/40 hover:bg-slate-800 text-xs font-bold text-slate-400 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
              >
                Clear
              </button>

              {/* Zero */}
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="h-14 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:bg-emerald-600/30 active:scale-95 text-xl font-bold text-white border border-slate-800 transition-all shadow-sm flex items-center justify-center cursor-pointer"
              >
                0
              </button>

              {/* Backspace */}
              <button
                type="button"
                onClick={handleBackspace}
                className="h-14 rounded-2xl bg-slate-900/40 hover:bg-slate-800 text-slate-300 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
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

            <form onSubmit={handlePasswordUnlock} className="space-y-3">
              <div className="relative">
                <input
                  type={showAccountPassword ? 'text' : 'password'}
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  placeholder="Enter account password..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowAccountPassword(!showAccountPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
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
                  className="flex-1 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Back to PIN
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingPassword}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  {isVerifyingPassword ? 'Verifying...' : 'Unlock App'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
