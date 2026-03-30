type Bucket = { resetAt: number; count: number };

const buckets = new Map<string, Bucket>();

const PRUNE_EVERY_MS = 60_000;
let lastPrune = 0;

function prune(now: number) {
  if (now - lastPrune < PRUNE_EVERY_MS) return;
  lastPrune = now;
  for (const [k, b] of buckets) {
    if (b.resetAt < now) buckets.delete(k);
  }
}

/**
 * Fixed-window rate limiter (in-memory; per server instance).
 * Throws an Error with `status: 429` when exceeded.
 */
export function rateLimitOrThrow(
  key: string,
  limit: number,
  windowMs: number,
): void {
  const now = Date.now();
  prune(now);
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (b.count >= limit) {
    const err = new Error("Too many requests");
    Object.assign(err, { status: 429 });
    throw err;
  }
  b.count += 1;
}

export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
