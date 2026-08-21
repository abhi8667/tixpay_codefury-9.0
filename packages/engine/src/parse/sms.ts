import type { BankCode, RawSms, Transaction } from '../types';

/**
 * Sender entity registry.
 *
 * Match on the trailing 6-character entity code, NEVER the full header. The
 * two-letter operator prefix varies by telecom circle and DLT appends -S/-T/-P.
 * Matching the whole string silently drops half the inbox on a different SIM.
 */
export const BANKS: Record<string, BankCode> = {
  HDFCBK: 'HDFC',
  SBIINB: 'SBI',
  ICICIB: 'ICICI',
  KOTAKB: 'KOTAK',
  AXISBK: 'AXIS',
  PNBSMS: 'PNB',
};

/** Extract the DLT entity code from a sender header, or null if absent. */
export function entityCode(address: string): string | null {
  return address.toUpperCase().match(/([A-Z]{6})(?:-[STP])?$/)?.[1] ?? null;
}

/** Resolve a sender header to a known bank, or null if it is not one of ours. */
export function resolveBank(address: string): BankCode | null {
  const code = entityCode(address);
  return code ? (BANKS[code] ?? null) : null;
}

/**
 * SMS → Transaction, or null for anything non-financial.
 */
export function parseSms(raw: RawSms): Transaction | null {
  if (!raw || !raw.address || !raw.body) return null;

  const bank = resolveBank(raw.address);
  if (!bank) return null;

  const body = raw.body;

  // 1. Reject early — OTP, promotional, future notices, registrations, balance queries
  if (/\b(?:otp|one time password|verification code)\b/i.test(body)) return null;
  if (/will be debited|pre-approved|congratulations|flat \d+% off|apply now|statement for|registered a upi|balance as on/i.test(body)) return null;

  // 2. Failure indicator
  const isFailure = /insufficient|could not be processed|failed|declined|returned|bounce/i.test(body);

  // 3. Direction
  let direction: 'DEBIT' | 'CREDIT' | null = null;
  if (isFailure || /\b(?:debited|withdrawn|paid|spent|sent)\b/i.test(body) || /\bfrom a\/c\b/i.test(body) || /\bfrom kotak bank ac\b/i.test(body)) {
    direction = 'DEBIT';
  } else if (/\b(?:credited|received|deposited|refund)\b/i.test(body)) {
    direction = 'CREDIT';
  } else {
    return null; // Not a financial transaction notice
  }

  // 4. Amount parsing
  const amountMatch = body.match(/(?:rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amountMatch) return null;
  const amountStr = amountMatch[1]!.replace(/,/g, '');
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) return null;

  // 5. VPA extraction
  const vpaMatch = body.match(/([a-z0-9._-]+@[a-z0-9.-]+)/i);
  const vpa = vpaMatch ? vpaMatch[1]!.replace(/[.,]+$/, '').toLowerCase() : undefined;

  // 6. Account tail extraction
  let accountTail: string | undefined;
  const tailMatch = body.match(/(?:a\/c|account|acct|ac)\s*(?:no\.?)?\s*(?:is|in)?\s*[x*]*(\d{4})/i)
    || body.match(/(?:bank card|\ba\/c\b|\bacct\b|\bac\b).*?[x*]+(\d{4})/i)
    || body.match(/[x*]+(\d{4})/i);
  if (tailMatch) {
    accountTail = tailMatch[1];
  }

  // 7. Balance hint extraction
  let balanceHint: number | undefined;
  const balMatch = body.match(/(?:avl|available)?\s*bal(?:ance)?\s*(?:is)?\s*(?:rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (balMatch) {
    const bStr = balMatch[1]!.replace(/,/g, '');
    const bVal = parseFloat(bStr);
    if (!isNaN(bVal)) {
      balanceHint = Math.round(bVal * 100) / 100;
    }
  }

  // 8. Ref number extraction
  let refNo: string | undefined;
  const refMatch = body.match(/(?:ref|rrn|upi ref|ref no)\.?\s*([0-9a-z]{8,})/i);
  if (refMatch) {
    refNo = refMatch[1];
  }

  // 9. Merchant hint extraction (optional extra info)
  let merchantHint: string | undefined;
  const toMatch = body.match(/(?:to|at|towards)\s+([^.\n]+)/i);
  if (toMatch) {
    merchantHint = toMatch[1]!.trim();
  }

  const id = `txn_${raw.date}_${bank}_${amount}_${accountTail || '0000'}`;

  const txn: Transaction = {
    id,
    direction,
    amount: Math.round(amount * 100) / 100,
    bank,
    timestamp: new Date(raw.date),
    isFailure,
    raw,
  };

  if (vpa) txn.vpa = vpa;
  if (accountTail) txn.accountTail = accountTail;
  if (balanceHint !== undefined) txn.balanceHint = balanceHint;
  if (refNo) txn.refNo = refNo;
  if (merchantHint) txn.merchantHint = merchantHint;

  return txn;
}
