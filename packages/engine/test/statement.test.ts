import { describe, it, expect } from 'vitest';
import { parseCsv, detectDelimiter } from '../src/parse/csv';
import {
  parseStatementCsv,
  parseStatementDate,
  parseStatementAmount,
  extractCounterparty,
  mapColumns,
  findHeaderRow,
} from '../src/parse/statement';
import { istDayKey } from '../src/time';

/**
 * The ingestion layer.
 *
 * This is the only path by which anything enters the app, so it carries the
 * whole product's blast radius: a column bound to the wrong index does not
 * throw, it silently produces a confident wrong balance. These cases are drawn
 * from the export layouts of the six banks the demo targets.
 */

// ─── CSV tokeniser ───────────────────────────────────────────────────────────

describe('parseCsv', () => {
  it('splits a plain grid', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('keeps commas inside a quoted narration', () => {
    const rows = parseCsv('Date,Narration\n01/04/26,"UPI-SWIGGY, BANGALORE-swiggy@ybl"');
    expect(rows[1]![1]).toBe('UPI-SWIGGY, BANGALORE-swiggy@ybl');
  });

  it('unescapes a doubled quote', () => {
    expect(parseCsv('a\n"say ""hi"""')[1]![0]).toBe('say "hi"');
  });

  it('handles CRLF, bare CR, and a missing trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2\r3,4')).toEqual([['a', 'b'], ['1', '2'], ['3', '4']]);
  });

  it('strips a UTF-8 BOM so the first header cell still matches', () => {
    expect(parseCsv('﻿Date,Narration')[0]![0]).toBe('Date');
  });

  it('drops blank padding rows', () => {
    expect(parseCsv('a,b\n\n\n1,2\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('never throws on an unterminated quote', () => {
    expect(() => parseCsv('a,b\n"unterminated,2')).not.toThrow();
  });
});

describe('detectDelimiter', () => {
  it('finds commas, tabs and semicolons', () => {
    expect(detectDelimiter('Date,Narration,Amount\n1,2,3\n4,5,6')).toBe(',');
    expect(detectDelimiter('Date\tNarration\tAmount\n1\t2\t3\n4\t5\t6')).toBe('\t');
    expect(detectDelimiter('Date;Narration;Amount\n1;2;3\n4;5;6')).toBe(';');
  });

  it('is not fooled by one stray semicolon in a comma file', () => {
    expect(detectDelimiter('Date,Narration,Amt\n01/04/26,a;b,100\n02/04/26,c,200')).toBe(',');
  });
});

// ─── Header binding ──────────────────────────────────────────────────────────

describe('mapColumns', () => {
  it('binds an HDFC layout', () => {
    const m = mapColumns([
      'Date', 'Narration', 'Chq./Ref.No.', 'Value Dt',
      'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance',
    ])!;
    expect(m.date).toBe(0);
    expect(m.narration).toBe(1);
    expect(m.debit).toBe(4);
    expect(m.credit).toBe(5);
    expect(m.balance).toBe(6);
  });

  it('binds an ICICI layout', () => {
    const m = mapColumns([
      'Transaction Date', 'Transaction Remarks', 'Withdrawal Amount (INR)',
      'Deposit Amount (INR)', 'Balance (INR)',
    ])!;
    expect(m.date).toBe(0);
    expect(m.narration).toBe(1);
    expect(m.debit).toBe(2);
    expect(m.credit).toBe(3);
    expect(m.balance).toBe(4);
  });

  it('binds an SBI layout', () => {
    const m = mapColumns(['Txn Date', 'Description', 'Debit', 'Credit', 'Balance'])!;
    expect(m.date).toBe(0);
    expect(m.debit).toBe(2);
    expect(m.credit).toBe(3);
  });

  it('binds a single-amount layout', () => {
    const m = mapColumns(['Date', 'Particulars', 'Amount', 'Dr/Cr', 'Balance'])!;
    expect(m.amount).toBe(2);
    expect(m.type).toBe(3);
  });

  it('prefers the transaction date over the value date', () => {
    const m = mapColumns(['Value Dt', 'Txn Date', 'Narration', 'Debit', 'Balance'])!;
    expect(m.date).toBe(1);
  });

  it('does not let one column be claimed twice', () => {
    const m = mapColumns(['Date', 'Narration', 'Debit', 'Credit', 'Closing Balance'])!;
    const bound = [m.date, m.narration, m.debit, m.credit, m.balance];
    expect(new Set(bound).size).toBe(bound.length);
  });

  it('rejects a row that is not a header', () => {
    expect(mapColumns(['HDFC BANK LIMITED', '', ''])).toBeNull();
    expect(mapColumns(['Account No', 'XXXXXXXX4471'])).toBeNull();
  });
});

describe('findHeaderRow', () => {
  it('walks past the account-summary preamble', () => {
    const rows = [
      ['HDFC BANK LIMITED - STATEMENT OF ACCOUNT'],
      ['Account No :', 'XXXXXXXX4471'],
      [''],
      ['Date', 'Narration', 'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance'],
      ['01/04/26', 'UPI-X', '100.00', '0.00', '900.00'],
    ];
    expect(findHeaderRow(rows)!.index).toBe(3);
  });

  it('returns null when there is no table at all', () => {
    expect(findHeaderRow([['just'], ['some'], ['prose']])).toBeNull();
  });
});

// ─── Dates ───────────────────────────────────────────────────────────────────

describe('parseStatementDate', () => {
  it('reads every format the six banks export', () => {
    const cases = ['26/03/26', '26/03/2026', '26-03-2026', '26.03.2026', '26-Mar-2026', '26 Mar 26', '2026-03-26'];
    for (const c of cases) {
      expect(istDayKey(parseStatementDate(c)!), c).toBe('2026-03-26');
    }
  });

  it('is day-first, not month-first', () => {
    // 03/04 is 3 April in every Indian bank export, never 4 March.
    expect(istDayKey(parseStatementDate('03/04/26')!)).toBe('2026-04-03');
  });

  it('pivots a two-digit year at 70', () => {
    expect(istDayKey(parseStatementDate('01/01/69')!)).toBe('2069-01-01');
    expect(istDayKey(parseStatementDate('01/01/70')!)).toBe('1970-01-01');
  });

  it('preserves same-day row order through the minute offset', () => {
    const first = parseStatementDate('26/03/26', 0)!;
    const second = parseStatementDate('26/03/26', 1)!;
    expect(second.getTime()).toBeGreaterThan(first.getTime());
    // …without spilling into the next IST day, which would move a mandate.
    expect(istDayKey(second)).toBe('2026-03-26');
    expect(istDayKey(parseStatementDate('26/03/26', 1400)!)).toBe('2026-03-26');
  });

  it('returns null rather than an Invalid Date', () => {
    for (const bad of ['', '  ', 'Date', 'N/A', '99/99/9999', 'total']) {
      expect(parseStatementDate(bad), bad).toBeNull();
    }
  });
});

// ─── Amounts ─────────────────────────────────────────────────────────────────

describe('parseStatementAmount', () => {
  it('reads lakh grouping and currency noise', () => {
    expect(parseStatementAmount('1,25,000.00')).toBe(125000);
    expect(parseStatementAmount('INR 8,000.50')).toBe(8000.5);
    expect(parseStatementAmount('Rs. 649')).toBe(649);
    expect(parseStatementAmount('₹1,899.00')).toBe(1899);
  });

  it('reads the negative conventions', () => {
    expect(parseStatementAmount('(1,200.00)')).toBe(-1200);
    expect(parseStatementAmount('1,200.00-')).toBe(-1200);
    expect(parseStatementAmount('-1200')).toBe(-1200);
  });

  it('strips a trailing Dr/Cr marker', () => {
    expect(parseStatementAmount('5,000.00 Dr')).toBe(5000);
    expect(parseStatementAmount('5,000.00 Cr')).toBe(5000);
  });

  it('returns null for empty and non-numeric cells', () => {
    for (const bad of ['', '  ', '-', 'N/A', 'abc']) {
      expect(parseStatementAmount(bad), bad).toBeNull();
    }
  });
});

// ─── Counterparty ────────────────────────────────────────────────────────────

describe('extractCounterparty', () => {
  it('takes the VPA field, not the rail prefix around it', () => {
    // Regression: a permissive pattern run over the whole narration walks
    // backwards across the hyphens and returns 'upi-netflix-netflix.rzp@icici',
    // which carries the rail into the grouping key and the merchant name.
    expect(extractCounterparty('UPI-NETFLIX-netflix.rzp@icici-ICIC-412345678901'))
      .toBe('netflix.rzp@icici');
    expect(extractCounterparty('UPI-VPA-bajajfinserv.emi@kotak-KOTAK-99912345'))
      .toBe('bajajfinserv.emi@kotak');
  });

  it('reads a slash-delimited narration', () => {
    expect(extractCounterparty('UPI/DR/412345678901/Swiggy/HDFC/swiggy.payu@hdfcbank'))
      .toBe('swiggy.payu@hdfcbank');
  });

  it('synthesises a stable key for the NACH and ECS rails', () => {
    // These carry the EMIs and premiums worth warning about, and never a VPA.
    const a = extractCounterparty('ACH D- LIC OF INDIA-M2401');
    const b = extractCounterparty('ACH D- LIC OF INDIA-M2402');
    expect(a).toBe(b);
    expect(a).toContain('lic');
  });

  it('drops rail prefixes and reference numbers from a synthesised key', () => {
    const key = extractCounterparty('NACH DR-BAJAJ FINANCE LTD-4412998877')!;
    expect(key).not.toContain('nach');
    expect(key).not.toContain('dr');
    expect(key).not.toMatch(/\d/);
  });

  it('gives different merchants different keys', () => {
    expect(extractCounterparty('ACH D- LIC OF INDIA-M1'))
      .not.toBe(extractCounterparty('ACH D- BAJAJ FINANCE-M1'));
  });

  it('returns undefined for a narration with nothing in it', () => {
    expect(extractCounterparty('')).toBeUndefined();
    expect(extractCounterparty('UPI DR 4412')).toBeUndefined();
  });
});

// ─── Whole-file parsing ──────────────────────────────────────────────────────

const HDFC = [
  'HDFC BANK LIMITED - STATEMENT OF ACCOUNT',
  'Account No :,XXXXXXXX4471',
  'Statement Period :,01/03/26 to 31/03/26',
  '',
  'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance',
  '05/03/26,"UPI-NETFLIX-netflix.rzp@icici-ICIC-4123",4123,05/03/26,649.00,0.00,21597.00',
  '06/03/26,"NEFT CR-ACME TECH PVT LTD-SALARY MAR2026",99,06/03/26,0.00,85000.00,106597.00',
].join('\n');

describe('parseStatementCsv', () => {
  it('reads a whole HDFC export', () => {
    const { txns, meta } = parseStatementCsv(HDFC);
    expect(meta.bank).toBe('HDFC');
    expect(meta.accountTail).toBe('4471');
    expect(meta.rows).toBe(2);
    expect(meta.parsed).toBe(2);
    expect(meta.errors).toEqual([]);
    expect(meta.hasRunningBalance).toBe(true);

    expect(txns[0]).toMatchObject({
      direction: 'DEBIT',
      amount: 649,
      vpa: 'netflix.rzp@icici',
      balanceHint: 21597,
      accountTail: '4471',
      bank: 'HDFC',
      isFailure: false,
      source: 'STATEMENT',
    });
    expect(txns[1]).toMatchObject({ direction: 'CREDIT', amount: 85000, balanceHint: 106597 });
  });

  it('keeps the last four digits of the account and nothing more', () => {
    const { meta } = parseStatementCsv(HDFC);
    expect(meta.accountTail).toBe('4471');
    expect(meta.accountTail).toHaveLength(4);
  });

  it('reads a single-amount layout with a Dr/Cr column', () => {
    const csv = [
      'Date,Particulars,Amount,Dr/Cr,Balance',
      '05/03/26,ACH D- LIC OF INDIA,1899.00,DR,19698.00',
      '15/03/26,NEFT CR-ACME,85000.00,CR,104698.00',
    ].join('\n');
    const { txns } = parseStatementCsv(csv);
    expect(txns.map((t) => t.direction)).toEqual(['DEBIT', 'CREDIT']);
    expect(txns.map((t) => t.amount)).toEqual([1899, 85000]);
  });

  it('reads a single-amount layout with no type column, using the sign', () => {
    const csv = ['Date,Description,Amount,Balance', '05/03/26,ACH D- LIC,-1899.00,19698.00'].join('\n');
    expect(parseStatementCsv(csv).txns[0]).toMatchObject({ direction: 'DEBIT', amount: 1899 });
  });

  it('marks a returned mandate as a failure so it is not counted as a debit', () => {
    const csv = [
      'Date,Narration,Withdrawal Amt.,Deposit Amt.,Closing Balance',
      '09/03/26,"ACH D- LIC OF INDIA-RETURNED INSUFFICIENT FUNDS",1899.00,0.00,100.00',
      '09/03/26,"ACH RETURN REVERSAL- LIC OF INDIA",0.00,1899.00,1999.00',
    ].join('\n');
    const { txns } = parseStatementCsv(csv);
    expect(txns).toHaveLength(2);
    expect(txns.every((t) => t.isFailure)).toBe(true);
  });

  it('honours explicit bank and account overrides', () => {
    const { meta } = parseStatementCsv(HDFC, { bank: 'AXIS', accountTail: '9999' });
    expect(meta.bank).toBe('AXIS');
    expect(meta.accountTail).toBe('9999');
  });

  it('falls back to OTHER when the bank is not named in the file', () => {
    const csv = ['Date,Description,Debit,Credit,Balance', '05/03/26,ACH D- LIC,100,0,900'].join('\n');
    expect(parseStatementCsv(csv).meta.bank).toBe('OTHER');
  });

  it('gives every row a distinct id, including two identical debits in a day', () => {
    const csv = [
      'Date,Narration,Withdrawal Amt.,Deposit Amt.,Closing Balance',
      '05/03/26,"UPI-SWIGGY-swiggy@ybl-HDFC-1",250.00,0.00,900.00',
      '05/03/26,"UPI-SWIGGY-swiggy@ybl-HDFC-2",250.00,0.00,650.00',
    ].join('\n');
    const { txns } = parseStatementCsv(csv);
    expect(txns).toHaveLength(2);
    expect(txns[0]!.id).not.toBe(txns[1]!.id);
  });

  it('skips the summary lines banks append below the table', () => {
    const csv = [
      'Date,Narration,Withdrawal Amt.,Deposit Amt.,Closing Balance',
      '05/03/26,"UPI-SWIGGY-swiggy@ybl-HDFC-1",250.00,0.00,900.00',
      ',*** END OF STATEMENT ***,,,',
      ',This is a computer generated statement.,,,',
    ].join('\n');
    const { txns, meta } = parseStatementCsv(csv);
    expect(txns).toHaveLength(1);
    expect(meta.errors).toEqual([]);
  });
});

describe('parseStatementCsv — refuses to guess', () => {
  it('reports an empty file instead of returning nothing quietly', () => {
    const { txns, meta } = parseStatementCsv('');
    expect(txns).toEqual([]);
    expect(meta.errors[0]).toMatch(/empty/i);
  });

  it('reports a file with no transaction table', () => {
    const { txns, meta } = parseStatementCsv('Dear customer,\nYour statement is attached.\n');
    expect(txns).toEqual([]);
    expect(meta.errors[0]).toMatch(/could not find a transaction table/i);
  });

  it('reports a table it found but could not read amounts from', () => {
    const csv = ['Date,Narration,Debit,Credit,Balance', '05/03/26,UPI-X,,,'].join('\n');
    const { txns, meta } = parseStatementCsv(csv);
    expect(txns).toEqual([]);
    expect(meta.errors.join(' ')).toMatch(/no rows with a readable amount/i);
  });

  it('never throws, whatever it is handed', () => {
    const garbage = [
      ' binary',
      'a'.repeat(10000),
      '"""""',
      'Date,Narration\n'.repeat(500),
      '05/03/26,,,,,,,,,,',
    ];
    for (const g of garbage) expect(() => parseStatementCsv(g)).not.toThrow();
  });

  it('is pure — the same text yields the same transactions', () => {
    const a = parseStatementCsv(HDFC).txns;
    const b = parseStatementCsv(HDFC).txns;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
