import type { FailureCause, ShadowLedger, Transaction } from '../types';

/**
 * Classify why a transaction failed.
 */
export function classifyFailure(failed: Transaction, ledger: ShadowLedger): FailureCause {
  // If we don't have a reliable balance within 7 days, we can't confidently attribute it.
  const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
  
  let hasReliableBalance = false;
  if (ledger.hintTimestamps) {
    const time = failed.timestamp.getTime();
    for (const hintTime of ledger.hintTimestamps) {
      if (Math.abs(time - hintTime) <= sevenDaysInMs) {
        hasReliableBalance = true;
        break;
      }
    }
  }

  if (!hasReliableBalance) {
    return 'UNKNOWN';
  }

  const balance = ledger.balanceAt(failed.timestamp);

  if (balance < failed.amount) {
    return 'LIQUIDITY'; // insufficient funds
  } else {
    return 'INTENTIONAL'; // balance was sufficient, meaning user actively stopped it
  }
}
