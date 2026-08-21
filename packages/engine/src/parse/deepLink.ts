import type { PaymentIntent, UpiIntent } from '../types';
import { parseAmount } from '../money';

/**
 * UPI deep link → PaymentIntent.
 *
 * This one is REAL, not simulated. UPI QR codes are deep links carrying plain
 * query params, so Person A's camera can scan a genuine shop QR and we parse
 * actual merchant data off it. Scanning a real QR on stage is an authentic
 * moment — protect it.
 *
 *   upi://pay?pa=merchant@ybl&pn=Croma&am=8000&mc=5732&tr=XYZ&cu=INR
 *
 * Be liberal in what we accept and never throw: a judge WILL scan a random QR
 * to test us. Anything unparseable returns null and Person A shows a friendly
 * "not a UPI code" state.
 */

/** Accepts `upi://pay?…`, `upi:pay?…`, `upi://…`, and Android `intent://` URLs. */
const UPI_SCHEME = /^upi:(?:\/\/)?/i;

/**
 * A VPA is `handle@psp`. Deliberately permissive on the handle (real ones carry
 * dots, hyphens, underscores and order IDs) and strict-ish on the PSP suffix.
 */
const VPA_SHAPE = /^[a-z0-9._-]{2,}@[a-z][a-z0-9.]{1,}$/i;

/**
 * Pull the UPI query string out of whatever wrapper it arrived in.
 * Android intent URLs look like:
 *   intent://pay?pa=x@ybl&am=100#Intent;scheme=upi;package=com.phonepe.app;end
 */
function extractQuery(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Android intent wrapper — the UPI params sit before the #Intent fragment.
  if (/^intent:/i.test(trimmed)) {
    if (!/scheme=upi/i.test(trimmed)) return null;
    const body = trimmed.replace(/^intent:(?:\/\/)?/i, '').split('#')[0] ?? '';
    const q = body.indexOf('?');
    return q === -1 ? null : body.slice(q + 1);
  }

  if (!UPI_SCHEME.test(trimmed)) return null;

  const body = trimmed.replace(UPI_SCHEME, '');
  const q = body.indexOf('?');
  if (q === -1) return null;

  // Strip any fragment; some wallets append one.
  return (body.slice(q + 1).split('#')[0] ?? '');
}

/** Decode a query value, tolerating malformed percent-escapes. */
function decode(value: string): string {
  const plussed = value.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(plussed);
  } catch {
    return plussed;
  }
}

/**
 * Raw param bag from a UPI URL. Exposed because `resolveMcc` takes the payload
 * directly when an `mc` field is present (confidence 1.0).
 * Returns null if the URL is not a UPI link at all.
 */
export function parseUpiParams(url: string): UpiIntent | null {
  const query = extractQuery(url);
  if (query === null) return null;

  const out: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = decode(eq === -1 ? pair : pair.slice(0, eq)).toLowerCase();
    const value = eq === -1 ? '' : decode(pair.slice(eq + 1));
    // First occurrence wins — duplicated params are a malformed-QR signal.
    if (key && !(key in out)) out[key] = value;
  }

  if (!out['pa']) return null;
  return out as UpiIntent;
}

/**
 * Deterministic transaction reference.
 *
 * Not random on purpose: the engine must be pure, and a demo that produces a
 * different ref on the second run is a demo that gets a question we can't
 * answer. Same QR + same amount always yields the same ref.
 */
export function deriveTxnRef(vpa: string, amount: number): string {
  const seed = `${vpa.toLowerCase()}|${Math.round(amount * 100)}`;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `TP${(h >>> 0).toString(36).toUpperCase().padStart(7, '0')}`;
}

export interface ParseDeepLinkOptions {
  /** Override the generated reference. Person C passes one for INTENT txns. */
  txnRef?: string;
  /** How the intent reached us. Defaults to QR — the camera is the main path. */
  source?: PaymentIntent['source'];
}

/**
 * Parse a UPI deep link into a PaymentIntent, or null if it isn't one.
 *
 * `pa` is required — no payee address, no payment. `am` is frequently absent on
 * static merchant QRs (the shop's printed code has no amount on it), in which
 * case `amount` comes back as 0 and Person A prompts for it. That is a normal
 * path, not an error.
 */
export function parseUpiDeepLink(
  url: string,
  options: ParseDeepLinkOptions = {},
): PaymentIntent | null {
  if (typeof url !== 'string') return null;

  const params = parseUpiParams(url);
  if (!params) return null;

  const vpa = (params.pa ?? '').trim();
  if (!VPA_SHAPE.test(vpa)) return null;

  // `am` absent → static QR, amount entered by the user.
  const amount = params.am ? (parseAmount(params.am) ?? 0) : 0;
  if (amount < 0) return null;

  // Only trust `mc` when it looks like a real 4-digit MCC.
  const mcc = params.mc && /^\d{4}$/.test(params.mc.trim()) ? params.mc.trim() : undefined;

  const payeeName = (params.pn ?? '').trim() || vpa.split('@')[0] || vpa;

  return {
    vpa,
    payeeName,
    amount,
    ...(mcc ? { mcc } : {}),
    txnRef: options.txnRef ?? deriveTxnRef(vpa, amount),
    source: options.source ?? 'QR',
  };
}
