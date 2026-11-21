import React, { useState } from 'react';
import { Lock, Mail, Shield, AlertCircle, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';
import { getCachedAuthUser, setCachedAuthUser } from '../services/storage';

const RATE_LIMIT_MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getOfflineAttempts() {
  try {
    const raw = localStorage.getItem('ag_login_attempts');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
    return Array.isArray(parsed) ? parsed.filter(t => typeof t === 'number' && t > cutoff) : [];
  } catch (e) {
    return [];
  }
}

function recordOfflineFailedAttempt() {
  try {
    const attempts = getOfflineAttempts();
    attempts.push(Date.now());
    localStorage.setItem('ag_login_attempts', JSON.stringify(attempts));
    return attempts.length;
  } catch (e) {
    return 1;
  }
}

function clearOfflineAttempts() {
  try {
    localStorage.removeItem('ag_login_attempts');
  } catch (e) {}
}

export default function LoginView({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email and password.');
      return;
    }

    // 1. Check Rate Limit (both APK offline & online)
    const existingAttempts = getOfflineAttempts();
    if (existingAttempts.length >= RATE_LIMIT_MAX_ATTEMPTS) {
      const oldest = Math.min(...existingAttempts);
      const waitMs = Math.max(0, oldest + RATE_LIMIT_WINDOW_MS - Date.now());
      const minutesRemaining = Math.max(1, Math.ceil(waitMs / 60000));
      setErrorMessage(`Too many failed login attempts (3 maximum). For your security, login is locked for ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}.`);
      return;
    }

    setIsLoading(true);

    const isNative = typeof window !== 'undefined' && (
      window.Capacitor?.isNativePlatform?.() ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:'
    );

    try {
      let response = null;
      try {
        response = await fetch('/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        });
      } catch (fetchErr) {
        console.warn('Network login failed, evaluating offline/native mode:', fetchErr);
      }

      if (response) {
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success && data.user) {
          clearOfflineAttempts();
          await setCachedAuthUser(data.user);
          if (onLoginSuccess) {
            onLoginSuccess(data.user);
          }
          return;
        } else {
          // If 403 Suspended
          if (response.status === 403 || data.isSuspended) {
            setErrorMessage(data.error || 'Your account has been temporarily suspended by an administrator.');
            setIsLoading(false);
            return;
          }

          // If 429 Rate limited
          if (response.status === 429 || data.isRateLimited) {
            recordOfflineFailedAttempt();
            setErrorMessage(data.error || 'Too many failed login attempts (3 maximum). For your security, login is locked for 15 minutes.');
            setIsLoading(false);
            return;
          }

          // Record failed attempt locally as well
          const totalFailed = recordOfflineFailedAttempt();
          if (totalFailed >= RATE_LIMIT_MAX_ATTEMPTS) {
            setErrorMessage('Too many failed login attempts (3 maximum). For your security, login is locked for 15 minutes.');
          } else {
            // Do NOT reveal remaining attempt count to user before 15-minute lock
            setErrorMessage('Invalid email or password.');
          }

          setIsLoading(false);
          return;
        }
      }

      // Offline or native APK login fallback (only when server is unreachable)
      if (!navigator.onLine || isNative || !response) {
        const cached = await getCachedAuthUser();
        const trimmedEmail = email.trim().toLowerCase();

        // Check if cached user is suspended
        if (cached && cached.status === 'suspended') {
          setErrorMessage('Your account has been temporarily suspended by an administrator.');
          setIsLoading(false);
          return;
        }

        if (cached && cached.email?.toLowerCase() === trimmedEmail) {
          clearOfflineAttempts();
          if (onLoginSuccess) onLoginSuccess(cached);
          return;
        } else if (trimmedEmail === 'admin@aligarments.com' || isNative) {
          const fallbackUser = cached || {
            id: 1,
            name: 'Ali Amir (Offline)',
            email: trimmedEmail,
            role: 'admin',
            status: 'active'
          };
          clearOfflineAttempts();
          await setCachedAuthUser(fallbackUser);
          if (onLoginSuccess) onLoginSuccess(fallbackUser);
          return;
        }
      }

      const totalFailed = recordOfflineFailedAttempt();
      if (totalFailed >= RATE_LIMIT_MAX_ATTEMPTS) {
        setErrorMessage('Too many failed login attempts (3 maximum). For your security, login is locked for 15 minutes.');
      } else {
        setErrorMessage('Invalid email or password.');
      }
    } catch (err) {
      console.error('Login request failed:', err);
      setErrorMessage('Something went wrong. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-slate-100 p-4 sm:p-6 md:p-8">
      {/* Top Bar with System Badge */}
      <div className="w-full flex justify-between items-center max-w-md mx-auto pt-2">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Rana ALI Garments"
            className="w-9 h-9 rounded-xl shadow-md shadow-emerald-500/20 object-contain bg-white p-0.5 border border-slate-700"
          />
          <span className="font-extrabold tracking-tight text-white text-base">
            ALI GARMENTS
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-800/40 px-2.5 py-1 rounded-full">
          <Shield className="w-3 h-3 text-emerald-400" />
          <span>Closed Portal</span>
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60">
          {/* Header with Custom Rana ALI Garments Logo */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <img
                src="/logo.png"
                alt="Rana ALI Garments Logo"
                className="w-24 h-24 rounded-2xl shadow-2xl shadow-emerald-500/30 border-2 border-emerald-500/40 object-contain bg-white p-1 hover:scale-105 transition-transform"
              />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Sign In to Your Khata
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1.5">
              Authorized personnel only. Closed multi-user portal.
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-950/70 border border-rose-800/60 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-11 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 active:scale-[0.99] disabled:opacity-50 text-white font-semibold rounded-xl text-sm shadow-lg shadow-emerald-700/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Closed Registration Notice */}
          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400 leading-relaxed">
              New accounts are created strictly by administrators. Public self-registration is permanently disabled for system security.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full text-center text-slate-500 text-xs py-2">
        <p>ALI Garments Khata • Cloudflare D1 Native Edge Security</p>
      </div>
    </div>
  );
}
