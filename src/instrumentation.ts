/**
 * Next.js Instrumentation Hook
 *
 * Runs once when the server starts (Node.js runtime only).
 * Used for startup validation — fails immediately if required env vars are missing
 * rather than failing silently at runtime during a user request.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run in Node.js (not Edge runtime, not build time)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('./lib/env');
    validateEnv();
  }
}
