import type { BalanceCurve, IncomeEvent, Intervention, Mandate, ShadowLedger, Shortfall } from '../types';
import { PENALTY, PRIORITY_ORDER } from '../types';
import { projectBalance, projectWithPaused, projectWithSweep } from '../project/curve';
import { addDays, formatIstDate } from '../time';

export interface ProposeOptions {
  /** Length of the curve A is rendering. Every resultingCurve must match it. */
  days?: number;
}

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

  // Rank each shortfall's at-risk list so the most critical, largest mandate is
  // first. Callers read atRisk[0] to name the casualty in the verdict subline:
  // 'your ₹5,000 SIP will bounce' is the line, not 'your ₹1,899 LIC premium'.
  for (const s of shortfalls) s.atRisk = rankByPriority(s.atRisk);

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
  now: Date,
  options_: ProposeOptions = {}
): Intervention[] {
  const options: Intervention[] = [];

  // Every resultingCurve MUST be the same length as the curve A is already
  // rendering. A's morph interpolates point by point, so a mismatch is not a
  // cosmetic bug — it is a broken animation on the headline beat.
  const days = options_.days ?? 30;

  // 1. SWEEP - Move deficit + buffer in from elsewhere. Round up to nearest 500.
  const sweepAmount = Math.ceil((shortfall.deficit + 500) / 500) * 500;
  const sweepCurve = projectWithSweep(ledger, mandates, income, now, sweepAmount, days);

  let penaltyAvoided = 0;
  for (const m of shortfall.atRisk) penaltyAvoided += PENALTY[m.category];

  // Only offer it if it genuinely clears the dip. An intervention that leaves
  // the user short is worse than no intervention.
  const sweepRemaining = findShortfalls(sweepCurve, mandates);
  if (sweepRemaining.length === 0 || sweepRemaining[0]!.date.getTime() > shortfall.date.getTime()) {
    options.push({
      kind: 'SWEEP',
      label: `Move ₹${sweepAmount.toLocaleString('en-IN')} to this account`,
      amount: sweepAmount,
      penaltyAvoided,
      savedMandates: shortfall.atRisk,
      resultingCurve: sweepCurve
    });
  }

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
      const pauseCurve = projectWithPaused(ledger, mandates, income, now, [candidate.id], days);
      
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

  // 3. SHIFT - Move a mandate's debit date past the next income event.
  const nextIncome = [...income]
    .filter(e => e.date.getTime() > now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  if (nextIncome && nextIncome.date.getTime() <= addDays(now, days).getTime()) {
    const shiftDate = addDays(nextIncome.date, 1);

    for (const candidate of rankedCandidates) {
      if (candidate.nextDebit.getTime() < nextIncome.date.getTime()) {
        const shiftedMandates = mandates.map(m =>
          m.id === candidate.id ? { ...m, nextDebit: shiftDate } : m
        );
        const shiftCurve = projectBalance(ledger, shiftedMandates, income, now, days);
        const remainingShortfalls = findShortfalls(shiftCurve, shiftedMandates);

        if (remainingShortfalls.length === 0 || remainingShortfalls[0]!.date.getTime() > shortfall.date.getTime()) {
          const savedMandates = shortfall.atRisk.filter(m => m.id !== candidate.id);
          const shiftPenaltyAvoided = savedMandates.reduce((sum, m) => sum + PENALTY[m.category], 0);

          options.push({
            kind: 'SHIFT',
            label: `Shift ${candidate.displayName} to ${formatIstDate(shiftDate)}`,
            target: candidate,
            amount: candidate.amount,
            penaltyAvoided: shiftPenaltyAvoided,
            savedMandates,
            resultingCurve: shiftCurve
          });
          break;
        }
      }
    }
  }

  // Sort by penalty avoided (descending)
  return options.sort((a, b) => b.penaltyAvoided - a.penaltyAvoided).slice(0, 3);
}
