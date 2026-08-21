/**
 * Money helpers.
 *
 * The public contract (types.ts) carries RUPEES because that is what §4 of the
 * build spec specifies and what Person A renders. All internal accumulation —
 * ledger walks, projections, deficits — runs in PAISE INTEGERS so a 45-point
 * balance curve never lands a `₹3,199.9999` on the projector.
 *
 * Rule: convert at the boundary, accumulate in the middle.
 */

/** Rupees (float, from SMS) → paise (integer). */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Paise (integer) → rupees, rounded to 2dp. */
export function toRupees(paise: number): number {
  return Math.round(paise) / 100;
}

/** Round a rupee figure to 2dp. Use at every boundary that emits rupees. */
export function round2(rupees: number): number {
  return Math.round(rupees * 100) / 100;
}

/**
 * Round up to the nearest ₹500. Sweep instructions must be a figure a human
 * would actually transfer — '₹3,500', not '₹3,247'.
 */
export function roundUpTo500(rupees: number): number {
  return Math.ceil(rupees / 500) * 500;
}

/**
 * Parse an Indian-format amount string into rupees.
 * Handles lakh grouping ('1,25,000.00') and stray spaces. Returns null rather
 * than NaN so callers can branch cleanly — the engine never throws.
 */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
