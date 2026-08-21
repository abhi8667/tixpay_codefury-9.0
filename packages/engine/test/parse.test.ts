import { describe, it, expect } from 'vitest';
import { parseSms, entityCode, resolveBank } from '../src/parse';
import cases from '../fixtures/sms_cases.json';
import type { RawSms } from '../src/types';

/**
 * The fixture corpus IS the spec for parseSms.
 *
 * Expect this file to be red until hour 2–3. That is the intended state: the
 * cases were hand-labelled before the parser existed, so implementing the
 * parser is the work of turning this file green. Leave `pnpm watch` running.
 *
 * Coverage target on the real inbox: >70% of financial SMS parsed. Below that,
 * cut to the top two banks by volume and hardcode — breadth is worthless when
 * only one device is being demoed.
 */

describe('entityCode', () => {
  it('strips the operator prefix', () => {
    expect(entityCode('AD-HDFCBK')).toBe('HDFCBK');
  });

  it('strips the DLT suffix', () => {
    expect(entityCode('VM-HDFCBK-S')).toBe('HDFCBK');
    expect(entityCode('JD-ICICIB-T')).toBe('ICICIB');
    expect(entityCode('VK-SBIINB-P')).toBe('SBIINB');
  });

  it('is case insensitive', () => {
    expect(entityCode('ad-hdfcbk')).toBe('HDFCBK');
  });

  it('resolves the same bank across differing circles and suffixes', () => {
    for (const header of ['AD-HDFCBK', 'VM-HDFCBK-S', 'JD-HDFCBK-T', 'BZ-HDFCBK']) {
      expect(resolveBank(header), header).toBe('HDFC');
    }
  });

  it('returns null for senders outside the registry', () => {
    expect(resolveBank('AD-SWGGYI')).toBeNull();
    expect(resolveBank('+919845012345')).toBeNull();
  });
});

describe('parseSms — labelled corpus', () => {
  for (const c of cases) {
    it(c.name, () => {
      const got = parseSms(c.raw as RawSms);

      if (c.expect === null) {
        expect(got, `${c.name} must be rejected`).toBeNull();
        return;
      }

      expect(got, `${c.name} must parse`).not.toBeNull();
      expect(got).toMatchObject(c.expect);
      expect(got!.timestamp.getTime()).toBe(c.raw.date);
      expect(got!.raw).toEqual(c.raw);
      expect(got!.id).toBeTruthy();
    });
  }
});

describe('parseSms — robustness', () => {
  const hostile: RawSms[] = [
    { address: '', body: '', date: 0 },
    { address: 'AD-HDFCBK', body: '', date: 1_773_546_240_000 },
    { address: 'AD-HDFCBK', body: 'Rs.', date: 1_773_546_240_000 },
    { address: 'AD-HDFCBK', body: '🙂🙂🙂', date: 1_773_546_240_000 },
    { address: 'AD-HDFCBK', body: 'Rs.NaN debited from a/c **', date: 1_773_546_240_000 },
  ];

  it('never throws on malformed input', () => {
    for (const raw of hostile) {
      expect(() => parseSms(raw), JSON.stringify(raw).slice(0, 60)).not.toThrow();
    }
  });

  it('does not mutate its input', () => {
    const raw: RawSms = { ...(cases[0]!.raw as RawSms) };
    const before = JSON.stringify(raw);
    parseSms(raw);
    expect(JSON.stringify(raw)).toBe(before);
  });
});
