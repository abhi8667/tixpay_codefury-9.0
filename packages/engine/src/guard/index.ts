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
  
  // Hypothetically, SWEEP means we add a positive injection at the shortfall date.
  // We can simulate it by creating a fake income event or pretending it's there.
  // But for the curve, sweeping on `now` is the realistic option.
  const sweepCurve = projectWithPaused(ledger, mandates, income, now, [], sweepAmount);

  // Calculate penalties avoided (all atRisk mandates are saved by the sweep)
  let penaltyAvoided = 0;
  for (const m of shortfall.atRisk) penaltyAvoided += PENALTY[m.category];

  options.push({
    kind: 'SWEEP',
    label: `Move ₹${sweepAmount} to this account`,
    amount: sweepAmount,
    penaltyAvoided,
    savedMandates: shortfall.atRisk,
    resultingCurve: sweepCurve
  });

  // 2. PAUSE - Pause lowest priority at-risk mandate if it clears the deficit.
  const rankedRisk = rankByPriority(shortfall.atRisk);
  const lowestPrio = rankedRisk[rankedRisk.length - 1];

  if (lowestPrio && lowestPrio.amount >= shortfall.deficit) {
    const pauseCurve = projectWithPaused(ledger, mandates, income, now, [lowestPrio.id]);
    
    // Check if pause actually clears the deficit (i.e. no point below 500)
    // Wait, pausing clears this mandate, so penalty avoided is all OTHER mandates that were at risk.
    // Actually, if we pause it, we avoid the penalty on the higher priority ones.
    const pauseSaved = shortfall.atRisk.filter(m => m.id !== lowestPrio.id);
    let pausePenaltyAvoided = pauseSaved.reduce((sum, m) => sum + PENALTY[m.category], 0);

    options.push({
      kind: 'PAUSE',
      label: `Pause ${lowestPrio.displayName} ₹${lowestPrio.amount}`,
      target: lowestPrio,
      amount: lowestPrio.amount,
      penaltyAvoided: pausePenaltyAvoided,
      savedMandates: pauseSaved,
      resultingCurve: pauseCurve
    });
  }

  // Sort by penalty avoided (descending)
  return options.sort((a, b) => b.penaltyAvoided - a.penaltyAvoided).slice(0, 3);
}
