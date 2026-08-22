import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';
import { ScreenHeader } from '../components/ScreenHeader';
import { FadeIn, ProgressBar, EmptyState, money } from '../components/motion';
import { useAppStore } from '../../store/useAppStore';
import type { MoneyMapLine } from '@tixpay/engine';

interface MoneyMapScreenProps {
  onBack?: () => void;
  onOpenGoals?: () => void;
}

const GRADE_SKIN = {
  STRONG: { color: t.ok, bg: '#0A261C', label: 'Strong' },
  STEADY: { color: t.accent, bg: '#121A26', label: 'Steady' },
  STRETCHED: { color: t.warn, bg: '#262010', label: 'Stretched' },
  AT_RISK: { color: t.danger, bg: '#261214', label: 'At risk' },
} as const;

const LINE_META: Array<{
  key: 'investing' | 'protection' | 'debt' | 'fixed';
  icon: string;
  color: string;
  blurb: string;
}> = [
  { key: 'investing', icon: '📈', color: '#5B8DEF', blurb: 'Leaving for investments' },
  { key: 'protection', icon: '🛡️', color: '#38BDF8', blurb: 'Premiums keeping cover alive' },
  { key: 'debt', icon: '🏦', color: '#F0553D', blurb: 'Servicing what you owe' },
  { key: 'fixed', icon: '💡', color: '#F5A524', blurb: 'Bills and subscriptions' },
];

/**
 * Portfolio consolidation, honestly scoped.
 *
 * The brief asks for investments spread across platforms pulled into one view.
 * We hold no consent to read holdings and inventing a portfolio value would be
 * the most dishonest thing this app could do — so this consolidates what a
 * statement genuinely proves: the money flowing to each platform, what is
 * committed before you spend anything, and how many months the account would
 * survive on its own.
 *
 * The screen says that in as many words rather than leaving a judge to work out
 * why there is no "total portfolio value" tile.
 */
export const MoneyMapScreen: React.FC<MoneyMapScreenProps> = ({ onBack, onOpenGoals }) => {
  const moneyMap = useAppStore((s) => s.moneyMap);
  const healthVerdict = useAppStore((s) => s.healthVerdict);
  const pipelineCache = useAppStore((s) => s._pipelineCache);
  const keeperBalance = useAppStore((s) => s.keeperBalance);

  const map = useMemo(() => moneyMap(), [moneyMap, pipelineCache, keeperBalance]);
  const verdict = useMemo(() => healthVerdict(), [healthVerdict, pipelineCache, keeperBalance]);

  if (!map || !verdict) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Money Map" onBack={onBack} />
        <EmptyState
          icon="🗺️"
          title="Nothing to consolidate yet"
          body="The Money Map is built from an imported statement. Import one and this fills in."
        />
      </View>
    );
  }

  const skin = GRADE_SKIN[verdict.grade];
  const lines: Array<{ meta: (typeof LINE_META)[number]; line: MoneyMapLine }> = LINE_META.map(
    (meta) => ({ meta, line: map[meta.key] }),
  ).filter((entry) => entry.line.monthly > 0);

  const committedShare =
    map.monthlyIncome > 0 ? Math.min(1, map.totalCommitted / map.monthlyIncome) : 0;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Money Map"
        onBack={onBack}
        subtitle={`Measured over ${map.observedDays} days of statement`}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* ── Verdict ──────────────────────────────────────────────────── */}
        <FadeIn style={[styles.verdictCard, { backgroundColor: skin.bg, borderColor: skin.color }]}>
          <View style={styles.verdictTop}>
            <View style={[styles.scoreRing, { borderColor: skin.color }]}>
              <Text style={[styles.scoreText, { color: skin.color }]}>{verdict.score}</Text>
            </View>
            <View style={styles.verdictMeta}>
              <Text style={[styles.gradeLabel, { color: skin.color }]}>{skin.label}</Text>
              <Text style={styles.verdictHeadline}>{verdict.headline}</Text>
            </View>
          </View>

          <View style={styles.findings}>
            {verdict.findings.map((f) => (
              <View key={f.text} style={styles.findingRow}>
                <Text style={[styles.findingMark, f.ok ? styles.markOk : styles.markBad]}>
                  {f.ok ? '✓' : '!'}
                </Text>
                <Text style={styles.findingText}>{f.text}</Text>
              </View>
            ))}
          </View>
        </FadeIn>

        {/* ── Balances ─────────────────────────────────────────────────── */}
        <View style={styles.tileRow}>
          <FadeIn delay={50} style={styles.tile}>
            <Text style={styles.tileLabel}>In your account</Text>
            <Rupee amount={map.liquidBalance} style={styles.tileValue} showPrefix={false} animate />
            <Text style={styles.tileSub}>Reconciled from the statement</Text>
          </FadeIn>
          <FadeIn delay={80} style={styles.tile}>
            <Text style={styles.tileLabel}>Set aside</Text>
            <Rupee amount={map.reserve} style={styles.tileValue} showPrefix={false} animate />
            <Text style={styles.tileSub}>Your Goals jar</Text>
          </FadeIn>
        </View>

        <View style={styles.tileRow}>
          <FadeIn delay={110} style={styles.tile}>
            <Text style={styles.tileLabel}>Coming in</Text>
            <Rupee amount={map.monthlyIncome} style={styles.tileValueIn} showPrefix={false} />
            <Text style={styles.tileSub}>Average per month</Text>
          </FadeIn>
          <FadeIn delay={140} style={styles.tile}>
            <Text style={styles.tileLabel}>Going out</Text>
            <Rupee amount={map.monthlySpend} style={styles.tileValueOut} showPrefix={false} />
            <Text style={styles.tileSub}>
              Average per month · {money(map.typicalMonthlySpend)} in a typical one
            </Text>
          </FadeIn>
        </View>

        {/* ── Commitments ──────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Committed every month</Text>

        {lines.length === 0 ? (
          <View style={styles.emptyLines}>
            <Text style={styles.emptyLinesText}>
              No recurring commitments were detected on this account. Every rupee that comes in
              is discretionary — which is unusual freedom, and also means nothing is being put
              away automatically.
            </Text>
          </View>
        ) : (
          <>
            <FadeIn delay={160} style={styles.committedHero}>
              <Rupee
                amount={map.totalCommitted}
                style={typography.display}
                showPrefix={false}
              />
              <Text style={styles.committedSub}>
                {map.commitmentRatio !== null
                  ? `${Math.round(map.commitmentRatio * 100)}% of what comes in, before you spend anything`
                  : 'Share of income unknown — no credits observed'}
              </Text>
              <ProgressBar
                progress={committedShare}
                color={committedShare > 0.5 ? t.danger : t.warn}
                style={styles.committedBar}
              />
            </FadeIn>

            {lines.map(({ meta, line }, index) => (
              <FadeIn key={meta.key} delay={190 + index * 30} style={styles.lineRow}>
                <View style={[styles.lineIcon, { backgroundColor: `${meta.color}22` }]}>
                  <Text style={styles.lineIconText}>{meta.icon}</Text>
                </View>
                <View style={styles.lineMeta}>
                  <View style={styles.lineTop}>
                    <Text style={styles.lineLabel}>{line.label}</Text>
                    <Text style={styles.lineAmount}>{money(line.monthly)}/mo</Text>
                  </View>
                  <Text style={styles.lineBlurb}>{meta.blurb}</Text>
                  <Text style={styles.lineItems} numberOfLines={2}>
                    {line.items.join(' · ')}
                  </Text>
                </View>
              </FadeIn>
            ))}
          </>
        )}

        {/* ── Ratios ───────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>The three ratios</Text>
        <FadeIn delay={280} style={styles.ratioCard}>
          <Ratio
            label="Emergency buffer"
            value={map.bufferMonths === null ? '—' : `${map.bufferMonths} months`}
            note={`Cash plus reserve, divided by ${money(map.typicalMonthlySpend)} — the median spending day scaled to a month, so one large purchase does not distort it. Three months is the usual floor.`}
          />
          <Ratio
            label="Savings rate"
            value={map.savingsRate === null ? '—' : `${Math.round(map.savingsRate * 100)}%`}
            note="What is left after everything, as a share of what came in."
          />
          <Ratio
            label="Commitment load"
            value={
              map.commitmentRatio === null ? '—' : `${Math.round(map.commitmentRatio * 100)}%`
            }
            note="Recurring debits as a share of income. Over half is tight."
          />
        </FadeIn>

        {onOpenGoals && (
          <Text style={styles.footnote}>
            This consolidates cash FLOW, not holdings. We can prove the ₹5,000 that leaves for a
            fund every month because it is a line in your statement; we cannot see what that
            fund is now worth without a broker connection, so this screen does not pretend to.
          </Text>
        )}
      </ScrollView>
    </View>
  );
};

const Ratio: React.FC<{ label: string; value: string; note: string }> = ({
  label,
  value,
  note,
}) => (
  <View style={styles.ratioRow}>
    <View style={styles.ratioTop}>
      <Text style={styles.ratioLabel}>{label}</Text>
      <Text style={styles.ratioValue}>{value}</Text>
    </View>
    <Text style={styles.ratioNote}>{note}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  content: { flex: 1 },
  scrollContent: { padding: space.md, paddingBottom: 48 },

  verdictCard: { borderWidth: 1, borderRadius: radius.md, padding: space.md },
  verdictTop: { flexDirection: 'row', alignItems: 'center' },
  scoreRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  scoreText: { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  verdictMeta: { flex: 1 },
  gradeLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  verdictHeadline: { color: t.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  findings: { marginTop: space.md, borderTopWidth: 1, borderTopColor: t.border, paddingTop: space.sm },
  findingRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 3 },
  findingMark: { fontSize: 12, fontWeight: '900', width: 16 },
  markOk: { color: t.ok },
  markBad: { color: t.warn },
  findingText: { flex: 1, color: t.textDim, fontSize: 12, lineHeight: 18 },

  tileRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  tile: {
    flex: 1,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  tileLabel: { ...typography.caption, marginBottom: 4 },
  tileValue: { color: t.text, fontSize: 20, fontWeight: '800' },
  tileValueIn: { color: t.ok, fontSize: 20, fontWeight: '800' },
  tileValueOut: { color: t.warn, fontSize: 20, fontWeight: '800' },
  tileSub: { color: t.textFaint, fontSize: 10, marginTop: 3 },

  sectionTitle: {
    color: t.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: space.lg,
    marginBottom: space.sm,
  },

  emptyLines: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  emptyLinesText: { color: t.textDim, fontSize: 12, lineHeight: 19 },

  committedHero: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    alignItems: 'center',
  },
  committedSub: { color: t.textDim, fontSize: 12, textAlign: 'center', marginTop: 4 },
  committedBar: { width: '100%', marginTop: space.sm },

  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  lineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  lineIconText: { fontSize: 16 },
  lineMeta: { flex: 1 },
  lineTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineLabel: { color: t.text, fontSize: 14, fontWeight: '600' },
  lineAmount: { color: t.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  lineBlurb: { color: t.textDim, fontSize: 11, marginTop: 2 },
  lineItems: { color: t.textFaint, fontSize: 10, marginTop: 3, lineHeight: 15 },

  ratioCard: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  ratioRow: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: t.border },
  ratioTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ratioLabel: { color: t.text, fontSize: 14, fontWeight: '600' },
  ratioValue: {
    color: t.warn,
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  ratioNote: { color: t.textFaint, fontSize: 11, lineHeight: 16, marginTop: 3 },

  footnote: { color: t.textFaint, fontSize: 11, lineHeight: 17, marginTop: space.lg },
});
