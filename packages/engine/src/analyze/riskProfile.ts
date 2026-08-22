import type { MoneyMap } from './health';

/**
 * Risk profiling, done the way the regulated version is done: attitude and
 * capacity scored separately, and the lower of the two wins.
 *
 * The theme brief opens on the problem — "students begin SIPs without
 * understanding risk". The usual app answer is a five-question quiz that hands
 * back "Aggressive" to anyone who ticks the brave-sounding boxes. That measures
 * how a person feels about risk on a calm afternoon. It does not measure
 * whether their account could survive the drawdown they just agreed to.
 *
 * The statement can answer the second question, so it does. `capacityScore` is
 * computed from the emergency buffer, the savings rate and how much of income
 * is already committed — all figures the user can check against their own
 * transactions. When capacity is the lower of the two, the profile is set by
 * capacity and the screen says which number capped it and why.
 *
 * Nothing here is advice about a security. It maps a score to a broad asset mix
 * and stops there; the app states that in as many words.
 */

export type RiskProfileName =
  | 'CONSERVATIVE'
  | 'MODERATE'
  | 'BALANCED'
  | 'GROWTH'
  | 'AGGRESSIVE';

/** One question in the attitude questionnaire. */
export interface RiskQuestion {
  id: string;
  prompt: string;
  /** Ordered lowest-risk first. `score` is 0–4. */
  options: Array<{ label: string; score: number }>;
}

/**
 * The attitude questions.
 *
 * Five, because a longer form is abandoned and a shorter one cannot separate
 * horizon from tolerance — which are the two that actually move the answer.
 */
export const RISK_QUESTIONS: RiskQuestion[] = [
  {
    id: 'horizon',
    prompt: 'When would you need this money back?',
    options: [
      { label: 'Within a year', score: 0 },
      { label: '1–3 years', score: 1 },
      { label: '3–5 years', score: 2 },
      { label: '5–10 years', score: 3 },
      { label: 'Over 10 years', score: 4 },
    ],
  },
  {
    id: 'drawdown',
    prompt: 'Your ₹1,00,000 investment drops to ₹80,000 in a month. You:',
    options: [
      { label: 'Sell everything', score: 0 },
      { label: 'Sell some of it', score: 1 },
      { label: 'Wait and watch', score: 2 },
      { label: 'Hold, and keep the SIP running', score: 3 },
      { label: 'Invest more at the lower price', score: 4 },
    ],
  },
  {
    id: 'experience',
    prompt: 'How much investing have you actually done?',
    options: [
      { label: 'None yet', score: 0 },
      { label: 'Only FDs and savings', score: 1 },
      { label: 'A mutual fund or two', score: 2 },
      { label: 'Regular SIPs for years', score: 3 },
      { label: 'Direct equity, and through a crash', score: 4 },
    ],
  },
  {
    id: 'dependants',
    prompt: 'Who else relies on your income?',
    options: [
      { label: 'Several people, and it is the only income', score: 0 },
      { label: 'A few people', score: 1 },
      { label: 'One other person', score: 2 },
      { label: 'Nobody, but income is irregular', score: 3 },
      { label: 'Nobody, and income is steady', score: 4 },
    ],
  },
  {
    id: 'goal',
    prompt: 'What is this money for?',
    options: [
      { label: 'An emergency fund', score: 0 },
      { label: 'Something I have planned within two years', score: 1 },
      { label: 'A house or a car eventually', score: 2 },
      { label: 'Long-term wealth', score: 3 },
      { label: 'Retirement, decades away', score: 4 },
    ],
  },
];

/** A broad asset mix. Percentages, summing to 100. */
export interface Allocation {
  equity: number;
  debt: number;
  gold: number;
  cash: number;
}

export interface RiskProfileResult {
  /** 0–100, from the questionnaire alone: how much risk you say you want. */
  attitudeScore: number;
  /** 0–100, from the statement: how much risk this account can absorb. */
  capacityScore: number;
  /** The binding one. min(attitude, capacity). */
  score: number;
  profile: RiskProfileName;
  /** True when capacity, not attitude, set the profile. */
  cappedByCapacity: boolean;
  headline: string;
  /** Why capacity scored what it did, each line naming its figure. */
  capacityReasons: string[];
  allocation: Allocation;
  /** Suggested monthly SIP given the observed surplus. Null without one. */
  suggestedMonthlySip: number | null;
}

const PROFILE_BANDS: Array<[number, RiskProfileName, Allocation]> = [
  [20, 'CONSERVATIVE', { equity: 10, debt: 65, gold: 5, cash: 20 }],
  [40, 'MODERATE', { equity: 30, debt: 50, gold: 10, cash: 10 }],
  [60, 'BALANCED', { equity: 50, debt: 35, gold: 10, cash: 5 }],
  [80, 'GROWTH', { equity: 70, debt: 20, gold: 5, cash: 5 }],
  [101, 'AGGRESSIVE', { equity: 85, debt: 10, gold: 5, cash: 0 }],
];

function bandFor(score: number): { profile: RiskProfileName; allocation: Allocation } {
  for (const [ceiling, profile, allocation] of PROFILE_BANDS) {
    if (score < ceiling) return { profile, allocation };
  }
  const last = PROFILE_BANDS[PROFILE_BANDS.length - 1]!;
  return { profile: last[1], allocation: last[2] };
}

/**
 * Score how much risk this account can absorb, from the statement alone.
 *
 * Three inputs, equally weighted, each capped:
 *   buffer      — months of spending covered; 6 months is full marks
 *   savings     — surplus as a share of income; 30% is full marks
 *   commitment  — share of income already committed; under 20% is full marks
 *
 * A person with two weeks of buffer and 70% of income committed cannot hold an
 * equity drawdown regardless of what they told the quiz, because the first bad
 * month forces the sale.
 */
export function computeRiskCapacity(map: MoneyMap): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  const buffer = map.bufferMonths ?? 0;
  const bufferScore = Math.max(0, Math.min(1, buffer / 6));
  reasons.push(
    map.bufferMonths === null
      ? 'No spending history yet, so the emergency buffer could not be measured.'
      : `${buffer} months of spending sitting in cash and reserve.`,
  );

  const rate = map.savingsRate ?? 0;
  const savingScore = Math.max(0, Math.min(1, rate / 0.3));
  reasons.push(
    map.savingsRate === null
      ? 'No income observed, so the savings rate could not be measured.'
      : rate > 0
        ? `Saving ${Math.round(rate * 100)}% of income — ₹${map.monthlySurplus.toLocaleString('en-IN')} a month is investable.`
        : 'Spending more than comes in, so there is nothing spare to put at risk.',
  );

  const ratio = map.commitmentRatio ?? 0;
  const commitScore = Math.max(0, Math.min(1, (0.7 - ratio) / 0.5));
  if (map.totalCommitted > 0 && map.commitmentRatio !== null) {
    reasons.push(
      `₹${map.totalCommitted.toLocaleString('en-IN')} a month is already committed — ${Math.round(ratio * 100)}% of income.`,
    );
  } else {
    reasons.push('No recurring commitments found, so income is uncommitted.');
  }

  return {
    score: Math.round(((bufferScore + savingScore + commitScore) / 3) * 100),
    reasons,
  };
}

/**
 * Combine the questionnaire with what the account can actually take.
 *
 * `answers` maps question id → the chosen option's score (0–4). Unanswered
 * questions are treated as unanswered, not as zero: scoring a half-finished
 * form as maximally cautious produces a confident wrong answer.
 */
export function computeRiskProfile(
  answers: Record<string, number>,
  map: MoneyMap,
): RiskProfileResult {
  const answered = RISK_QUESTIONS.filter((q) => typeof answers[q.id] === 'number');
  const maxPer = 4;
  const attitudeScore =
    answered.length > 0
      ? Math.round(
          (answered.reduce((s, q) => s + Math.max(0, Math.min(maxPer, answers[q.id]!)), 0) /
            (answered.length * maxPer)) *
            100,
        )
      : 0;

  const capacity = computeRiskCapacity(map);
  const score = Math.min(attitudeScore, capacity.score);
  const cappedByCapacity = capacity.score < attitudeScore;
  const { profile, allocation } = bandFor(score);

  // With nothing answered, "your appetite and your account agree" is a claim
  // about an appetite nobody has stated. Say what is actually true instead.
  const headline =
    answered.length === 0
      ? 'Answer the questions below and this becomes your profile rather than a floor.'
      : answered.length < RISK_QUESTIONS.length
        ? `Based on ${answered.length} of ${RISK_QUESTIONS.length} answers so far.`
        : cappedByCapacity
          ? 'Your appetite is ahead of what this account can currently absorb.'
          : 'Your appetite and your account agree.';

  // A rule of thumb, stated as one: half the observed surplus, so a bad month
  // does not force the SIP to stop. Rounded to ₹500 because nobody starts a
  // ₹4,237 SIP.
  const suggestedMonthlySip =
    map.monthlySurplus > 1000 ? Math.floor((map.monthlySurplus * 0.5) / 500) * 500 : null;

  return {
    attitudeScore,
    capacityScore: capacity.score,
    score,
    profile,
    cappedByCapacity,
    headline,
    capacityReasons: capacity.reasons,
    allocation,
    suggestedMonthlySip,
  };
}

/** Display copy per profile. Kept beside the bands so the two cannot drift. */
export const PROFILE_COPY: Record<RiskProfileName, { label: string; blurb: string }> = {
  CONSERVATIVE: {
    label: 'Conservative',
    blurb: 'Capital protection first. Growth is a bonus, not the plan.',
  },
  MODERATE: {
    label: 'Moderate',
    blurb: 'Mostly steady, with a slice that can move.',
  },
  BALANCED: {
    label: 'Balanced',
    blurb: 'An even split. Expect ordinary years to be dull and bad ones to sting.',
  },
  GROWTH: {
    label: 'Growth',
    blurb: 'Equity-led. You need the time and the temperament to sit through a fall.',
  },
  AGGRESSIVE: {
    label: 'Aggressive',
    blurb: 'Almost all equity. Only sensible with a long horizon and a real buffer.',
  },
};
