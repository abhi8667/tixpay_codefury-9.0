import { describe, it, expect } from 'vitest';
import { parseUpiDeepLink, parseUpiParams, deriveTxnRef } from '../src/parse/deepLink';

describe('parseUpiDeepLink — the demo QR', () => {
  it('parses the Croma link from the demo script', () => {
    const got = parseUpiDeepLink(
      'upi://pay?pa=merchant@ybl&pn=Croma&am=8000&mc=5732&tr=XYZ&cu=INR',
    );
    expect(got).toMatchObject({
      vpa: 'merchant@ybl',
      payeeName: 'Croma',
      amount: 8000,
      mcc: '5732',
      source: 'QR',
    });
  });

  it('generates our own reference, ignoring the merchant tr', () => {
    const got = parseUpiDeepLink('upi://pay?pa=merchant@ybl&am=8000&tr=MERCHANT123');
    expect(got!.txnRef).toMatch(/^TP[0-9A-Z]+$/);
    expect(got!.txnRef).not.toContain('MERCHANT123');
  });

  it('is deterministic — same QR, same ref, every run', () => {
    const url = 'upi://pay?pa=merchant@ybl&am=8000';
    expect(parseUpiDeepLink(url)!.txnRef).toBe(parseUpiDeepLink(url)!.txnRef);
    expect(deriveTxnRef('merchant@ybl', 8000)).toBe(deriveTxnRef('MERCHANT@YBL', 8000));
  });

  it('gives different refs to different amounts', () => {
    expect(deriveTxnRef('merchant@ybl', 8000)).not.toBe(deriveTxnRef('merchant@ybl', 800));
  });
});

describe('parseUpiDeepLink — real-world shapes', () => {
  it('accepts upi: without slashes', () => {
    expect(parseUpiDeepLink('upi:pay?pa=shop@okhdfcbank&am=250')).toMatchObject({
      vpa: 'shop@okhdfcbank',
      amount: 250,
    });
  });

  it('accepts an Android intent URL', () => {
    const got = parseUpiDeepLink(
      'intent://pay?pa=shop@ybl&pn=Test&am=100#Intent;scheme=upi;package=com.phonepe.app;end',
    );
    expect(got).toMatchObject({ vpa: 'shop@ybl', payeeName: 'Test', amount: 100 });
  });

  it('URL-decodes the payee name', () => {
    expect(parseUpiDeepLink('upi://pay?pa=shop@ybl&pn=Meghana%20Foods%20%26%20Co')!.payeeName)
      .toBe('Meghana Foods & Co');
    expect(parseUpiDeepLink('upi://pay?pa=shop@ybl&pn=Sri+Krishna')!.payeeName)
      .toBe('Sri Krishna');
  });

  it('handles a static QR with no amount — A prompts for it', () => {
    const got = parseUpiDeepLink('upi://pay?pa=chaiwala@paytm&pn=Chai%20Point');
    expect(got).toMatchObject({ vpa: 'chaiwala@paytm', amount: 0 });
  });

  it('falls back to the VPA handle when pn is missing', () => {
    expect(parseUpiDeepLink('upi://pay?pa=croma@ybl&am=8000')!.payeeName).toBe('croma');
  });

  it('tolerates unknown and duplicated params', () => {
    const got = parseUpiDeepLink(
      'upi://pay?pa=shop@ybl&am=100&mode=02&purpose=00&orgid=159761&sign=abc123',
    );
    expect(got).toMatchObject({ vpa: 'shop@ybl', amount: 100 });
  });

  it('is case insensitive on the scheme and param names', () => {
    expect(parseUpiDeepLink('UPI://PAY?PA=shop@ybl&AM=100')).toMatchObject({
      vpa: 'shop@ybl',
      amount: 100,
    });
  });

  it('handles lakh-grouped amounts', () => {
    expect(parseUpiDeepLink('upi://pay?pa=builder@ybl&am=1,25,000.00')!.amount).toBe(125000);
  });
});

describe('parseUpiDeepLink — a judge scans a random QR', () => {
  const junk = [
    'https://www.google.com',
    'WIFI:S:CafeWiFi;T:WPA;P:hunter2;;',
    'BEGIN:VCARD\nFN:Someone\nEND:VCARD',
    'upi://pay',
    'upi://pay?am=8000',              // no pa — not payable
    'upi://pay?pa=&am=8000',          // empty pa
    'upi://pay?pa=notavpa&am=8000',   // no @psp
    'upi://pay?pa=@ybl',              // no handle
    '',
    '   ',
    'upi://',
    'intent://pay?pa=shop@ybl#Intent;scheme=http;end', // not a UPI intent
  ];

  it.each(junk)('returns null for %j', (url) => {
    expect(parseUpiDeepLink(url)).toBeNull();
  });

  it('never throws, whatever it is handed', () => {
    const hostile = [...junk, 'upi://pay?pa=shop@ybl&pn=%E0%A4', 'upi://pay?pa=shop@ybl&am=abc'];
    for (const url of hostile) {
      expect(() => parseUpiDeepLink(url), url).not.toThrow();
    }
    // @ts-expect-error — Person A's scanner can hand us a non-string on a bad decode
    expect(() => parseUpiDeepLink(null)).not.toThrow();
    // @ts-expect-error — same
    expect(parseUpiDeepLink(undefined)).toBeNull();
  });

  it('survives a malformed percent-escape in the payee name', () => {
    expect(parseUpiDeepLink('upi://pay?pa=shop@ybl&pn=%E0%A4&am=100')).toMatchObject({
      vpa: 'shop@ybl',
      amount: 100,
    });
  });

  it('treats a non-numeric amount as absent rather than NaN', () => {
    expect(parseUpiDeepLink('upi://pay?pa=shop@ybl&am=abc')!.amount).toBe(0);
  });
});

describe('parseUpiParams', () => {
  it('exposes the raw bag for resolveMcc', () => {
    expect(parseUpiParams('upi://pay?pa=shop@ybl&mc=5814&am=428')).toMatchObject({
      pa: 'shop@ybl',
      mc: '5814',
      am: '428',
    });
  });

  it('ignores a non-MCC mc value', () => {
    expect(parseUpiDeepLink('upi://pay?pa=shop@ybl&mc=abc&am=100')!.mcc).toBeUndefined();
    expect(parseUpiDeepLink('upi://pay?pa=shop@ybl&mc=58140&am=100')!.mcc).toBeUndefined();
  });
});
