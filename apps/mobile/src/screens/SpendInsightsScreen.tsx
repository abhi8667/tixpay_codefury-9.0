import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';
import { ScreenHeader } from '../components/ScreenHeader';
import { FadeIn, PressableScale, ProgressBar, Sparkline, EmptyState, money } from '../components/motion';
import { useAppStore } from '../../store/useAppStore';
import { formatIstDate, type SpendCategory } from '@tixpay/engine';

interface SpendInsightsScreenProps {
  onBack?: () => void;
}

export const CATEGORY_META: Record<SpendCategory, { label: string; icon: string; color: string }> = {
  EMI: { label: 'EMI & loans', icon: '🏦', color: '#F0553D' },
  SIP: { label: 'Investments', icon: '📈', color: '#5B8DEF' },
  INSURANCE: { label: 'Insurance', icon: '🛡️', color: '#38BDF8' },
  UTILITY: { label: 'Bills & utilities', icon: '💡', color: '#F5A524' },
  OTT: { label: 'Subscriptions', icon: '🎬', color: '#C084FC' },
  FOOD: { label: 'Food & dining', icon: '🍔', color: '#FB923C' },
  GROCERIES: { label: 'Groceries', icon: '🛒', color: '#84CC16' },
  SHOPPING: { label: 'Shopping', icon: '🛍️', color: '#60A5FA' },
  TRAVEL: { label: 'Travel & transport', icon: '🚕', color: '#2DD4A0' },
  HEALTH: { label: 'Health & pharmacy', icon: '💊', color: '#F472B6' },
  ENTERTAINMENT: { label: 'Entertainment', icon: '🎟️', color: '#A78BFA' },
  EDUCATION: { label: 'Education', icon: '🎓', color: '#22D3EE' },
  PEOPLE: { label: 'People', icon: '🧑‍🤝‍🧑', color: '#94A3B8' },
  TRANSFER: { label: 'Transfers', icon: '↔️', color: '#64748B' },
  OTHER: { label: 'Other merchants', icon: '•••', color: '#78849A' },
};

const WINDOWS = [
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: '90 days', days: 90 },
];

/**
 * "Transforms complex financial data into clear, personalized, actionable
 * insights" — the theme brief, applied to the same categorised transactions the
 * mandate detector already reads. No new ingestion, just a different lens on
 * the one statement the user imported.
 *
 * The three layers are deliberate. The headline is what changed. The category
 * list is where it went. The merchant list is who got it — and that last one is
 * the layer that makes the screen useful on a real statement, where a third of
 * spend lands in "other merchants" because they are corner shops nobody has a
 * lookup table for. A total we cannot name is still a total we can itemise.
 */
export const SpendInsightsScreen: React.FC<SpendInsightsScreenProps> = ({ onBack }) => {
  const [windowDays, setWindowDays] = useState(30);
  const [openCategory, setOpenCategory] = useState<SpendCategory | null>(null);

  const spendBreakdown = useAppStore((s) => s.spendBreakdown);
  const pipelineCache = useAppStore((s) => s._pipelineCache);

  const breakdown = useMemo(
    () => spendBreakdown(windowDays),
    [spendBreakdown, windowDays, pipelineCache],
  );

  const changeLabel = useMemo(() => {
    if (!breakdown || breakdown.changePct === null) return null;
    const pct = Math.round(breakdown.changePct * 1000) / 10;
    const up = pct > 0;
    return { up, text: `${up ? '+' : ''}${pct}% vs the previous ${windowDays} days` };
  }, [breakdown, windowDays]);

  /** The category that moved most in rupees. The one thing worth saying. */
  const biggestMover = useMemo(() => {
    if (!breakdown) return null;
    const withPrior = breakdown.categories.filter((c) => c.previousAmount !== null);
    if (withPrior.length === 0) return null;
    return withPrior.reduce((best, c) =>
      Math.abs(c.amount - (c.previousAmount ?? 0)) > Math.abs(best.amount - (best.previousAmount ?? 0))
        ? c
        : best,
    );
  }, [breakdown]);

  const merchantsIn = (category: SpendCategory) =>
    breakdown?.merchants.filter((m) => m.category === category) ?? [];

  return (
    <View style={styles.container}>
      <ScreenHeader title="Spend Insights" onBack={onBack} />

      <View style={styles.windowRow}>
        {WINDOWS.map((w) => {
          const isActive = w.days === windowDays;
          return (
            <PressableScale
              key={w.days}
              style={[styles.windowPill, isActive && styles.windowPillActive]}
              onPress={() => {
                setWindowDays(w.days);
                setOpenCategory(null);
              }}
            >
              <Text style={[styles.windowText, isActive && styles.windowTextActive]}>
                {w.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {!breakdown || breakdown.totalSpend === 0 ? (
          <EmptyState
            icon="📊"
            title="Nothing spent in this window"
            body={`Your statement records no outgoing payments in the last ${windowDays} days.`}
            hint="Try a longer window, or import a statement that covers a more recent period."
          />
        ) : (
          <>
            <FadeIn style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total spend · last {windowDays} days</Text>
              <Rupee amount={breakdown.totalSpend} style={typography.display} showPrefix={false} />
              {changeLabel && (
                <Text
                  style={[styles.changeText, changeLabel.up ? styles.changeUp : styles.changeDown]}
                >
                  {changeLabel.up ? '▲' : '▼'} {changeLabel.text}
                </Text>
              )}

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaValue}>{breakdown.txnCount}</Text>
                  <Text style={styles.metaLabel}>payments</Text>
                </View>
                <View style={styles.metaDivider} />
                <View style={styles.metaItem}>
                  <Text style={styles.metaValue}>{money(breakdown.dailyAverage)}</Text>
                  <Text style={styles.metaLabel}>a day</Text>
                </View>
                <View style={styles.metaDivider} />
                <View style={styles.metaItem}>
                  <Text style={styles.metaValue}>{money(breakdown.largest?.amount ?? 0)}</Text>
                  <Text style={styles.metaLabel}>largest</Text>
                </View>
              </View>
            </FadeIn>

            <FadeIn delay={60} style={styles.trendCard}>
              <Text style={styles.sectionTitle}>Daily outflow</Text>
              <Sparkline
                values={breakdown.daily.map((d) => d.amount)}
                color={t.accent}
                height={52}
              />
              <View style={styles.trendAxis}>
                <Text style={styles.trendAxisText}>
                  {formatIstDate(breakdown.periodFrom)}
                </Text>
                <Text style={styles.trendAxisText}>{formatIstDate(breakdown.periodTo)}</Text>
              </View>
            </FadeIn>

            {biggestMover && biggestMover.previousAmount !== null && (
              <FadeIn delay={90} style={styles.insightCard}>
                <Text style={styles.insightIcon}>
                  {biggestMover.amount > biggestMover.previousAmount ? '📈' : '📉'}
                </Text>
                <Text style={styles.insightText}>
                  <Text style={styles.insightStrong}>
                    {CATEGORY_META[biggestMover.category].label}
                  </Text>{' '}
                  moved the most:{' '}
                  {money(biggestMover.previousAmount)} → {money(biggestMover.amount)} between the
                  two windows.
                </Text>
              </FadeIn>
            )}

            <Text style={styles.sectionTitle}>Where it went</Text>

            {breakdown.categories.map((c, index) => {
              const meta = CATEGORY_META[c.category];
              const isOpen = openCategory === c.category;
              const drill = isOpen ? merchantsIn(c.category) : [];

              return (
                <FadeIn key={c.category} delay={Math.min(index * 30, 240)}>
                  <PressableScale
                    style={[styles.categoryRow, isOpen && styles.categoryRowOpen]}
                    haptic={false}
                    onPress={() => setOpenCategory(isOpen ? null : c.category)}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: `${meta.color}22` }]}>
                      <Text style={styles.categoryIconText}>{meta.icon}</Text>
                    </View>
                    <View style={styles.categoryInfo}>
                      <View style={styles.categoryTopRow}>
                        <Text style={styles.categoryLabel}>{meta.label}</Text>
                        <Rupee
                          amount={c.amount}
                          style={styles.categoryAmount}
                          showPrefix={false}
                        />
                      </View>
                      <ProgressBar
                        progress={c.pctOfTotal / 100}
                        color={meta.color}
                        height={6}
                        style={styles.categoryTrack}
                      />
                      <View style={styles.categoryTopRow}>
                        <Text style={styles.categorySub}>
                          {c.pctOfTotal}% · {c.count} payment{c.count === 1 ? '' : 's'}
                        </Text>
                        {c.changePct !== null && (
                          <Text
                            style={[
                              styles.categoryDelta,
                              c.changePct > 0 ? styles.changeUp : styles.changeDown,
                            ]}
                          >
                            {c.changePct > 0 ? '▲' : '▼'}{' '}
                            {Math.abs(Math.round(c.changePct * 100))}%
                          </Text>
                        )}
                      </View>
                    </View>
                  </PressableScale>

                  {isOpen && (
                    <FadeIn offset={-4} style={styles.drillBox}>
                      {drill.length === 0 ? (
                        <Text style={styles.drillEmpty}>
                          No single counterparty in this category is large enough to list.
                        </Text>
                      ) : (
                        drill.map((m) => (
                          <View key={m.key} style={styles.drillRow}>
                            <View style={styles.drillMeta}>
                              <Text style={styles.drillName} numberOfLines={1}>
                                {m.label}
                              </Text>
                              <Text style={styles.drillSub}>
                                {m.count}× · last {formatIstDate(m.lastSeen)}
                              </Text>
                            </View>
                            <Text style={styles.drillAmount}>{money(m.amount)}</Text>
                          </View>
                        ))
                      )}
                    </FadeIn>
                  )}
                </FadeIn>
              );
            })}

            <Text style={styles.sectionTitle}>Top counterparties</Text>
            {breakdown.merchants.slice(0, 8).map((m, index) => (
              <FadeIn key={m.key} delay={Math.min(index * 25, 200)} style={styles.merchantRow}>
                <View
                  style={[
                    styles.merchantRank,
                    { borderColor: CATEGORY_META[m.category].color },
                  ]}
                >
                  <Text style={styles.merchantRankText}>{index + 1}</Text>
                </View>
                <View style={styles.drillMeta}>
                  <Text style={styles.drillName} numberOfLines={1}>
                    {m.label}
                  </Text>
                  <Text style={styles.drillSub}>
                    {CATEGORY_META[m.category].label} · {m.count} payment
                    {m.count === 1 ? '' : 's'}
                  </Text>
                </View>
                <Text style={styles.drillAmount}>{money(m.amount)}</Text>
              </FadeIn>
            ))}

            <Text style={styles.footnote}>
              Categories come from the narration your bank wrote. Anything we could not name
              sits in “Other merchants” rather than being guessed at.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  windowRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  windowPill: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  windowPillActive: { borderColor: t.warn, backgroundColor: '#262010' },
  windowText: { color: t.textDim, fontSize: 12, fontWeight: '600' },
  windowTextActive: { color: t.warn, fontWeight: '700' },

  content: { flex: 1 },
  scrollContent: { padding: space.md, paddingBottom: 48 },

  totalCard: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  totalLabel: { ...typography.caption, marginBottom: 4 },
  changeText: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  changeUp: { color: t.danger },
  changeDown: { color: t.ok },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.md,
    borderTopWidth: 1,
    borderTopColor: t.border,
    paddingTop: space.sm,
  },
  metaItem: { flex: 1, alignItems: 'center' },
  metaDivider: { width: 1, height: 24, backgroundColor: t.border },
  metaValue: {
    color: t.text,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metaLabel: { color: t.textFaint, fontSize: 10, marginTop: 1 },

  trendCard: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.md,
  },
  trendAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  trendAxisText: { color: t.textFaint, fontSize: 10 },

  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#121A26',
    borderColor: t.accent,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.md,
  },
  insightIcon: { fontSize: 18, marginRight: space.sm },
  insightText: { flex: 1, color: t.textDim, fontSize: 12, lineHeight: 18 },
  insightStrong: { color: t.text, fontWeight: '700' },

  sectionTitle: {
    color: t.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: space.lg,
    marginBottom: space.sm,
  },

  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
  },
  categoryRowOpen: { backgroundColor: t.surface },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  categoryIconText: { fontSize: 16 },
  categoryInfo: { flex: 1 },
  categoryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryLabel: { color: t.text, fontSize: 13, fontWeight: '600' },
  categoryAmount: {
    color: t.text,
    fontSize: 14,
    fontWeight: '700',
  },
  categoryTrack: { marginVertical: 5 },
  categorySub: { color: t.textFaint, fontSize: 11 },
  categoryDelta: { fontSize: 11, fontWeight: '700' },

  drillBox: {
    backgroundColor: t.surface,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    marginBottom: space.xs,
  },
  drillEmpty: { color: t.textFaint, fontSize: 11, paddingVertical: space.sm },
  drillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: t.border,
  },
  drillMeta: { flex: 1, marginRight: space.sm },
  drillName: { color: t.text, fontSize: 12, fontWeight: '600' },
  drillSub: { color: t.textFaint, fontSize: 10, marginTop: 1 },
  drillAmount: {
    color: t.text,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  merchantRank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  merchantRankText: { color: t.textDim, fontSize: 11, fontWeight: '800' },

  footnote: {
    color: t.textFaint,
    fontSize: 11,
    lineHeight: 17,
    marginTop: space.lg,
  },
});
