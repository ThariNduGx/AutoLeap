import { Redis } from '@upstash/redis';
import { NextRequest } from 'next/server';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface RateLimitOptions {
  /** Maximum requests allowed in the window. Default: 60 */
  limit?: number;
  /** Window size in seconds. Default: 60 */
  windowSeconds?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix timestamp when the window resets */
  resetAt: number;
}

/**
 * Sliding-window rate limiter backed by Upstash Redis.
 *
 * Usage:
 *   const result = await rateLimit(req, 'api/faqs');
 *   if (!result.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 */
export async function rateLimit(
  req: NextRequest,
  endpoint: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const limit = options.limit ?? 60;
  const windowSeconds = options.windowSeconds ?? 60;

  const identifier = getClientIp(req);
  const key = `rl:${endpoint}:${identifier}`;
  const now = Math.floor(Date.now() / 1000);

  try {
    // Atomic: increment and get TTL in one pipeline
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.ttl(key);
    const [count, ttl] = (await pipeline.exec()) as [number, number];

    // Set expiry only on first request (ttl === -1 means no expiry set yet)
    if (ttl === -1) {
      await redis.expire(key, windowSeconds);
    }

    const remaining = Math.max(0, limit - count);
    const resetAt = ttl > 0 ? now + ttl : now + windowSeconds;

    return { allowed: count <= limit, limit, remaining, resetAt };
  } catch (err) {
    // Fail open: if Redis is down, let the request through rather than
    // blocking all traffic.
    console.error('[RATE_LIMIT] Redis error — failing open:', err);
    return { allowed: true, limit, remaining: 1, resetAt: now + windowSeconds };
  }
}

/**
 * Key-based rate limiter — identical sliding-window logic as `rateLimit()` but
 * accepts an arbitrary string key instead of deriving one from a NextRequest IP.
 * Use this for per-entity limits (e.g. per-customer chat_id) where the standard
 * IP-based key would incorrectly bucket all customers behind a shared gateway IP.
 *
 * Example key: `msg:<businessId>:<chatId>`
 */
export async function rateLimitByKey(
  key: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const limit = options.limit ?? 60;
  const windowSeconds = options.windowSeconds ?? 60;
  const now = Math.floor(Date.now() / 1000);

  try {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.ttl(key);
    const [count, ttl] = (await pipeline.exec()) as [number, number];

    if (ttl === -1) {
      await redis.expire(key, windowSeconds);
    }

    const remaining = Math.max(0, limit - count);
    const resetAt = ttl > 0 ? now + ttl : now + windowSeconds;

    return { allowed: count <= limit, limit, remaining, resetAt };
  } catch (err) {
    console.error('[RATE_LIMIT] Redis error — failing open:', err);
    return { allowed: true, limit, remaining: 1, resetAt: now + windowSeconds };
  }
}

/** Extract the real client IP, respecting Vercel/Cloudflare forwarding headers. */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
