interface AttemptRecord {
  attempts: number;
  lockedUntil?: number;
  firstAttemptAt: number;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;   // 15 minutes

const failedAttemptsMap = new Map<string, AttemptRecord>();

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [phone, record] of failedAttemptsMap.entries()) {
    if (record.lockedUntil && now > record.lockedUntil) {
      failedAttemptsMap.delete(phone);
    } else if (!record.lockedUntil && now - record.firstAttemptAt > ATTEMPT_WINDOW_MS) {
      failedAttemptsMap.delete(phone);
    }
  }
}, 5 * 60 * 1000);

export function checkLockout(phone: string): { isLocked: boolean; remainingSeconds?: number } {
  const normalizedPhone = phone.trim();
  const record = failedAttemptsMap.get(normalizedPhone);
  if (!record) return { isLocked: false };

  const now = Date.now();
  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { isLocked: true, remainingSeconds };
  }

  if (record.lockedUntil && now >= record.lockedUntil) {
    failedAttemptsMap.delete(normalizedPhone);
    return { isLocked: false };
  }

  return { isLocked: false };
}

export function recordFailedLoginAttempt(phone: string): { isNowLocked: boolean; attemptsLeft: number } {
  const normalizedPhone = phone.trim();
  const now = Date.now();
  const record = failedAttemptsMap.get(normalizedPhone);

  if (!record) {
    failedAttemptsMap.set(normalizedPhone, {
      attempts: 1,
      firstAttemptAt: now
    });
    return { isNowLocked: false, attemptsLeft: MAX_ATTEMPTS - 1 };
  }

  // If outside attempt window, reset
  if (now - record.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    failedAttemptsMap.set(normalizedPhone, {
      attempts: 1,
      firstAttemptAt: now
    });
    return { isNowLocked: false, attemptsLeft: MAX_ATTEMPTS - 1 };
  }

  record.attempts += 1;
  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    return { isNowLocked: true, attemptsLeft: 0 };
  }

  return { isNowLocked: false, attemptsLeft: MAX_ATTEMPTS - record.attempts };
}

export function resetFailedLoginAttempts(phone: string): void {
  failedAttemptsMap.delete(phone.trim());
}

export function clearAllLockouts(): void {
  failedAttemptsMap.clear();
}
