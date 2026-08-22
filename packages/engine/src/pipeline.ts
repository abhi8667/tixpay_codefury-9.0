import type {
  BalanceCurve, IncomeEvent, Intervention, Mandate, ShadowLedger, Shortfall, Transaction,
} from './types';
import { parseStatementCsv, type StatementMeta, type StatementParseOptions } from './parse/statement';
import { detectMandates } from './detect/mandates';
import { buildLedger, type BuildLedgerOptions } from './project/ledger';
import { inferIncomeEvents } from './project/income';
import { MIN_PROJECT_CONFIDENCE, projectBalance, type ProjectOptions } from './project/curve';
import { findShortfalls, proposeInterventions } from './guard';

/**
 * The single entry point.
 *
 * The store calls this and binds the result into Zustand. Everything downstream —
 * Mandate Hub, Cash-Flow Calendar, Home alert strip — reads off one object, so
 * integration is one selector rather than five call sites that can disagree
 * about which `now` they were given.
 *
 * Source-agnostic by design: it takes transactions, not a file. Ingestion is a
 * single adapter at the edge (`parseStatementCsv`), so the analytical core has
 * no idea where the rows came from and never changes when a new import format
 * is added.
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
  /** Transactions handed in, before account scoping. */
  messages: number;
  /** Transactions on the reconciled account. */
  parsed: number;
  /** parsed / messages — the share of the file belonging to this account. */
  parseRate: number;
  /** Distinct banks seen. */
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

/** Transactions → everything the app renders. */
export function runPipeline(
  txns: Transaction[],
  now: Date,
  options: PipelineOptions = {},
): PipelineResult {
  const days = options.days ?? 30;
  const minConfidence = options.minMandateConfidence ?? MIN_PROJECT_CONFIDENCE;

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
    // Pass the curve length so every resultingCurve matches what A is rendering.
    proposeInterventions(s, mandates, ledger, income, now, { days })
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
      messages: txns.length,
      parsed: ledger.txns.length,
      parseRate: txns.length ? Math.round((ledger.txns.length / txns.length) * 1000) / 1000 : 0,
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

// ─── Statement convenience path ──────────────────────────────────────────────

export interface StatementPipelineResult extends PipelineResult {
  meta: StatementMeta;
}

/**
 * Statement file → everything the app renders.
 *
 * The path the import screen uses: one call from picked file to rendered curve.
 * `meta` carries the import receipt — rows read, columns bound, rows skipped —
 * which the UI shows so the user can check our work instead of trusting it.
 */
export function runPipelineFromStatement(
  csv: string,
  now: Date,
  options: PipelineOptions & StatementParseOptions = {},
): StatementPipelineResult {
  const parseOptions: StatementParseOptions = {};
  if (options.bank) parseOptions.bank = options.bank;
  if (options.accountTail) parseOptions.accountTail = options.accountTail;

  const { txns, meta } = parseStatementCsv(csv, parseOptions);
  return { ...runPipeline(txns, now, options), meta };
}
