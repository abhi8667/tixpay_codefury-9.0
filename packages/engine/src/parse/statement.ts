import type { BankCode, Transaction } from '../types';
import { parseCsv, detectDelimiter } from './csv';
import { fromIstParts } from '../time';
import { round2 } from '../money';

/**
 * Bank statement (CSV) → Transaction[].
 *
 * This is the only ingestion path in the product. The user picks one exported
 * statement file; we never hold a standing permission over anything.
 *
 * A statement is strictly better input than a transaction notification. It is
 * complete — every debit, not only the ones that happened to trigger an alert —
 * and it states a running balance on every single row, which is why the shadow
 * ledger reconciles to zero drift here instead of to a bounded estimate.
 *
 * Everything below is pure. No I/O, no `new Date()`, no throwing: a file we
 * cannot read produces zero transactions and a populated `errors` list, because
 * a parser that throws on row 4,000 of someone's statement is a parser that
 * loses the whole file.
 */

// ─── Column vocabulary ───────────────────────────────────────────────────────

/**
 * Header aliases, most-specific first.
 *
 * Order matters. 'Value Dt' and 'Date' both appear in an HDFC export and mean
 * different things — the transaction date is the one that drives the ledger, so
 * the posting-date aliases must win before the value-date fallback is reached.
 */
const COLUMN_ALIASES = {
  date: [
    'transaction date', 'txn date', 'tran date', 'date of transaction',
    'posting date', 'post date', 'date',
    // Fallback: only matched if nothing above is present.
    'value date', 'value dt',
  ],
  narration: [
    'narration', 'description', 'particulars', 'transaction remarks',
    'transaction description', 'remarks', 'details', 'transaction particulars',
  ],
  ref: [
    'chq ref no', 'chq no ref no', 'ref no', 'reference no', 'reference number',
    'cheque no', 'chq no', 'utr', 'utr no', 'transaction id', 'ref',
  ],
  debit: [
    'withdrawal amt', 'withdrawal amount', 'withdrawal', 'debit amount',
    'debit amt', 'debit', 'paid out', 'dr', 'dr amount', 'withdrawals',
  ],
  credit: [
    'deposit amt', 'deposit amount', 'deposit', 'credit amount',
    'credit amt', 'credit', 'paid in', 'cr', 'cr amount', 'deposits',
  ],
  balance: [
    'closing balance', 'running balance', 'available balance', 'balance amount',
    'balance', 'bal',
  ],
  /** Single-amount layouts pair these two instead of debit/credit columns. */
  amount: ['transaction amount', 'amount'],
  type: ['dr cr', 'drcr', 'cr dr', 'transaction type', 'debit credit', 'type'],
} as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;

/** Lowercase, strip punctuation, collapse whitespace. The header comparison key. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export interface ColumnMap {
  date: number;
  narration: number;
  ref: number;
  debit: number;
  credit: number;
  balance: number;
  amount: number;
  type: number;
}

const NO_COLUMN = -1;

/**
 * Map a header row to column indices.
 *
 * Returns null when the row does not look like a header at all, which is how
 * `findHeaderRow` walks past the account-summary preamble every Indian bank
 * puts above the actual table.
 */
export function mapColumns(header: string[]): ColumnMap | null {
  const cells = header.map(norm);
  const map: ColumnMap = {
    date: NO_COLUMN, narration: NO_COLUMN, ref: NO_COLUMN, debit: NO_COLUMN,
    credit: NO_COLUMN, balance: NO_COLUMN, amount: NO_COLUMN, type: NO_COLUMN,
  };

  const taken = new Set<number>();
  const keys = Object.keys(COLUMN_ALIASES) as ColumnKey[];

  /**
   * Two passes: every exact match is bound before any fuzzy one is considered.
   *
   * A single pass in key order lets a loose alias steal a column that a later
   * key would have matched exactly. The case that bit: a 'Dr/Cr' type column
   * normalises to 'dr cr', and the `debit` alias 'dr' matches it by substring —
   * so the direction column got bound as the debit amount, every row read as a
   * credit, and the balance ran the wrong way with nothing throwing.
   *
   * Aliases of three characters or fewer are exact-only for the same reason:
   * 'dr' and 'cr' are too short to be safe as substrings of anything.
   */
  const bind = (key: ColumnKey, match: (cell: string, alias: string) => boolean) => {
    if (map[key] !== NO_COLUMN) return;
    for (const alias of COLUMN_ALIASES[key]) {
      const idx = cells.findIndex((c, i) => !taken.has(i) && match(c, alias));
      if (idx !== NO_COLUMN) {
        map[key] = idx;
        taken.add(idx);
        return;
      }
    }
  };

  for (const key of keys) bind(key, (c, alias) => c === alias);
  for (const key of keys) {
    bind(key, (c, alias) => alias.length > 3 && c.includes(alias));
  }

  // A header must carry a date and some way to read an amount.
  const hasAmount =
    (map.debit !== NO_COLUMN || map.credit !== NO_COLUMN) || map.amount !== NO_COLUMN;
  if (map.date === NO_COLUMN || !hasAmount) return null;

  return map;
}

/** Locate the header row, skipping any account-summary preamble. */
export function findHeaderRow(rows: string[][]): { index: number; columns: ColumnMap } | null {
  const limit = Math.min(rows.length, 40);
  for (let i = 0; i < limit; i++) {
    const columns = mapColumns(rows[i]!);
    if (columns) return { index: i, columns };
  }
  return null;
}

// ─── Field parsing ───────────────────────────────────────────────────────────

const MONTH_TOKENS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Statement date → the IST instant that day begins.
 *
 * Day-first throughout. Indian bank exports are dd/mm/yy without exception, and
 * guessing per-row is worse than committing: a file where row 1 reads 03/04 and
 * row 2 reads 15/04 would flip interpretation mid-statement and scatter the
 * mandate gaps.
 *
 * `minuteOffset` preserves the file's own row order for same-day transactions,
 * which is what makes the reconstructed running balance match the bank's.
 */
export function parseStatementDate(raw: string, minuteOffset = 0): Date | null {
  const s = raw.trim();
  if (!s) return null;

  let y: number | undefined;
  let m: number | undefined;
  let d: number | undefined;

  // ISO first: 2026-03-26
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  }

  // 26-Mar-2026 / 26 Mar 26
  if (y === undefined) {
    const named = s.match(/^(\d{1,2})[-/. ]([a-zA-Z]{3,9})[-/. ](\d{2,4})/);
    if (named) {
      const month = MONTH_TOKENS[named[2]!.toLowerCase().slice(0, 4)]
        ?? MONTH_TOKENS[named[2]!.toLowerCase().slice(0, 3)];
      if (month) {
        d = Number(named[1]);
        m = month;
        y = Number(named[3]);
      }
    }
  }

  // 26/03/2026 / 26-03-26
  if (y === undefined) {
    const numeric = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (numeric) {
      d = Number(numeric[1]);
      m = Number(numeric[2]);
      y = Number(numeric[3]);
    }
  }

  if (y === undefined || m === undefined || d === undefined) return null;

  // Two-digit years: 70 is the usual pivot, and no bank statement predates it.
  if (y < 100) y += y < 70 ? 2000 : 1900;

  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  return fromIstParts(y, m, d, 0, minuteOffset);
}

/**
 * Statement amount → rupees, or null.
 *
 * Handles lakh grouping, currency symbols, a trailing Dr/Cr marker, and the
 * parenthesised negatives some exports use. Returns null for the empty cell and
 * for the literal zeros banks write in the column that does not apply.
 */
export function parseStatementAmount(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/-\s*$/.test(s)) {
    // Trailing minus: '1,200.00-'
    negative = true;
    s = s.replace(/-\s*$/, '');
  }

  s = s
    .replace(/(?:inr|rs\.?|₹)/gi, '')
    .replace(/\b(?:dr|cr)\b\.?/gi, '')
    .replace(/,/g, '')
    .trim();

  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1).trim();
  }

  if (!/^\d+(?:\.\d{1,4})?$/.test(s)) return null;

  const value = Number(s);
  if (!Number.isFinite(value)) return null;

  return negative ? -round2(value) : round2(value);
}

// ─── Counterparty extraction ─────────────────────────────────────────────────

/**
 * The structured UPI narration several banks (ICICI notably) write:
 *
 *   UPI/Dominos Pi/dominospizzaon/UPI/YES BANK L/614226137716/PYTM6052...
 *   └f0┘└──f1────┘└─────f2─────┘└f3┘└───f4────┘└────f5─────┘└────f6───┘
 *
 * f1 is the counterparty's name, f2 the payment address — TRUNCATED to
 * fourteen characters, which is why it usually arrives without its `@handle`.
 * That truncation is the whole reason this parser exists: with no `@` to find,
 * the generic word-salad fallback below folds the PSP name and the remark into
 * the grouping key, so `UPI/JUSTVEND P/justvendprivat/payjustven/ICICI BANK/…`
 * and the same merchant with a one-character-shorter remark land in different
 * buckets. Forty-seven visits to one vending operator became two merchants and
 * zero recurrence.
 *
 * Returns undefined for anything that is not this shape, including the HDFC
 * layout (`UPI/DR/4123…/Swiggy/HDFC/swiggy.payu@hdfcbank`) — that one states a
 * real VPA and is handled by the field scan in `extractCounterparty`.
 */
export interface UpiNarration {
  /** Counterparty as the bank wrote it: 'Dominos Pi'. Verbatim, not cleaned. */
  payeeName: string;
  /** Payment address, possibly truncated and possibly missing its handle. */
  handle: string;
  /** The payer's own remark: 'UPI', 'Paid secur', 'NO REMARKS'. */
  remark?: string;
  /** The counterparty's PSP: 'YES BANK L'. */
  psp?: string;
}

/** f1 positions that are a rail marker rather than a counterparty name. */
const RAIL_FIELD = /^(?:dr|cr|d|c|p2m|p2a|\d+)$/i;

export function parseUpiNarration(narration: string): UpiNarration | undefined {
  if (!narration) return undefined;

  const fields = narration.split('/').map((f) => f.trim());
  if (fields.length < 4) return undefined;
  if (!/^upi$/i.test(fields[0]!)) return undefined;

  const payeeName = fields[1] ?? '';
  const handle = fields[2] ?? '';
  if (!payeeName || !handle) return undefined;
  // The HDFC layout puts a rail marker here and the VPA at the end.
  if (RAIL_FIELD.test(payeeName)) return undefined;
  // f2 must look like an address fragment, not a reference number.
  if (!/[a-z]/i.test(handle) || /\s/.test(handle)) return undefined;

  const out: UpiNarration = { payeeName, handle: handle.toLowerCase() };
  if (fields[3]) out.remark = fields[3];
  if (fields[4]) out.psp = fields[4];
  return out;
}

/**
 * A human-readable counterparty name, or undefined when the narration does not
 * carry one worth showing.
 *
 * Only the structured layout above is trusted here. Guessing a merchant name
 * out of free-form narration produces things like 'Ach D Lic Of', and a wrong
 * name on a screen that also states a rupee figure makes the figure look wrong
 * too.
 */
/**
 * Rails that write the counterparty into the second slash-delimited field.
 *
 * `VSI` is a Visa standing instruction — the shape a card-on-file subscription
 * takes on an Indian statement: `VSI/ANTHROPIC  /202607291919/6210…`. The rest
 * of that line is a reference number and a tax note, so the second field is the
 * only part worth showing.
 */
const NAMED_RAIL = /^(?:upi|vsi|nach|ach|ecs|si|imps|neft)$/i;

export function extractDisplayName(narration: string): string | undefined {
  let raw = parseUpiNarration(narration)?.payeeName;

  if (!raw) {
    const fields = narration.split('/').map((f) => f.trim());
    const candidate = fields[1];
    // Two fields is a rail and a reference, not a rail and a name.
    if (
      fields.length >= 3 &&
      NAMED_RAIL.test(fields[0] ?? '') &&
      candidate &&
      // Must read as a name: letters, and not a reference number.
      /^[a-z][a-z0-9 .&'-]{1,}$/i.test(candidate) &&
      !RAIL_FIELD.test(candidate)
    ) {
      raw = candidate;
    }
  }

  if (!raw) return undefined;
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length < 2) return undefined;
  // Bank exports are upper-case-heavy; title-case only when there is no
  // existing lower-case, so 'Dominos Pi' and 'iPhone' survive as written.
  const cased = /[a-z]/.test(name)
    ? name
    : name.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  return cased;
}

/** Rail prefixes and bookkeeping tokens that carry no merchant identity. */
const NOISE_TOKENS = new Set([
  'upi', 'ach', 'nach', 'ecs', 'neft', 'imps', 'rtgs', 'si', 'mmt', 'ift',
  'dr', 'cr', 'd', 'c', 'debit', 'credit', 'payment', 'pmt', 'txn', 'trf',
  'transfer', 'to', 'from', 'by', 'ref', 'no', 'inb', 'pos', 'mandate',
  'autopay', 'auto', 'debited', 'collect', 'p2m', 'p2a', 'bil', 'billpay',
]);

/**
 * The grouping key for a counterparty.
 *
 * Recurring-debit detection buckets by this, so it has to be stable across
 * months while staying distinct between merchants. Two cases:
 *
 *   1. The narration carries a real VPA — 'UPI-NETFLIX-netflix.rzp@icici-...'.
 *      Use it verbatim; `normalizeVpa` already strips gateway handles.
 *   2. It does not, which is the norm for the NACH and ECS rails that carry the
 *      EMIs and insurance premiums actually worth warning about. Synthesise a
 *      key from the merchant words, dropping rail prefixes and reference
 *      numbers so 'ACH D- LIC OF INDIA-M2401' and 'ACH D- LIC OF INDIA-M2402'
 *      land in the same bucket.
 */
export function extractCounterparty(narration: string): string | undefined {
  if (!narration) return undefined;

  // Split into fields BEFORE looking for a VPA.
  //
  // A narration is delimiter-separated — 'UPI-NETFLIX-netflix.rzp@icici-ICIC-4123'
  // — and '-' is legal inside a VPA local part. Running the VPA pattern over the
  // whole string therefore lets it walk backwards across the delimiters and
  // capture 'upi-netflix-netflix.rzp@icici', which carries the rail prefix into
  // the grouping key and out into the user-visible merchant name. Isolating the
  // field first is what keeps the key equal to the VPA the bank actually wrote.
  const fields = narration.split(/[-/|,;\s]+/).filter(Boolean);
  const field = fields.find((f) => VPA_FIELD.test(f));
  if (field) return field.replace(/[.,;:]+$/, '').toLowerCase();

  // Narrations that embed a VPA without clean delimiters still deserve a match;
  // the trailing-segment rule below undoes any prefix the pattern swallowed.
  const loose = narration.match(/([a-z0-9][a-z0-9._-]{1,}@[a-z][a-z0-9.-]{1,})/i);
  if (loose) {
    const [local, domain] = loose[1]!.toLowerCase().split('@') as [string, string];
    const segments = local.split('-').filter(Boolean);
    const tail = segments[segments.length - 1] ?? local;
    return `${tail}@${domain}`.replace(/[.,;:]+$/, '');
  }

  // Structured UPI layout with a truncated address: the handle field is a far
  // better key than anything the word fallback below can build, because it is
  // the only part of the narration that does not vary with the payer's remark.
  const structured = parseUpiNarration(narration);
  if (structured) return structured.handle;

  const words = narration
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    // Drop reference numbers and anything with a digit in it: those are the
    // per-occurrence tokens that would otherwise make every month its own key.
    .filter((w) => w.length > 1 && !/\d/.test(w) && !NOISE_TOKENS.has(w));

  if (words.length === 0) return undefined;

  // Cap the key so a verbose narration tail cannot fragment the bucket.
  return words.slice(0, 4).join('');
}

/** Narrations a bank writes when money did NOT move. */
/** A standalone narration field that is a payment address. */
const VPA_FIELD = /^[a-z0-9][a-z0-9._]*@[a-z][a-z0-9.]*$/i;

const FAILURE_PATTERN =
  /\b(?:return(?:ed|s)?|reversal|reversed|bounce[d]?|dishonou?r(?:ed)?|insufficient|failed|declined|rejected|unpaid)\b/i;

/** Rows that are bank bookkeeping rather than the user's spending. */
const NON_TRANSACTION_PATTERN =
  /\b(?:opening balance|closing balance|brought forward|carried forward|b\/f|c\/f|total|statement summary)\b/i;

// ─── Public API ──────────────────────────────────────────────────────────────

export interface StatementParseOptions {
  /** Overrides the bank inferred from the file preamble. */
  bank?: BankCode;
  /** Overrides the account tail inferred from the file preamble. */
  accountTail?: string;
}

export interface StatementMeta {
  bank: BankCode;
  accountTail: string | undefined;
  /** Data rows found below the header. */
  rows: number;
  /** Rows that produced a Transaction. */
  parsed: number;
  /** Rows skipped, with the reason. Surfaced in the import summary. */
  errors: string[];
  /** Which columns we bound, for the "we read these columns" import receipt. */
  columns: Record<string, string>;
  /** True when the file stated a balance on every parsed row. */
  hasRunningBalance: boolean;
}

export interface ParsedStatement {
  txns: Transaction[];
  meta: StatementMeta;
}

/** Bank name tokens as they appear in an export preamble. */
const BANK_TOKENS: Array<[RegExp, BankCode]> = [
  [/\bhdfc\b/i, 'HDFC'],
  [/\bstate bank|sbi\b/i, 'SBI'],
  [/\bicici\b/i, 'ICICI'],
  [/\bkotak\b/i, 'KOTAK'],
  [/\baxis\b/i, 'AXIS'],
  [/\bpunjab national|pnb\b/i, 'PNB'],
];

function inferBank(preamble: string): BankCode | undefined {
  for (const [pattern, code] of BANK_TOKENS) {
    if (pattern.test(preamble)) return code;
  }
  return undefined;
}

/**
 * Fall back to the export's own column vocabulary when the preamble is silent.
 *
 * ICICI's net-banking export names the account holder and the account number
 * and never once names the bank, so the import receipt read 'OTHER ••0050' on
 * a genuine ICICI statement. The transaction rows are no help: they are full
 * of *counterparty* banks — 'HDFC BANK', 'YES BANK L' — and matching on those
 * would confidently report the wrong bank, which is worse than reporting none.
 *
 * A bank's column headings, on the other hand, are its own. This matches the
 * layout, not the contents, and stays undefined unless the fingerprint is
 * distinctive.
 */
const HEADER_FINGERPRINTS: Array<[BankCode, string[]]> = [
  ['ICICI', ['transaction remarks', 'withdrawal amount', 'deposit amount']],
  ['HDFC', ['narration', 'withdrawal amt', 'deposit amt']],
  ['SBI', ['description', 'debit', 'credit', 'txn date']],
  ['AXIS', ['particulars', 'debit', 'credit', 'init br']],
];

function inferBankFromHeader(header: string[]): BankCode | undefined {
  const cells = header.map(norm);
  for (const [code, required] of HEADER_FINGERPRINTS) {
    if (required.every((r) => cells.some((c) => c.includes(r)))) return code;
  }
  return undefined;
}

/**
 * Account tail from the preamble.
 *
 * Matches a masked or full account number and keeps the last four digits —
 * the same identifier the ledger scopes on. We never retain the full number.
 */
function inferAccountTail(preamble: string): string | undefined {
  const labelled = preamble.match(
    /(?:account|a\/c|ac)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([xX*\d]{4,20})/i,
  );
  const token = labelled?.[1];
  if (!token) return undefined;
  const digits = token.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : undefined;
}

/**
 * Parse an exported bank statement.
 *
 * Never throws. Rows we cannot read are counted and reported rather than
 * dropped silently, because "we read 412 of 418 rows" is a claim the user can
 * check and "we read your statement" is not.
 */
export function parseStatementCsv(
  text: string,
  options: StatementParseOptions = {},
): ParsedStatement {
  const errors: string[] = [];
  const empty = (reason: string): ParsedStatement => {
    errors.push(reason);
    return {
      txns: [],
      meta: {
        bank: options.bank ?? 'OTHER',
        accountTail: options.accountTail,
        rows: 0,
        parsed: 0,
        errors,
        columns: {},
        hasRunningBalance: false,
      },
    };
  };

  if (!text || !text.trim()) return empty('The file is empty.');

  const rows = parseCsv(text, detectDelimiter(text));
  if (rows.length === 0) return empty('No readable rows in the file.');

  const header = findHeaderRow(rows);
  if (!header) {
    return empty(
      'Could not find a transaction table. Expected columns for date, description and amount.',
    );
  }

  // Everything above the header is the account summary; mine it for identity.
  const preamble = rows.slice(0, header.index).map((r) => r.join(' ')).join('\n');
  const bank =
    options.bank ?? inferBank(preamble) ?? inferBankFromHeader(rows[header.index]!) ?? 'OTHER';
  const accountTail = options.accountTail ?? inferAccountTail(preamble);

  const c = header.columns;
  const headerCells = rows[header.index]!;
  const columns: Record<string, string> = {};
  for (const [key, idx] of Object.entries(c)) {
    if (idx !== NO_COLUMN && headerCells[idx]) columns[key] = headerCells[idx]!;
  }

  const cell = (row: string[], idx: number): string =>
    idx === NO_COLUMN ? '' : (row[idx] ?? '');

  const txns: Transaction[] = [];
  const dataRows = rows.slice(header.index + 1);
  let balanceRows = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]!;
    const narration = cell(row, c.narration);

    if (NON_TRANSACTION_PATTERN.test(narration) && !cell(row, c.date)) continue;

    // Row order within a day is preserved as minutes so the ledger walk
    // reproduces the bank's own running balance. Capped well inside one day.
    const date = parseStatementDate(cell(row, c.date), Math.min(i, 1400));
    if (!date) {
      // A trailing legal disclaimer is not a broken row; only complain about
      // rows that carry an amount we are visibly failing to place.
      const looksFinancial =
        parseStatementAmount(cell(row, c.debit)) !== null ||
        parseStatementAmount(cell(row, c.credit)) !== null ||
        parseStatementAmount(cell(row, c.amount)) !== null;
      if (looksFinancial) errors.push(`Row ${i + 1}: unreadable date "${cell(row, c.date)}".`);
      continue;
    }

    let direction: 'DEBIT' | 'CREDIT' | null = null;
    let amount: number | null = null;

    const debit = parseStatementAmount(cell(row, c.debit));
    const credit = parseStatementAmount(cell(row, c.credit));

    if (debit !== null && debit !== 0) {
      direction = 'DEBIT';
      amount = Math.abs(debit);
    } else if (credit !== null && credit !== 0) {
      direction = 'CREDIT';
      amount = Math.abs(credit);
    } else if (c.amount !== NO_COLUMN) {
      // Single-amount layout: direction comes from a type column, or from the
      // sign when there is no type column.
      const single = parseStatementAmount(cell(row, c.amount));
      if (single !== null && single !== 0) {
        const type = norm(cell(row, c.type));
        if (type) {
          direction = /^(?:dr|debit|withdrawal|w)$/.test(type) ? 'DEBIT'
            : /^(?:cr|credit|deposit|d)$/.test(type) ? 'CREDIT'
            : single < 0 ? 'DEBIT' : 'CREDIT';
        } else {
          direction = single < 0 ? 'DEBIT' : 'CREDIT';
        }
        amount = Math.abs(single);
      }
    }

    if (direction === null || amount === null || amount <= 0) continue;

    const balanceHint = parseStatementAmount(cell(row, c.balance));
    if (balanceHint !== null) balanceRows += 1;

    const isFailure = FAILURE_PATTERN.test(narration);
    const vpa = extractCounterparty(narration);
    const refNo = cell(row, c.ref).replace(/^0+$/, '') || undefined;

    const txn: Transaction = {
      // Row index keeps the id unique: a statement legitimately carries two
      // identical debits on one day, and collapsing them loses a real payment.
      id: `stmt_${date.getTime()}_${i}_${Math.round(amount * 100)}`,
      direction,
      amount,
      bank,
      timestamp: date,
      isFailure,
      source: 'STATEMENT',
    };

    if (vpa) txn.vpa = vpa;
    if (narration) txn.merchantHint = narration;
    const merchantName = extractDisplayName(narration);
    if (merchantName) txn.merchantName = merchantName;
    if (accountTail) txn.accountTail = accountTail;
    if (balanceHint !== null) txn.balanceHint = balanceHint;
    if (refNo) txn.refNo = refNo;

    txns.push(txn);
  }

  if (txns.length === 0 && errors.length === 0) {
    errors.push('Found a transaction table, but no rows with a readable amount.');
  }

  return {
    txns,
    meta: {
      bank,
      accountTail,
      rows: dataRows.length,
      parsed: txns.length,
      errors,
      columns,
      hasRunningBalance: txns.length > 0 && balanceRows === txns.length,
    },
  };
}
