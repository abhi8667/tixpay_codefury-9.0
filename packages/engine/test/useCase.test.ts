import { describe, it, expect } from 'vitest';
import demoInbox from '../fixtures/demo_inbox.json';
import demoExpectations from '../fixtures/demo_expectations.json';
import { runPipeline } from '../src/pipeline';
import { evaluatePayment } from '../src/evaluate';
import { parseUpiDeepLink } from '../src/parse/deepLink';
import { projectWithPaused } from '../src/project/curve';
import { istDayKey } from '../src/time';
import type { Card, RawSms } from '../src/types';

describe('End-to-End Use Case Scenario (Live Demo Pitch Script)', () => {
  const NOW = new Date(demoExpectations.now); // 2026-03-01
  const pipelineResult = runPipeline(demoInbox as RawSms[], NOW);

  it('Step 1: Process inbox and discover 8 mandates with 0 drift', () => {
    expect(pipelineResult.stats.messages).toBeGreaterThan(400);
    expect(pipelineResult.stats.parseRate).toBeGreaterThan(0.7);
    expect(pipelineResult.stats.banks).toEqual(['AXIS', 'HDFC', 'ICICI', 'KOTAK', 'PNB', 'SBI']);
    expect(pipelineResult.ledger.drift).toBe(0);
    expect(pipelineResult.mandates).toHaveLength(8);
  });

  it('Step 2: Detect the day 12 shortfall on Nippon India SIP', () => {
    expect(pipelineResult.shortfalls).toHaveLength(1);
    const sf = pipelineResult.shortfalls[0]!;
    expect(istDayKey(sf.date)).toBe('2026-03-12');
    expect(sf.atRisk.some(m => m.displayName.includes('Nippon'))).toBe(true);
  });

  it('Step 3: Intercept ₹8,000 QR scan and recommend Visa fee waiver swipe', () => {
    const qrUrl = 'upi://pay?pa=croma.store@icici&pn=Croma%20Bengaluru&am=8000&mc=5732';
    const intent = parseUpiDeepLink(qrUrl);
    expect(intent).not.toBeNull();
    expect(intent!.amount).toBe(8000);

    const cards: Card[] = [
      {
        id: 'c1', name: 'HDFC RuPay', network: 'RUPAY', upiLinkable: true, rewardRate: 1, categoryRates: {}, mccExclusions: []
      },
      {
        id: 'c2', name: 'Axis Visa Signature', network: 'VISA', upiLinkable: false, rewardRate: 1.5, categoryRates: {}, mccExclusions: [],
        feeWaiverThreshold: 100000, annualFee: 3000, ytdSpend: 96000
      }
    ];

    const verdict = evaluatePayment(intent!, pipelineResult.ledger, pipelineResult.mandates, pipelineResult.income, cards, NOW);
    expect(verdict.level).toBe('WARNING');
    expect(verdict.headline).toMatch(/shortfall/);
    expect(verdict.recommendation?.rail).toBe('CARD_SWIPE');
    expect(verdict.recommendation?.reason).toMatch(/fee waiver/);
  });

  it('Step 4: Resolve shortfall by pausing Netflix ₹649', () => {
    const netflix = pipelineResult.mandates.find(m => m.displayName === 'Netflix')!;
    const rescued = projectWithPaused(pipelineResult.ledger, pipelineResult.mandates, pipelineResult.income, NOW, [netflix.id]);
    const pointOn12th = rescued.find(p => istDayKey(p.date) === '2026-03-12')!;

    expect(pointOn12th.balance).toBeGreaterThanOrEqual(500);
    expect(rescued.every(p => p.balance >= 500)).toBe(true);
  });
});
