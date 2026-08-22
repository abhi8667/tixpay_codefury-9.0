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
} from '@tixpay/types';
import {
  mockMandates,
  mockCurve,
  mockShortfall,
  mockInterventions,
  mockRecommendation,
  mockCards,
} from '@tixpay/types/mocks';
import { runPipeline, type PipelineResult } from '@tixpay/engine';
import demoInboxFixture from '../../../packages/engine/fixtures/demo_inbox.json';

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


// Initial demo reference date: March 1, 2026
export const INITIAL_DEMO_DATE = new Date('2026-03-01T00:00:00.000Z');

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

  return {
    rawSms: initialSms,
    inboxMode: 'seeded',
    now: INITIAL_DEMO_DATE,
    pausedMandateIds: [],
    redactionOn: true,
    activeScenario: 'bounce',
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
      set((state) => ({ redactionOn: !state.redactionOn }));
    },

    loadScenario: (preset: ScenarioPreset) => {
      const targetDate = new Date('2026-03-01T00:00:00.000Z');
      let smsData = demoInboxFixture as RawSms[];

      if (preset === 'healthy') {
        // Filter out heavy debits near March 12 to show healthy curve
        smsData = (demoInboxFixture as RawSms[]).filter(
          (s) => !s.body.includes('5,000') && !s.body.includes('BESCOM')
        );
      } else if (preset === 'tight') {
        smsData = demoInboxFixture as RawSms[];
      } else {
        // 'bounce'
        smsData = demoInboxFixture as RawSms[];
      }

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
      const day = String(state.now.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthStr = months[state.now.getMonth()];
      const yr = String(state.now.getFullYear()).slice(-2);
      const dateStr = `${day}-${monthStr}-${yr}`;
      const merchantStr = payeeName || 'Tarun Aadhithya';
      const smsBody = `Debit of Rs ${amount}.00 from HDFC Bank A/C **4471 on ${dateStr}. Info: UPI/${merchantStr}. Avail Bal: Rs ${newBal}.00`;
      const newSms: RawSms = {
        address: 'AD-HDFCBK',
        body: smsBody,
        date: state.now.getTime(),
      };
      state.injectSms(newSms);
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
