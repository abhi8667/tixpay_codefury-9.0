import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';
import { ScreenHeader } from '../components/ScreenHeader';
import { FadeIn, EmptyState, money } from '../components/motion';
import { useAppStore } from '../../store/useAppStore';
import { formatIstDate } from '@tixpay/engine';
import { CATEGORY_META } from './SpendInsightsScreen';

interface SubscriptionsScreenProps {
  onBack?: () => void;
}

const CADENCE_LABEL = { MONTHLY: 'monthly', WEEKLY: 'weekly', QUARTERLY: 'quarterly' } as const;

/**
 * The subscription audit: everything charging this account on repeat, priced
 * per year.
 *
 * Annualising is the whole point. A ₹499 monthly charge does not feel like a
 * decision; ₹5,988 a year does. And the number is checkable — every row states
 * how many statement charges it was built from and when the last one landed, so
 * a reader can go and count them.
 */
export const SubscriptionsScreen: React.FC<SubscriptionsScreenProps> = ({ onBack }) => {
  const subscriptions = useAppStore((s) => s.subscriptions);
  const pipelineCache = useAppStore((s) => s._pipelineCache);
  const audit = useMemo(() => subscriptions(), [subscriptions, pipelineCache]);

  const dormantKeys = useMemo(
    () => new Set((audit?.dormant ?? []).map((c) => c.key)),
    [audit],
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Recurring charges" onBack={onBack} subtitle="What repeats, per year" />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {!audit || audit.charges.length === 0 ? (
          <EmptyState
            icon="🔁"
            title="Nothing charges you on repeat"
            body="We looked for counterparties billing this account on a weekly, monthly or quarterly rhythm and found none that repeat at least three times."
            hint="Three occurrences is the floor — a subscription that has billed twice is not yet distinguishable from a coincidence."
          />
        ) : (
          <>
            <FadeIn style={styles.heroCard}>
              <Text style={styles.heroLabel}>Committed every year</Text>
              <Rupee
                amount={audit.totalAnnual}
                style={typography.display}
                showPrefix={false}
                animate
              />
              <Text style={styles.heroSub}>
                {money(audit.totalMonthly)} a month across {audit.charges.length} recurring{' '}
                {audit.charges.length === 1 ? 'charge' : 'charges'}
              </Text>
            </FadeIn>

            {audit.dormant.length > 0 && (
              <FadeIn delay={60} style={styles.dormantCard}>
                <Text style={styles.dormantIcon}>💤</Text>
                <View style={styles.dormantInfo}>
                  <Text style={styles.dormantTitle}>
                    {audit.dormant.length} may have already stopped
                  </Text>
                  <Text style={styles.dormantSub}>
                    Nothing has been charged for more than two of their own cycles. Worth
                    checking whether they lapsed or you cancelled them —{' '}
                    {money(audit.dormant.reduce((s, c) => s + c.annualCost, 0))} a year either
                    way.
                  </Text>
                </View>
              </FadeIn>
            )}

            <Text style={styles.sectionTitle}>Every repeating charge</Text>

            {audit.charges.map((c, index) => {
              const meta = CATEGORY_META[c.category];
              const dormant = dormantKeys.has(c.key);
              return (
                <FadeIn key={c.key} delay={Math.min(index * 35, 260)}>
                  <View style={[styles.row, dormant && styles.rowDormant]}>
                    <View style={[styles.icon, { backgroundColor: `${meta.color}22` }]}>
                      <Text style={styles.iconText}>{meta.icon}</Text>
                    </View>

                    <View style={styles.meta}>
                      <View style={styles.topRow}>
                        <Text style={styles.name} numberOfLines={1}>
                          {c.label}
                        </Text>
                        <Text style={styles.annual}>{money(c.annualCost)}/yr</Text>
                      </View>
                      <Text style={styles.sub}>
                        {money(c.amount)} {CADENCE_LABEL[c.cadence]}
                        {c.cadenceAssumed ? ' (assumed)' : ` · every ${c.medianGapDays} days`}
                      </Text>

                      {c.viaAutopay && (
                        <View style={styles.autopayBadge}>
                          <Text style={styles.autopayText}>YOUR BANK CALLS THIS AN AUTOPAY</Text>
                        </View>
                      )}

                      <Text style={styles.provenance}>
                        {c.cadenceAssumed
                          ? // One row is proof of a mandate and no proof at all of a
                            // rhythm. Say which half we are standing on.
                            `Seen ${c.occurrences} time${c.occurrences === 1 ? '' : 's'} in this statement — monthly assumed, so the yearly figure is an estimate. Last ${formatIstDate(c.lastSeen)}.`
                          : `Found from ${c.occurrences} charges · ${Math.round(c.confidence * 100)}% confidence · last ${formatIstDate(c.lastSeen)}${dormant ? ' · looks dormant' : ''}`}
                      </Text>
                    </View>
                  </View>
                </FadeIn>
              );
            })}

            <Text style={styles.footnote}>
              This is a looser pass than the Mandate Hub. The guard needs a debit it can put on
              the projected curve, so it demands amounts within 5% and a tight cadence band.
              Here a gym that charges ₹1,499 one month and ₹1,650 the next still counts, because
              leaving it out of your annual total would be the bigger error.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  content: { flex: 1 },
  scrollContent: { padding: space.md, paddingBottom: 48 },

  heroCard: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    alignItems: 'center',
  },
  heroLabel: { ...typography.caption, marginBottom: 4 },
  heroSub: { color: t.textDim, fontSize: 13, marginTop: 6, textAlign: 'center' },

  dormantCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#262010',
    borderColor: t.warn,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.md,
  },
  dormantIcon: { fontSize: 20, marginRight: space.sm },
  dormantInfo: { flex: 1 },
  dormantTitle: { color: t.warn, fontSize: 14, fontWeight: '700' },
  dormantSub: { color: t.textDim, fontSize: 12, lineHeight: 18, marginTop: 3 },

  sectionTitle: {
    color: t.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: space.lg,
    marginBottom: space.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  rowDormant: { opacity: 0.55 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  iconText: { fontSize: 16 },
  meta: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: t.text, fontSize: 14, fontWeight: '600', flex: 1, marginRight: space.sm },
  annual: { color: t.warn, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sub: { color: t.textDim, fontSize: 12, marginTop: 2 },
  provenance: { color: t.textFaint, fontSize: 10, marginTop: 3, lineHeight: 15 },
  autopayBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#121A26',
    borderColor: t.accent,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 4,
  },
  autopayText: { color: t.accent, fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },

  footnote: { color: t.textFaint, fontSize: 11, lineHeight: 17, marginTop: space.lg },
});
