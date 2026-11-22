/**
 * Universal Rate Limiter for Password & PIN Verification Areas
 * Rules:
 * 1. Where account password is used: Rate Limit = 3 Attempts / 15 Minutes (900 seconds)
 * 2. If user unable to guess password within 6 tries: Automatically suspend user
 * 3. NO PERIODS (.) in authentication error messages
 */

const STORAGE_PREFIX_LOCKOUT = 'ag_rl_lockout_';
const STORAGE_PREFIX_ATTEMPTS = 'ag_rl_attempts_';
const STORAGE_PREFIX_TOTAL_FAILURES = 'ag_rl_total_failures_';
const STORAGE_PREFIX_SUSPENDED = 'ag_rl_suspended_';

const PASSWORD_MAX_ATTEMPTS = 3;
const PASSWORD_LOCKOUT_SECONDS = 15 * 60; // 15 minutes = 900 seconds
const PASSWORD_AUTO_SUSPEND_THRESHOLD = 6;

function getSessionStore() {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage;
  }
  return null;
}

function getLocalStore() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

/**
 * Checks rate limit and suspension status for account password.
 * @param {string} identifier e.g. email or action key
 * @returns {{ isSuspended: boolean, isLocked: boolean, secondsLeft: number, attemptsLeft: number, totalFailures: number }}
 */
export function checkAccountPasswordRateLimit(identifier = 'account_password') {
  const local = getLocalStore();
  const session = getSessionStore();

  const key = String(identifier || 'account_password').toLowerCase().trim();

  // 1. Check if user was marked suspended
  const isSuspendedLocally = local?.getItem(STORAGE_PREFIX_SUSPENDED + key) === 'true';
  const totalFailures = Number(local?.getItem(STORAGE_PREFIX_TOTAL_FAILURES + key) || 0);

  if (isSuspendedLocally || totalFailures >= PASSWORD_AUTO_SUSPEND_THRESHOLD) {
    return {
      isSuspended: true,
      isLocked: true,
      secondsLeft: 0,
      attemptsLeft: 0,
      totalFailures,
      errorMessage: 'Your account has been automatically suspended due to 6 failed password attempts Please contact administrator'
    };
  }

  // 2. Check 15-minute lockout
  const lockoutUntil = Number(local?.getItem(STORAGE_PREFIX_LOCKOUT + key) || session?.getItem(STORAGE_PREFIX_LOCKOUT + key) || 0);
  const now = Date.now();

  if (lockoutUntil > now) {
    const secondsLeft = Math.ceil((lockoutUntil - now) / 1000);
    const minutesLeft = Math.ceil(secondsLeft / 60);
    return {
      isSuspended: false,
      isLocked: true,
      secondsLeft,
      minutesLeft,
      attemptsLeft: 0,
      totalFailures,
      errorMessage: `Too many failed password attempts (3 maximum) Access is locked for ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}`
    };
  }

  // 3. Current window failed attempts
  const currentAttempts = Number(session?.getItem(STORAGE_PREFIX_ATTEMPTS + key) || 0);
  const attemptsLeft = Math.max(0, PASSWORD_MAX_ATTEMPTS - currentAttempts);

  return {
    isSuspended: false,
    isLocked: false,
    secondsLeft: 0,
    attemptsLeft,
    totalFailures,
    errorMessage: ''
  };
}

/**
 * Records a failed account password attempt.
 * Enforces 3 attempts / 15 minutes, and auto-suspends on the 6th failed attempt.
 * @param {string} identifier
 * @param {string} email
 * @returns {{ isSuspended: boolean, isLocked: boolean, secondsLeft: number, attemptsLeft: number, totalFailures: number, errorMessage: string }}
 */
export function recordAccountPasswordFailure(identifier = 'account_password', email = '') {
  const local = getLocalStore();
  const session = getSessionStore();
  const key = String(identifier || 'account_password').toLowerCase().trim();
  const emailKey = email ? String(email).toLowerCase().trim() : key;

  // Increment total cumulative failures
  const prevTotal = Number(local?.getItem(STORAGE_PREFIX_TOTAL_FAILURES + key) || 0);
  const totalFailures = prevTotal + 1;
  local?.setItem(STORAGE_PREFIX_TOTAL_FAILURES + key, String(totalFailures));
  if (emailKey !== key) {
    local?.setItem(STORAGE_PREFIX_TOTAL_FAILURES + emailKey, String(totalFailures));
  }

  // Check 6-try Auto-Suspension Threshold
  if (totalFailures >= PASSWORD_AUTO_SUSPEND_THRESHOLD) {
    local?.setItem(STORAGE_PREFIX_SUSPENDED + key, 'true');
    if (emailKey !== key) {
      local?.setItem(STORAGE_PREFIX_SUSPENDED + emailKey, 'true');
    }

    return {
      isSuspended: true,
      isLocked: true,
      secondsLeft: 0,
      attemptsLeft: 0,
      totalFailures,
      errorMessage: 'Your account has been automatically suspended due to 6 failed password attempts Please contact administrator'
    };
  }

  // Increment current 15-minute window attempts
  const currentAttempts = Number(session?.getItem(STORAGE_PREFIX_ATTEMPTS + key) || 0) + 1;
  session?.setItem(STORAGE_PREFIX_ATTEMPTS + key, String(currentAttempts));

  // Check 3-attempt / 15-minute lockout
  if (currentAttempts >= PASSWORD_MAX_ATTEMPTS) {
    const lockoutUntil = Date.now() + PASSWORD_LOCKOUT_SECONDS * 1000;
    local?.setItem(STORAGE_PREFIX_LOCKOUT + key, String(lockoutUntil));
    session?.setItem(STORAGE_PREFIX_LOCKOUT + key, String(lockoutUntil));
    // Reset window counter for the next window after lockout
    session?.removeItem(STORAGE_PREFIX_ATTEMPTS + key);

    return {
      isSuspended: false,
      isLocked: true,
      secondsLeft: PASSWORD_LOCKOUT_SECONDS,
      minutesLeft: 15,
      attemptsLeft: 0,
      totalFailures,
      errorMessage: 'Too many failed password attempts (3 maximum) For your security access is locked for 15 minutes'
    };
  }

  const attemptsLeft = PASSWORD_MAX_ATTEMPTS - currentAttempts;
  const triesUntilSuspension = PASSWORD_AUTO_SUSPEND_THRESHOLD - totalFailures;

  return {
    isSuspended: false,
    isLocked: false,
    secondsLeft: 0,
    attemptsLeft,
    totalFailures,
    errorMessage: `Incorrect password (${attemptsLeft} attempt${attemptsLeft > 1 ? 's' : ''} remaining before 15-minute lock ${triesUntilSuspension} before suspension)`
  };
}

/**
 * Resets the password rate limiter upon successful authentication.
 * @param {string} identifier
 */
export function resetAccountPasswordRateLimit(identifier = 'account_password', email = '') {
  const local = getLocalStore();
  const session = getSessionStore();
  const key = String(identifier || 'account_password').toLowerCase().trim();
  const emailKey = email ? String(email).toLowerCase().trim() : key;

  local?.removeItem(STORAGE_PREFIX_LOCKOUT + key);
  session?.removeItem(STORAGE_PREFIX_LOCKOUT + key);
  session?.removeItem(STORAGE_PREFIX_ATTEMPTS + key);
  local?.removeItem(STORAGE_PREFIX_TOTAL_FAILURES + key);

  if (emailKey !== key) {
    local?.removeItem(STORAGE_PREFIX_LOCKOUT + emailKey);
    session?.removeItem(STORAGE_PREFIX_LOCKOUT + emailKey);
    session?.removeItem(STORAGE_PREFIX_ATTEMPTS + emailKey);
    local?.removeItem(STORAGE_PREFIX_TOTAL_FAILURES + emailKey);
  }
}

// -------------------------------------------------------------
// PIN-Specific Rate Limiting (Used for 4-digit App Lock PIN)
// -------------------------------------------------------------
export function getRateLimitStatus(key, maxAttempts = 5) {
  const session = getSessionStore();
  if (!session) {
    return { isLocked: false, secondsLeft: 0, attemptsLeft: maxAttempts, failedAttempts: 0 };
  }

  try {
    const lockoutUntil = Number(session.getItem(STORAGE_PREFIX_LOCKOUT + key) || 0);
    const failedAttempts = Number(session.getItem(STORAGE_PREFIX_ATTEMPTS + key) || 0);
    const now = Date.now();

    if (lockoutUntil > now) {
      const secondsLeft = Math.ceil((lockoutUntil - now) / 1000);
      return { isLocked: true, secondsLeft, attemptsLeft: 0, failedAttempts };
    }

    const attemptsLeft = Math.max(0, maxAttempts - failedAttempts);
    return { isLocked: false, secondsLeft: 0, attemptsLeft, failedAttempts };
  } catch (e) {
    return { isLocked: false, secondsLeft: 0, attemptsLeft: maxAttempts, failedAttempts: 0 };
  }
}

export function recordRateLimitFailure(key, maxAttempts = 5, baseLockoutSeconds = 30) {
  const session = getSessionStore();
  let failedAttempts = 1;

  if (session) {
    try {
      const current = Number(session.getItem(STORAGE_PREFIX_ATTEMPTS + key) || 0);
      failedAttempts = current + 1;
      session.setItem(STORAGE_PREFIX_ATTEMPTS + key, String(failedAttempts));
    } catch (e) {}
  }

  if (failedAttempts >= maxAttempts) {
    const multiplier = Math.min(4, Math.floor(failedAttempts / maxAttempts));
    const lockoutDuration = baseLockoutSeconds * multiplier;
    const lockoutUntil = Date.now() + lockoutDuration * 1000;

    session?.setItem(STORAGE_PREFIX_LOCKOUT + key, String(lockoutUntil));

    return {
      isLocked: true,
      secondsLeft: lockoutDuration,
      attemptsLeft: 0,
      errorMessage: `Too many failed attempts Access locked for ${lockoutDuration} seconds`
    };
  }

  const attemptsLeft = maxAttempts - failedAttempts;
  return {
    isLocked: false,
    secondsLeft: 0,
    attemptsLeft,
    errorMessage: `Incorrect PIN ${attemptsLeft} attempt${attemptsLeft > 1 ? 's' : ''} remaining`
  };
}

export function resetRateLimit(key) {
  const session = getSessionStore();
  session?.removeItem(STORAGE_PREFIX_LOCKOUT + key);
  session?.removeItem(STORAGE_PREFIX_ATTEMPTS + key);
}
