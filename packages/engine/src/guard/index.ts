import type { BalanceCurve, IncomeEvent, Intervention, Mandate, ShadowLedger, Shortfall } from '../types';
import { PENALTY, PRIORITY_ORDER } from '../types';
import { projectWithPaused } from '../project/curve';

/** Sort mandates by priority rank, then amount descending. */
export function rankByPriority(mandates: Mandate[]): Mandate[] {
  return [...mandates].sort((a, b) => {
    const rankA = PRIORITY_ORDER.indexOf(a.priority);
    const rankB = PRIORITY_ORDER.indexOf(b.priority);
    if (rankA !== rankB) return rankA - rankB;
    return b.amount - a.amount; // Tie-break: largest amount first
  });
}

/**
 * Scan curve, identify contiguous days where balance drops below buffer.
 */
export function findShortfalls(curve: BalanceCurve, mandates: Mandate[], buffer = 500): Shortfall[] {
  const shortfalls: Shortfall[] = [];
  let inShortfall = false;
  let currentShortfall: Shortfall | null = null;
  const mandateMap = new Map(mandates.map(m => [m.id, m]));

  for (const point of curve) {
    if (point.balance < buffer) {
      const deficit = buffer - point.balance;
      
      const mandatesFiring = point.events
        .filter(e => e.kind === 'MANDATE' && e.mandateId)
        .map(e => mandateMap.get(e.mandateId!))
        .filter((m): m is Mandate => m !== undefined);

      if (!inShortfall) {
        inShortfall = true;
        currentShortfall = {
          date: point.date,
          deficit: deficit,
          atRisk: [...mandatesFiring]
        };
        shortfalls.push(currentShortfall);
      } else {
        if (deficit > currentShortfall!.deficit) {
          currentShortfall!.deficit = deficit;
        }
        for (const m of mandatesFiring) {
          if (!currentShortfall!.atRisk.find(x => x.id === m.id)) {
            currentShortfall!.atRisk.push(m);
          }
        }
      }
    } else {
      inShortfall = false;
      currentShortfall = null;
    }
  }

  return shortfalls;
}

/**
 * Generate 2-3 interventions for a shortfall.
 */
export function proposeInterventions(
  shortfall: Shortfall,
  mandates: Mandate[],
  ledger: ShadowLedger,
  income: IncomeEvent[],
  now: Date
): Intervention[] {
  const options: Intervention[] = [];

  // 1. SWEEP - Move deficit + buffer in from elsewhere. Round up to nearest 500.
  const sweepAmount = Math.ceil((shortfall.deficit + 500) / 500) * 500;
  const sweepCurve = projectWithPaused(ledger, mandates, income, now, [], sweepAmount);

  let penaltyAvoided = 0;
  for (const m of shortfall.atRisk) penaltyAvoided += PENALTY[m.category];

  options.push({
    kind: 'SWEEP',
    label: `Move ₹${sweepAmount.toLocaleString('en-IN')} to this account`,
    amount: sweepAmount,
    penaltyAvoided,
    savedMandates: shortfall.atRisk,
    resultingCurve: sweepCurve
  });

  // 2. PAUSE - Look for candidate mandates firing on or before the shortfall date,
  // prioritizing LOW priority mandates (like OTT) over CRITICAL ones (like SIP/EMI).
  const candidatesBeforeShortfall = mandates.filter(
    m => !m.isPaused && m.nextDebit.getTime() <= shortfall.date.getTime()
  );

  // Sort candidates: lowest priority first (OTT > UTILITY > INSURANCE > SIP > EMI), then by amount
  const rankedCandidates = [...candidatesBeforeShortfall].sort((a, b) => {
    const rankA = PRIORITY_ORDER.indexOf(a.priority);
    const rankB = PRIORITY_ORDER.indexOf(b.priority);
    if (rankA !== rankB) return rankB - rankA; // Reverse order: lowest priority first!
    return a.amount - b.amount;
  });

  for (const candidate of rankedCandidates) {
    if (candidate.amount >= shortfall.deficit) {
      const pauseCurve = projectWithPaused(ledger, mandates, income, now, [candidate.id]);
      
      // Verify pause actually clears the shortfall
      const remainingShortfalls = findShortfalls(pauseCurve, mandates);
      if (remainingShortfalls.length === 0 || remainingShortfalls[0]!.date.getTime() > shortfall.date.getTime()) {
        const savedMandates = shortfall.atRisk.filter(m => m.id !== candidate.id);
        const pausePenaltyAvoided = savedMandates.reduce((sum, m) => sum + PENALTY[m.category], 0);

        options.push({
          kind: 'PAUSE',
          label: `Pause ${candidate.displayName} ₹${candidate.amount.toLocaleString('en-IN')}`,
          target: candidate,
          amount: candidate.amount,
          penaltyAvoided: pausePenaltyAvoided,
          savedMandates,
          resultingCurve: pauseCurve
        });
        break; // Found the optimal pause candidate
      }
    }
  }

  // Sort by penalty avoided (descending)
  return options.sort((a, b) => b.penaltyAvoided - a.penaltyAvoided).slice(0, 3);
}
