/**
 * Universal Rate Limiter for Password & PIN Verification Areas
 * Enforces security lockouts across App Lock Forgot, Admin Panel Gate, Settings Consent, etc.
 * Note: Error messages must NOT contain dots (.)
 */

const STORAGE_PREFIX_LOCKOUT = 'ag_rl_lockout_';
const STORAGE_PREFIX_ATTEMPTS = 'ag_rl_attempts_';

function getStorage() {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage;
  }
  return null;
}

/**
 * Checks the current rate limit status for a given key.
 * @param {string} key Identifier for the protected area
 * @param {number} maxAttempts Max allowed attempts before lockout (default: 5)
 * @returns {{ isLocked: boolean, secondsLeft: number, attemptsLeft: number, failedAttempts: number }}
 */
export function getRateLimitStatus(key, maxAttempts = 5) {
  const storage = getStorage();
  if (!storage) {
    return { isLocked: false, secondsLeft: 0, attemptsLeft: maxAttempts, failedAttempts: 0 };
  }

  try {
    const lockoutUntil = Number(storage.getItem(STORAGE_PREFIX_LOCKOUT + key) || 0);
    const failedAttempts = Number(storage.getItem(STORAGE_PREFIX_ATTEMPTS + key) || 0);
    const now = Date.now();

    if (lockoutUntil > now) {
      const secondsLeft = Math.ceil((lockoutUntil - now) / 1000);
      return {
        isLocked: true,
        secondsLeft,
        attemptsLeft: 0,
        failedAttempts
      };
    }

    const attemptsLeft = Math.max(0, maxAttempts - failedAttempts);
    return {
      isLocked: false,
      secondsLeft: 0,
      attemptsLeft,
      failedAttempts
    };
  } catch (e) {
    return { isLocked: false, secondsLeft: 0, attemptsLeft: maxAttempts, failedAttempts: 0 };
  }
}

/**
 * Records a failed verification attempt.
 * If failed attempts reach maxAttempts, triggers a lockout.
 * @param {string} key Identifier
 * @param {number} maxAttempts Max allowed attempts (default: 5)
 * @param {number} baseLockoutSeconds Duration in seconds (default: 30)
 * @returns {{ isLocked: boolean, secondsLeft: number, attemptsLeft: number, errorMessage: string }}
 */
export function recordRateLimitFailure(key, maxAttempts = 5, baseLockoutSeconds = 30) {
  const storage = getStorage();
  let failedAttempts = 1;

  if (storage) {
    try {
      const current = Number(storage.getItem(STORAGE_PREFIX_ATTEMPTS + key) || 0);
      failedAttempts = current + 1;
      storage.setItem(STORAGE_PREFIX_ATTEMPTS + key, String(failedAttempts));
    } catch (e) {}
  }

  if (failedAttempts >= maxAttempts) {
    // Increase lockout duration for repeated violations (30s, 60s, 120s)
    const multiplier = Math.min(4, Math.floor(failedAttempts / maxAttempts));
    const lockoutDuration = baseLockoutSeconds * multiplier;
    const lockoutUntil = Date.now() + lockoutDuration * 1000;

    if (storage) {
      try {
        storage.setItem(STORAGE_PREFIX_LOCKOUT + key, String(lockoutUntil));
      } catch (e) {}
    }

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
    errorMessage: `Incorrect password or PIN ${attemptsLeft} attempt${attemptsLeft > 1 ? 's' : ''} remaining`
  };
}

/**
 * Resets the failed attempts and removes lockout upon successful verification.
 * @param {string} key Identifier
 */
export function resetRateLimit(key) {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(STORAGE_PREFIX_LOCKOUT + key);
      storage.removeItem(STORAGE_PREFIX_ATTEMPTS + key);
    } catch (e) {}
  }
}
