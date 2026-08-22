import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';
import { useAppStore } from '../../store/useAppStore';
import type { SpendCategory } from '@tixpay/engine';

interface SpendInsightsScreenProps {
  onBack?: () => void;
}

const CATEGORY_META: Record<SpendCategory, { label: string; icon: string; color: string }> = {
  EMI: { label: 'EMI', icon: '🏦', color: t.danger },
  SIP: { label: 'SIP & Investments', icon: '📈', color: t.accent },
  INSURANCE: { label: 'Insurance', icon: '🛡️', color: t.warn },
  UTILITY: { label: 'Utilities', icon: '💡', color: t.warn },
  OTT: { label: 'Subscriptions', icon: '🎬', color: t.accent },
  FOOD: { label: 'Food & Dining', icon: '🍔', color: '#F0553D' },
  SHOPPING: { label: 'Shopping', icon: '🛍️', color: '#5B8DEF' },
  TRAVEL: { label: 'Travel & Transport', icon: '🚕', color: '#2DD4A0' },
  GROCERIES: { label: 'Groceries', icon: '🛒', color: '#F5A524' },
  TRANSFER: { label: 'Transfers', icon: '↔️', color: t.textDim },
  OTHER: { label: 'Other', icon: '•••', color: t.textDim },
};

const WINDOWS = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

/**
 * "Transforms complex financial data into clear, personalized, actionable
 * insights" — the theme brief, applied to the same categorised transactions
 * the mandate detector already reads. No new ingestion, just a different lens
 * on the one statement the user imported.
 */
export const SpendInsightsScreen: React.FC<SpendInsightsScreenProps> = ({ onBack }) => {
  const [windowDays, setWindowDays] = useState(30);
  const spendBreakdown = useAppStore((s) => s.spendBreakdown);
  const pipelineCache = useAppStore((s) => s._pipelineCache);

  const breakdown = useMemo(() => spendBreakdown(windowDays), [spendBreakdown, windowDays, pipelineCache]);

  const changeLabel = useMemo(() => {
    if (!breakdown || breakdown.changePct === null) return null;
    const pct = Math.round(breakdown.changePct * 1000) / 10;
    const up = pct > 0;
    return { up, text: `${up ? '+' : ''}${pct}% vs previous ${windowDays} days` };
  }, [breakdown, windowDays]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Spend Insights</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.windowRow}>
        {WINDOWS.map((w) => {
          const isActive = w.days === windowDays;
          return (
            <TouchableOpacity
              key={w.days}
              style={[styles.windowPill, isActive && styles.windowPillActive]}
              onPress={() => setWindowDays(w.days)}
            >
              <Text style={[styles.windowText, isActive && styles.windowTextActive]}>{w.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {!breakdown || breakdown.totalSpend === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No spend recorded in this window.</Text>
          </View>
        ) : (
          <>
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total spend · last {windowDays} days</Text>
              <Rupee amount={breakdown.totalSpend} style={typography.display} showPrefix={false} />
              {changeLabel && (
                <Text style={[styles.changeText, changeLabel.up ? styles.changeUp : styles.changeDown]}>
                  {changeLabel.up ? '▲' : '▼'} {changeLabel.text}
                </Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>By category</Text>

            {breakdown.categories.map((c) => {
              const meta = CATEGORY_META[c.category];
              return (
                <View key={c.category} style={styles.categoryRow}>
                  <View style={[styles.categoryIcon, { backgroundColor: `${meta.color}22` }]}>
                    <Text style={styles.categoryIconText}>{meta.icon}</Text>
                  </View>
                  <View style={styles.categoryInfo}>
                    <View style={styles.categoryTopRow}>
                      <Text style={styles.categoryLabel}>{meta.label}</Text>
                      <Rupee amount={c.amount} style={styles.categoryAmount} showPrefix={false} />
                    </View>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${c.pctOfTotal}%`, backgroundColor: meta.color }]} />
                    </View>
                    <Text style={styles.categorySub}>
                      {c.pctOfTotal}% of spend · {c.count} transaction{c.count === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  headerRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  backBtn: { width: 32 },
  backText: { color: t.text, fontSize: 22 },
  headerTitle: { ...typography.title, fontSize: 18 },
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
  windowText: { color: t.textDim, fontSize: 13, fontWeight: '600' },
  windowTextActive: { color: t.warn, fontWeight: '700' },
  content: { flex: 1 },
  scrollContent: { padding: space.md, paddingBottom: 40 },
  emptyCard: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.lg,
    alignItems: 'center',
  },
  emptyText: { color: t.textDim, fontSize: 14 },
  totalCard: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.lg,
  },
  totalLabel: { ...typography.caption, marginBottom: space.xs },
  changeText: { fontSize: 13, fontWeight: '700', marginTop: space.xs },
  changeUp: { color: t.danger },
  changeDown: { color: t.ok },
  sectionTitle: { color: t.text, fontSize: 16, fontWeight: '700', marginBottom: space.sm },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
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
    marginBottom: 6,
  },
  categoryLabel: { color: t.text, fontSize: 14, fontWeight: '700' },
  categoryAmount: { color: t.text, fontSize: 14, fontWeight: '700' },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: t.surfaceHi,
    overflow: 'hidden',
    marginBottom: 4,
  },
  fill: { height: 6, borderRadius: 3 },
  categorySub: { color: t.textFaint, fontSize: 11 },
});
