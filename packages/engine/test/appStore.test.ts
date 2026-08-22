import { describe, it, expect, beforeAll } from 'vitest';
import { useAppStore } from '../../../apps/mobile/store/useAppStore';

/**
 * The wiring test.
 *
 * Every other suite here proves the engine computes the right numbers. This one
 * proves the SCREENS are connected to it — that tapping a remedy re-projects the
 * curve, that a sweep is funded from somewhere, that paying moves the ledger.
 * Those are the failures typechecking cannot catch and that only show up on
 * stage, because a button wired to nothing still renders perfectly.
 *
 * The store imports nothing from react-native, so it runs here unmodified. What
 * this drives is exactly what the app drives.
 */

const s = () => useAppStore.getState();
const day = (d: Date) => d.toISOString().slice(0, 10);

describe('cold start', () => {
  it('has nothing to show before a statement is imported', () => {
    expect(s().hasData()).toBe(false);
    expect(s().curve()).toEqual([]);
    expect(s().mandates()).toEqual([]);
    expect(s().shortfalls()).toEqual([]);
  });

  it('produces no verdict without a ledger, rather than a fabricated one', () => {
    expect(
      s().evaluate({
        vpa: 'x@ybl', payeeName: 'X', amount: 100, txnRef: 'T', source: 'MANUAL',
      }),
    ).toBeNull();
  });
});

describe('importing the sample statement', () => {
  beforeAll(() => {
    s().loadSampleStatement();
  });

  it('reads every row and names the account', () => {
    const imported = s().imported!;
    expect(imported.parsed).toBe(imported.rows);
    expect(imported.errors).toEqual([]);
    expect(imported.bank).toBe('HDFC');
    expect(imported.accountTail).toBe('4471');
    expect(imported.hasRunningBalance).toBe(true);
  });

  it('reconciles to the statement closing balance with zero drift', () => {
    expect(s().ledger()!.currentBalance).toBe(21597);
    expect(s().ledger()!.drift).toBe(0);
  });

  it('discovers the eight mandates and projects 30 days', () => {
    expect(s().mandates()).toHaveLength(8);
    expect(s().curve()).toHaveLength(30);
  });

  it('opens clear — a guard that always warns is a guard nobody believes', () => {
    expect(s().shortfalls()).toEqual([]);
  });
});

describe('the intercept', () => {
  const pay = (amount: number) =>
    s().evaluate({
      vpa: 'croma.store@ybl',
      payeeName: 'Croma',
      amount,
      txnRef: 'TP1',
      source: 'MANUAL',
    })!;

  it('stays quiet on amounts this account can absorb', () => {
    expect(pay(500).level).not.toBe('WARNING');
    expect(pay(2500).level).not.toBe('WARNING');
  });

  it('warns on the amount that breaks the month, and names the casualty', () => {
    const verdict = pay(8000);
    expect(verdict.level).toBe('WARNING');
    expect(verdict.headline).toContain('short on');
    expect(verdict.atRisk.length).toBeGreaterThan(0);
    expect(verdict.subline).toContain('LIC Premium');
  });

  it('recomputes per amount rather than returning one canned answer', () => {
    expect(pay(500).headline).not.toBe(pay(8000).headline);
  });
});

describe('paying anyway', () => {
  it('moves the real ledger by exactly the amount', () => {
    const before = s().ledger()!.currentBalance;
    s().executePayment(8000, 'Croma', 'croma.store@ybl');
    expect(before - s().ledger()!.currentBalance).toBe(8000);
  });

  it('opens a shortfall the guard had predicted', () => {
    expect(s().shortfalls().length).toBeGreaterThan(0);
  });
});

describe('interventions', () => {
  it('offers remedies scoped to the dip that was tapped', () => {
    const dip = s().shortfalls()[0]!;
    const options = s().interventions(dip);
    expect(options.length).toBeGreaterThan(0);
    for (const o of options) {
      expect(o.savedMandates.length > 0 || o.kind === 'SWEEP').toBe(true);
    }
  });

  it('funds a SWEEP from the Keeper and genuinely clears the dip', () => {
    const dip = s().shortfalls()[0]!;
    const sweep = s().interventions(dip).find((o) => o.kind === 'SWEEP')!;
    expect(sweep).toBeDefined();

    const jarBefore = s().keeperBalance;
    const acctBefore = s().ledger()!.currentBalance;
    expect(s().canFundSweep(sweep.amount!)).toBe(true);

    s().applyIntervention(sweep);

    // Both halves move. Money that appears from nowhere is the thing that makes
    // a rescued curve unbelievable.
    expect(s().keeperBalance).toBe(jarBefore - sweep.amount!);
    expect(s().ledger()!.currentBalance).toBe(acctBefore + sweep.amount!);
    expect(s().keeperTxns.some((k) => k.amount < 0)).toBe(true);

    // Green because the projection cleared, not because a button was pressed.
    expect(s().shortfalls()).toEqual([]);
  });

  it('applies a PAUSE by re-projecting, not by flipping a flag', () => {
    s().loadScenario('bounce');
    expect(s().shortfalls().length).toBeGreaterThan(0);

    const pause = s().interventions().find((o) => o.kind === 'PAUSE')!;
    expect(pause).toBeDefined();
    s().applyIntervention(pause);

    expect(s().pausedMandateIds).toHaveLength(1);
    expect(s().mandates().some((m) => m.isPaused)).toBe(true);
    expect(s().shortfalls()).toEqual([]);
  });
});

describe('scenario presets', () => {
  it('move only the clock — the statement is never doctored', () => {
    const seen: Record<string, { balance: number; now: string }> = {};
    for (const preset of ['healthy', 'tight', 'bounce'] as const) {
      s().loadScenario(preset);
      seen[preset] = { balance: s().ledger()!.currentBalance, now: day(s().now) };
      // Same file, same reconciled balance, whatever `now` is.
      expect(s().ledger()!.currentBalance).toBe(21597);
    }
    expect(seen.healthy!.now).not.toBe(seen.bounce!.now);
  });

  it('gives each preset the state the demo script promises', () => {
    s().loadScenario('healthy');
    expect(s().shortfalls()).toEqual([]);

    s().loadScenario('bounce');
    expect(s().shortfalls().length).toBeGreaterThan(0);

    s().loadScenario('tight');
    expect(s().shortfalls()).toEqual([]);
  });

  it('resets accepted interventions, so a rerun starts clean', () => {
    s().loadScenario('bounce');
    const pause = s().interventions().find((o) => o.kind === 'PAUSE');
    if (pause) s().applyIntervention(pause);
    s().loadScenario('bounce');
    expect(s().pausedMandateIds).toEqual([]);
    expect(s().mandateShifts).toEqual({});
  });
});

describe('the Keeper', () => {
  beforeAll(() => {
    s().loadScenario('tight');
  });

  it('moves both ways and records each leg', () => {
    const jar = s().keeperBalance;
    const entries = s().keeperTxns.length;

    s().addToKeeper(500);
    expect(s().keeperBalance).toBe(jar + 500);

    s().withdrawFromKeeper(500);
    expect(s().keeperBalance).toBe(jar);
    expect(s().keeperTxns.length).toBe(entries + 2);
  });

  it('refuses a withdrawal it cannot fund', () => {
    const jar = s().keeperBalance;
    s().withdrawFromKeeper(jar + 1);
    expect(s().keeperBalance).toBe(jar);
  });

  it('reports progress against the goal', () => {
    expect(s().keeperProgress()).toBeGreaterThan(0);
    expect(s().keeperProgress()).toBeLessThanOrEqual(1);
  });
});

describe('a file that is not a statement', () => {
  it('is refused with a reason instead of an empty dashboard', () => {
    expect(s().importStatement('dear customer, your statement is attached', 'notes.txt')).toBe(false);
    expect(s().importError).toBeTruthy();
  });

  it('leaves the previous import intact', () => {
    expect(s().hasData()).toBe(true);
  });

  it('recovers on the next good import', () => {
    expect(s().importStatement.length).toBeGreaterThan(0);
    s().loadSampleStatement();
    expect(s().importError).toBeNull();
    expect(s().mandates()).toHaveLength(8);
  });
});
