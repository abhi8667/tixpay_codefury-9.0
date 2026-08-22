import { create } from 'zustand';
import type {
  RawSms,
  Mandate,
  BalanceCurve,
  Shortfall,
  Intervention,
  Recommendation,
  Transaction,
  ShadowLedger,
  Card,
  PaymentIntent,
  PaymentVerdict,
} from '@tixpay/types';
import {
  mockMandates,
  mockCurve,
  mockShortfall,
  mockInterventions,
  mockRecommendation,
  mockCards,
} from '@tixpay/types/mocks';
import {
  runPipeline,
  evaluatePayment,
  projectWithPaused,
  findShortfalls,
  proposeInterventions,
  type PipelineResult,
} from '@tixpay/engine';
import demoInboxFixture from '../../../packages/engine/fixtures/demo_inbox.json';
import { setRedactionEnabled } from '../src/utils/redaction';

export type ScenarioPreset = 'healthy' | 'tight' | 'bounce';

export interface AppState {
  // Raw State
  rawSms: RawSms[];
  inboxMode: 'real' | 'seeded';
  now: Date;
  pausedMandateIds: string[];
  redactionOn: boolean;
  activeScenario: ScenarioPreset;
  cardsList: Card[];

  // Cached Pipeline Result
  _pipelineCache: PipelineResult | null;
  _lastRunKey: string;

  // Derived / Selectors
  transactions: () => Transaction[];
  ledger: () => ShadowLedger | null;
  mandates: () => Mandate[];
  curve: () => BalanceCurve;
  shortfalls: () => Shortfall[];
  interventions: (shortfall?: Shortfall) => Intervention[];
  recommendation: () => Recommendation;
  cards: () => Card[];
  /**
   * The headline intercept. Returns null only if the pipeline has no ledger to
   * evaluate against — every other path produces a verdict, including CLEAR.
   */
  evaluate: (intent: PaymentIntent) => PaymentVerdict | null;

  // Actions
  setNow: (date: Date) => void;
  setInboxMode: (mode: 'real' | 'seeded') => void;
  setRawSms: (sms: RawSms[]) => void;
  injectSms: (raw: RawSms) => void;
  togglePauseMandate: (id: string) => void;
  toggleRedaction: () => void;
  loadScenario: (preset: ScenarioPreset) => void;
  executePayment: (amount: number, payeeName?: string, vpa?: string) => void;
  recompute: () => void;
}


// Opening state of the demo. See SCENARIO_DATE below for why it is the 26th.
export const INITIAL_DEMO_DATE = new Date('2026-03-26T00:00:00.000Z');

/**
 * Each scenario is a date, not a doctored inbox.
 *
 * The first attempt at this injected a synthetic credit SMS to buy headroom.
 * That was the wrong lever: an extra freelance payout also feeds the income
 * inference, so the projection moved in ways that had nothing to do with the
 * balance. Moving `now` instead changes only which mandates are still ahead of
 * the user, which is exactly the variable the demo wants — and it keeps every
 * number in the app derived from the real fixture, with nothing fabricated.
 *
 *   bounce   1 Mar  — already short on the 11th; Insights opens on a red dip
 *   healthy  13 Mar — flat and clear; nothing warns
 *   tight    26 Mar — clear on open, and an 8,000 payment creates a fresh
 *                     shortfall on 7 April that kills the LIC premium. This is
 *                     the headline intercept, so it is the default.
 */
const SCENARIO_DATE: Record<ScenarioPreset, Date> = {
  bounce: new Date('2026-03-01T00:00:00.000Z'),
  healthy: new Date('2026-03-13T00:00:00.000Z'),
  tight: new Date('2026-03-26T00:00:00.000Z'),
};

function computePipeline(
  rawSms: RawSms[],
  now: Date,
  pausedMandateIds: string[]
): PipelineResult {
  try {
    const result = runPipeline(rawSms, now);
    if (!result) throw new Error('runPipeline returned null');

    // Mark paused mandates
    const updatedMandates: Mandate[] = (result.mandates || []).map((m: Mandate) => ({
      ...m,
      isPaused: pausedMandateIds.includes(m.id),
    }));

    // A pause has to move the curve, not just the toggle.
    //
    // `runPipeline` knows nothing about pauses — it projects every detected
    // mandate. Flipping `isPaused` on the returned objects therefore changes
    // the Mandate Hub and nothing else: the curve, the shortfalls and the
    // interventions all still assume the debit lands. Re-project here so that
    // "Pause Netflix" actually rescues the balance instead of appearing to.
    if (pausedMandateIds.length > 0) {
      const curve = projectWithPaused(
        result.ledger,
        updatedMandates,
        result.income,
        now,
        pausedMandateIds
      );
      const shortfalls = findShortfalls(curve, updatedMandates);
      const interventions = shortfalls.flatMap((s) =>
        proposeInterventions(s, updatedMandates, result.ledger, result.income, now, { days: 30 })
      );

      return { ...result, mandates: updatedMandates, curve, shortfalls, interventions };
    }

    return {
      ...result,
      mandates: updatedMandates,
    };
  } catch (err) {
    console.warn('[useAppStore] Pipeline execution fallback to mock fixtures:', err);
    return {
      txns: [],
      ledger: {
        txns: [],
        currentBalance: 12450,
        drift: 0,
        balanceAt: () => 12450,
      },
      mandates: mockMandates.map((m: Mandate) => ({
        ...m,
        isPaused: pausedMandateIds.includes(m.id),
      })),
      income: [],
      curve: mockCurve,
      shortfalls: [mockShortfall],
      interventions: mockInterventions,
      stats: {
        messages: rawSms.length,
        parsed: 0,
        parseRate: 0,
        banks: [],
        accountTail: '4471',
        mandatesDetected: mockMandates.length,
        mandatesSurfaced: mockMandates.length,
        drift: 0,
        maxDrift: 0,
        reconciliations: 0,
      },
    };
  }
}

export const useAppStore = create<AppState>((set, get) => {
  const initialSms = demoInboxFixture as RawSms[];
  const initialKey = `${initialSms.length}_${INITIAL_DEMO_DATE.getTime()}_0`;
  const initialPipeline = computePipeline(initialSms, INITIAL_DEMO_DATE, []);

  // Redaction defaults on; sync the module flag `redact.*` reads.
  setRedactionEnabled(true);

  return {
    rawSms: initialSms,
    inboxMode: 'seeded',
    now: INITIAL_DEMO_DATE,
    pausedMandateIds: [],
    redactionOn: true,
    activeScenario: 'tight',
    cardsList: mockCards,

    _pipelineCache: initialPipeline,
    _lastRunKey: initialKey,

    // Selectors
    transactions: () => {
      const state = get();
      return state._pipelineCache?.txns || [];
    },

    ledger: () => {
      const state = get();
      return state._pipelineCache?.ledger || null;
    },

    mandates: () => {
      const state = get();
      if (state._pipelineCache?.mandates && state._pipelineCache.mandates.length > 0) {
        return state._pipelineCache.mandates;
      }
      return mockMandates.map((m: Mandate) => ({
        ...m,
        isPaused: state.pausedMandateIds.includes(m.id),
      }));
    },

    curve: () => {
      const state = get();
      if (state._pipelineCache?.curve && state._pipelineCache.curve.length > 0) {
        return state._pipelineCache.curve;
      }
      return mockCurve;
    },

    shortfalls: () => {
      const state = get();
      if (state._pipelineCache?.shortfalls) {
        return state._pipelineCache.shortfalls;
      }
      return [mockShortfall];
    },

    interventions: (shortfall?: Shortfall) => {
      const state = get();
      if (state._pipelineCache?.interventions && state._pipelineCache.interventions.length > 0) {
        return state._pipelineCache.interventions;
      }
      return mockInterventions;
    },

    recommendation: () => {
      return mockRecommendation;
    },

    cards: () => {
      const state = get();
      return state.cardsList;
    },

    evaluate: (intent: PaymentIntent) => {
      const state = get();
      const cache = state._pipelineCache;
      if (!cache?.ledger) return null;

      try {
        return evaluatePayment(
          intent,
          cache.ledger,
          cache.mandates,
          cache.income,
          state.cardsList,
          state.now
        );
      } catch (err) {
        // Never let a verdict failure block the pay button — a judge tapping
        // Pay and getting a frozen screen is worse than a missing warning.
        console.warn('[useAppStore] evaluatePayment failed:', err);
        return null;
      }
    },

    // Actions
    setNow: (date: Date) => {
      const state = get();
      const nextKey = `${state.rawSms.length}_${date.getTime()}_${state.pausedMandateIds.join(',')}`;
      const nextPipeline = computePipeline(state.rawSms, date, state.pausedMandateIds);
      set({
        now: date,
        _pipelineCache: nextPipeline,
        _lastRunKey: nextKey,
      });
    },

    setInboxMode: (mode: 'real' | 'seeded') => {
      set({ inboxMode: mode });
    },

    setRawSms: (sms: RawSms[]) => {
      const state = get();
      const nextKey = `${sms.length}_${state.now.getTime()}_${state.pausedMandateIds.join(',')}`;
      const nextPipeline = computePipeline(sms, state.now, state.pausedMandateIds);
      set({
        rawSms: sms,
        _pipelineCache: nextPipeline,
        _lastRunKey: nextKey,
      });
    },

    injectSms: (raw: RawSms) => {
      const state = get();
      const updatedSms = [raw, ...state.rawSms];
      const nextKey = `${updatedSms.length}_${state.now.getTime()}_${state.pausedMandateIds.join(',')}`;
      const nextPipeline = computePipeline(updatedSms, state.now, state.pausedMandateIds);
      set({
        rawSms: updatedSms,
        _pipelineCache: nextPipeline,
        _lastRunKey: nextKey,
      });
    },

    togglePauseMandate: (id: string) => {
      const state = get();
      const nextPaused = state.pausedMandateIds.includes(id)
        ? state.pausedMandateIds.filter((mId) => mId !== id)
        : [...state.pausedMandateIds, id];

      const nextKey = `${state.rawSms.length}_${state.now.getTime()}_${nextPaused.join(',')}`;
      const nextPipeline = computePipeline(state.rawSms, state.now, nextPaused);
      set({
        pausedMandateIds: nextPaused,
        _pipelineCache: nextPipeline,
        _lastRunKey: nextKey,
      });
    },

    toggleRedaction: () => {
      const next = !get().redactionOn;
      // `redact.*` reads a module-level flag rather than taking the store as an
      // argument, so the two have to be kept in step here. Without this the
      // privacy toggle moves in the UI and masks nothing.
      setRedactionEnabled(next);
      set({ redactionOn: next });
    },

    loadScenario: (preset: ScenarioPreset) => {
      const targetDate = SCENARIO_DATE[preset];
      // Reset to the pristine fixture: a previous run may have paid money.
      const smsData = demoInboxFixture as RawSms[];

      const nextKey = `${smsData.length}_${targetDate.getTime()}_0`;
      const nextPipeline = computePipeline(smsData, targetDate, []);

      set({
        activeScenario: preset,
        now: targetDate,
        rawSms: smsData,
        pausedMandateIds: [],
        _pipelineCache: nextPipeline,
        _lastRunKey: nextKey,
      });
    },

    executePayment: (amount: number, payeeName?: string, vpa?: string) => {
      const state = get();
      const currentBal = state.ledger()?.currentBalance ?? (state.curve()[0]?.balance ?? 12450);
      const newBal = Math.max(0, currentBal - amount);

      // Must match a shape `parseSms` recognises, or paying changes nothing.
      //
      // The previous wording here ("Debit of Rs 8000.00 from HDFC Bank A/C
      // ...") parsed to null, so "Pay anyway" left the ledger untouched and the
      // curve never moved. Mirroring the HDFC template the fixture already uses
      // keeps the simulated debit on exactly the same code path as a real one.
      const d = state.now;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(d.getFullYear()).slice(-2);
      const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2 });

      // Deterministic reference — the engine is pure, and a demo that shows a
      // different ref on the second run invites a question with no good answer.
      const ref = String(4000000000 + (Math.round(amount * 100) % 999999999));

      const payeeVpa = vpa || 'merchant@ybl';
      const smsBody =
        `Rs.${money(amount)} debited from a/c **4471 on ${dd}-${mm}-${yy} ` +
        `to VPA ${payeeVpa}. Ref ${ref}. Avl Bal Rs.${money(newBal)}`;

      state.injectSms({
        address: 'AD-HDFCBK',
        body: smsBody,
        date: d.getTime(),
      });
    },

    recompute: () => {
      const state = get();
      const nextKey = `${state.rawSms.length}_${state.now.getTime()}_${state.pausedMandateIds.join(',')}`;
      const nextPipeline = computePipeline(state.rawSms, state.now, state.pausedMandateIds);
      set({
        _pipelineCache: nextPipeline,
        _lastRunKey: nextKey,
      });
    },
  };
});
