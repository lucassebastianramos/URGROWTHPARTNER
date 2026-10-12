import { ENV } from '../config/env.js';

interface RateLimitRecord {
  timestamps: number[];
}

class SlidingWindowRateLimiter {
  private records: Map<string, RateLimitRecord> = new Map();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts: number, windowSeconds: number) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowSeconds * 1000;

    // Periodic cleanup of stale entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000).unref();
  }

  /**
   * Check if a request from (ip, slug) is allowed.
   * Returns { allowed: boolean, remaining: number, resetInSeconds: number }
   */
  public check(ip: string, slug: string): { allowed: boolean; remaining: number; resetInSeconds: number } {
    const key = `${ip}:${slug.toLowerCase()}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let record = this.records.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(key, record);
    }

    // Filter out timestamps outside the sliding window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (record.timestamps.length >= this.maxAttempts) {
      const oldest = record.timestamps[0];
      const resetInSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds,
      };
    }

    // Register this attempt
    record.timestamps.push(now);
    const remaining = this.maxAttempts - record.timestamps.length;
    const resetInSeconds = Math.ceil(this.windowMs / 1000);

    return {
      allowed: true,
      remaining,
      resetInSeconds,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    for (const [key, record] of this.records.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
      if (record.timestamps.length === 0) {
        this.records.delete(key);
      }
    }
  }
}

export const callRateLimiter = new SlidingWindowRateLimiter(
  ENV.RATE_LIMIT_MAX_CALLS,
  ENV.RATE_LIMIT_WINDOW_SECONDS
);
