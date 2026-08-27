/**
 * Brakes in front of the Google Solar API.
 *
 * Three independent ways to end up in fallback mode:
 *
 *  1. Kill switch:  SOLAR_ENABLED=false in the environment. This is the
 *     lever you pull from Vercel when the quota warning mail arrives — no
 *     deploy needed, and it takes effect on the next request.
 *  2. Monthly cap:  SOLAR_MAX_CALLS_PER_MONTH=1000 stops us before Google
 *     does. The free tier is 1000 buildingInsights calls per month.
 *  3. Automatic:    a 429 or RESOURCE_EXHAUSTED from Google blocks calls for
 *     an hour, so we stop hammering an empty quota.
 *
 * Note: the counter lives in one server instance's memory. On Vercel that
 * means several instances count separately, so the monthly cap is a coarse
 * guard, not a guarantee. The hard limit is the quota you set in Google
 * Cloud Console; this module makes sure the user gets a working alternative
 * instead of an error when that limit is reached.
 */

const ONE_HOUR_MS = 60 * 60 * 1000;

let blockedUntil = 0;
let currentMonth = null;
let callCount = 0;

function monthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

function rollMonth() {
  const now = monthKey();
  if (currentMonth !== now) {
    currentMonth = now;
    callCount = 0;
  }
}

/** Returns the fallback reason, or null when we may call Google. */
export function solarBlocked() {
  if (process.env.SOLAR_ENABLED === "false") return "avslatt";
  if (Date.now() < blockedUntil) return "kvote";

  const cap = Number(process.env.SOLAR_MAX_CALLS_PER_MONTH || 0);
  if (cap > 0) {
    rollMonth();
    if (callCount >= cap) return "kvote";
  }
  return null;
}

export function countCall(n = 1) {
  rollMonth();
  callCount += n;
}

/** Called when Google itself says the quota is spent. */
export function markQuotaHit(ms = ONE_HOUR_MS) {
  blockedUntil = Date.now() + ms;
}

export function quotaStatus() {
  rollMonth();
  return {
    active: solarBlocked() === null,
    callsThisMonth: callCount,
    blockedUntil:
      blockedUntil > Date.now() ? new Date(blockedUntil).toISOString() : null,
  };
}

/** Does this Google response look like an exhausted quota? */
export function isQuotaError(status, data) {
  if (status === 429) return true;
  const err = data?.error;
  if (!err) return false;
  if (err.status === "RESOURCE_EXHAUSTED") return true;
  return status === 403 && /quota|rate limit/i.test(err.message || "");
}
