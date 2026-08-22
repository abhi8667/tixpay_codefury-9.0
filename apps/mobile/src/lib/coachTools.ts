import type { GeminiFunctionDeclaration } from './gemini';
import { useAppStore } from '../../store/useAppStore';
import type { Cadence } from '@tixpay/types';

/**
 * The Money Coach's tool surface.
 *
 * Every tool reads off the store's already-computed selectors — the same
 * numbers Spend Insights, Goals, and SIP Check render — so the coach can
 * never say something the rest of the app disagrees with. Nothing here
 * touches raw transactions; each tool returns an aggregate.
 */
export const COACH_TOOLS: GeminiFunctionDeclaration[] = [
  {
    name: 'get_spend_breakdown',
    description: 'Category-wise spend for a trailing window, with the % change vs the window before it.',
    parameters: {
      type: 'object',
      properties: {
        windowDays: { type: 'number', description: 'Window length in days. Defaults to 30.' },
      },
    },
  },
  {
    name: 'get_goal_status',
    description: "The user's savings goal: target, saved so far, monthly surplus, and whether they're on track.",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'check_sip_affordability',
    description: 'Whether starting a new SIP of a given amount/cadence would cause a cash-flow shortfall.',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Rupees per debit.' },
        cadence: { type: 'string', enum: ['MONTHLY', 'WEEKLY', 'QUARTERLY'] },
        dayOfMonth: { type: 'number', description: 'Day of month the debit lands on, 1-28. Defaults to 5.' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'get_mandates',
    description: 'The recurring auto-debits (EMI, SIP, insurance, utility, subscriptions) detected on the account.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_safe_to_spend',
    description: 'Current inferred balance and the safe-to-spend figure over the next 30 days.',
    parameters: { type: 'object', properties: {} },
  },
];

export function executeCoachTool(name: string, args: Record<string, unknown>): Record<string, unknown> {
  const s = useAppStore.getState();

  switch (name) {
    case 'get_spend_breakdown': {
      const windowDays = typeof args.windowDays === 'number' ? args.windowDays : 30;
      const b = s.spendBreakdown(windowDays);
      if (!b) return { error: 'No statement imported yet.' };
      return {
        windowDays,
        totalSpend: b.totalSpend,
        changePct: b.changePct,
        categories: b.categories.slice(0, 8).map((c) => ({
          category: c.category,
          amount: c.amount,
          pctOfTotal: c.pctOfTotal,
        })),
      };
    }

    case 'get_goal_status': {
      const status = s.goalStatus();
      if (!status) return { error: 'No statement imported yet.' };
      return {
        goalLabel: s.goalLabel,
        targetAmount: status.targetAmount,
        savedAmount: status.savedAmount,
        pct: Math.round(status.pct * 100),
        avgMonthlySurplus: status.avgMonthlySurplus,
        monthsRemaining: status.monthsRemaining,
        onTrack: status.onTrack,
      };
    }

    case 'check_sip_affordability': {
      const amount = typeof args.amount === 'number' ? args.amount : 0;
      const cadence = (typeof args.cadence === 'string' ? args.cadence : 'MONTHLY') as Cadence;
      const dayOfMonth = typeof args.dayOfMonth === 'number' ? args.dayOfMonth : 5;
      if (amount <= 0) return { error: 'amount must be a positive number.' };
      const result = s.checkSip(amount, cadence, dayOfMonth);
      if (!result) return { error: 'No statement imported yet.' };
      return {
        level: result.level,
        headline: result.headline,
        subline: result.subline ?? null,
        shortfallDayCount: result.newShortfalls.length,
      };
    }

    case 'get_mandates': {
      const mandates = s.mandates();
      return {
        mandates: mandates.map((m) => ({
          name: m.displayName,
          amount: m.amount,
          category: m.category,
          cadence: m.cadence,
          nextDebit: m.nextDebit.toISOString(),
          isPaused: m.isPaused,
        })),
      };
    }

    case 'get_safe_to_spend': {
      const curve = s.curve();
      const ledger = s.ledger();
      if (!ledger || curve.length === 0) return { error: 'No statement imported yet.' };
      const lowest = Math.min(...curve.map((p) => p.balance));
      return {
        currentBalance: ledger.currentBalance,
        safeToSpend: Math.max(0, Math.floor(lowest - 500)),
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export const COACH_SYSTEM_INSTRUCTION = `You are the Money Coach inside TiXPay, an on-device cash-flow app for Indian UPI users.

Rules:
- Never state a rupee figure, percentage, or date unless it came from a tool call in this conversation. If you don't have the number, call a tool for it.
- Keep answers short: 2-4 sentences, plain language, no jargon.
- Use ₹ and Indian digit grouping (e.g. ₹1,25,000) when quoting amounts.
- If a question needs data you don't have a tool for, say so plainly instead of guessing.
- You are not a licensed financial advisor. For anything resembling personalized investment advice beyond what the app's own engine computed, say you can only speak to what's in their account data.`;
