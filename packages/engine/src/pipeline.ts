import type {
  BalanceCurve, IncomeEvent, Intervention, Mandate, RawSms, ShadowLedger, Shortfall, Transaction,
} from './types';
import { parseSms } from './parse/sms';
import { detectMandates } from './detect/mandates';
import { buildLedger, type BuildLedgerOptions } from './project/ledger';
import { inferIncomeEvents } from './project/income';
import { MIN_PROJECT_CONFIDENCE, projectBalance, type ProjectOptions } from './project/curve';
import { findShortfalls, proposeInterventions } from './guard';

/**
 * The single entry point.
 *
 * Person C calls this and binds the result into Zustand. Everything downstream —
 * Mandate Hub, Cash-Flow Calendar, Home alert strip — reads off one object, so
 * integration is one selector rather than five call sites that can disagree
 * about which `now` they were given.
 *
 * Pure. Takes `now`; the World Clock moves the whole world by passing a
 * different one.
 */

export interface PipelineOptions extends ProjectOptions, BuildLedgerOptions {
  /** Projection window. Defaults to 30 days. */
  days?: number;
  /**
   * Confidence floor for mandates surfaced in the Mandate Hub. Defaults to the
   * projection floor so the Hub and the curve tell the same story — a mandate
   * the user can see but the curve ignores is a support ticket on stage.
   */
  minMandateConfidence?: number;
}

export interface PipelineStats {
  /** Messages handed in. */
  messages: number;
  /** Messages that produced a Transaction. */
  parsed: number;
  /** parsed / messages. Includes noise, so this is a floor, not the parse rate. */
  parseRate: number;
  /** Distinct bank entity codes seen. */
  banks: string[];
  /** The account the ledger reconciles. */
  accountTail: string | undefined;
  /** Mandates found before the confidence floor was applied. */
  mandatesDetected: number;
  /** Mandates that survived it. */
  mandatesSurfaced: number;
  /** How close the shadow ledger tracks the bank's stated balance. */
  drift: number;
  maxDrift: number;
  reconciliations: number;
}

export interface PipelineResult {
  txns: Transaction[];
  ledger: ShadowLedger;
  mandates: Mandate[];
  income: IncomeEvent[];
  curve: BalanceCurve;
  shortfalls: Shortfall[];
  interventions: Intervention[];
  stats: PipelineStats;
}

/** SMS inbox → everything the app renders. */
export function runPipeline(
  inbox: RawSms[],
  now: Date,
  options: PipelineOptions = {},
): PipelineResult {
  const days = options.days ?? 30;
  const minConfidence = options.minMandateConfidence ?? MIN_PROJECT_CONFIDENCE;

  const txns: Transaction[] = [];
  for (const raw of inbox) {
    const t = parseSms(raw);
    if (t) txns.push(t);
  }

  const ledgerOptions: BuildLedgerOptions = {};
  if (options.accountTail) ledgerOptions.accountTail = options.accountTail;
  const ledger = buildLedger(txns, ledgerOptions);

  // Mandates and income are read off the reconciled account only. Detecting a
  // mandate on a second account and then projecting it against this account's
  // balance produces a shortfall that does not exist.
  const scoped = ledger.txns;

  const detected = detectMandates(scoped, now);
  const mandates = detected.filter((m) => m.confidence >= minConfidence);
  const income = inferIncomeEvents(scoped, now, { days });

  const projectOptions: ProjectOptions = { minMandateConfidence: minConfidence };
  if (options.minIncomeConfidence !== undefined) {
    projectOptions.minIncomeConfidence = options.minIncomeConfidence;
  }
  const curve = projectBalance(ledger, mandates, income, now, days, projectOptions);

  const shortfalls = findShortfalls(curve, mandates);
  const interventions = shortfalls.flatMap((s) =>
    proposeInterventions(s, mandates, ledger, income, now)
  );

  const banks = [...new Set(txns.map((t) => t.bank))].sort();

  return {
    txns,
    ledger,
    mandates,
    income,
    curve,
    shortfalls,
    interventions,
    stats: {
      messages: inbox.length,
      parsed: txns.length,
      parseRate: inbox.length ? Math.round((txns.length / inbox.length) * 1000) / 1000 : 0,
      banks,
      accountTail: ledger.accountTail,
      mandatesDetected: detected.length,
      mandatesSurfaced: mandates.length,
      drift: ledger.drift,
      maxDrift: ledger.maxDrift ?? 0,
      reconciliations: ledger.reconciliations ?? 0,
    },
  };
}
