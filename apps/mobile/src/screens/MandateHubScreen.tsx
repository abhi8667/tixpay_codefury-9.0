import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';
import { ScreenHeader } from '../components/ScreenHeader';
import { FadeIn, PressableScale, EmptyState, money } from '../components/motion';
import { useAppStore } from '../../store/useAppStore';
import { formatIstDate } from '@tixpay/engine';
import type { Cadence, Mandate, Priority } from '@tixpay/types';

/** 'MONTHLY' reads as shouting in a list; the cadence is shown, not asserted. */
const cadenceLabel = (c: Cadence): string =>
  c === 'MONTHLY' ? 'Monthly' : c === 'WEEKLY' ? 'Weekly' : 'Quarterly';

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  CRITICAL: { label: 'Critical', color: t.danger },
  HIGH: { label: 'High', color: t.warn },
  MEDIUM: { label: 'Medium', color: t.accent },
  LOW: { label: 'Low', color: t.textDim },
};

const ORDER: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

interface MandateHubScreenProps {
  onBack?: () => void;
  onOpenSubscriptions?: () => void;
}

/**
 * Every recurring debit the detector is confident enough to project.
 *
 * Two things changed here. Rows used to toggle a pause the instant they were
 * touched — a scroll that caught a finger silently removed a debit from the
 * projection, which is the one interaction in this app that must not be
 * accidental. And with no mandates the screen rendered nothing at all, which on
 * a real statement (most personal accounts carry no NACH auto-debits) read as a
 * crash rather than as an answer.
 */
export const MandateHubScreen: React.FC<MandateHubScreenProps> = ({
  onBack,
  onOpenSubscriptions,
}) => {
  const [activeFilter, setActiveFilter] = useState<'ALL' | Priority>('ALL');
  const [detail, setDetail] = useState<Mandate | null>(null);

  const mandates = useAppStore((state) => state.mandates());
  const pausedMandateIds = useAppStore((state) => state.pausedMandateIds);
  const togglePauseMandate = useAppStore((state) => state.togglePauseMandate);
  const redactionOn = useAppStore((state) => state.redactionOn);
  const imported = useAppStore((state) => state.imported);

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: mandates.length };
    for (const p of ORDER) map[p] = mandates.filter((m) => m.priority === p).length;
    return map;
  }, [mandates]);

  const monthlyTotal = useMemo(
    () =>
      mandates
        .filter((m) => !pausedMandateIds.includes(m.id))
        .reduce(
          (sum, m) =>
            sum + m.amount * (m.cadence === 'MONTHLY' ? 1 : m.cadence === 'WEEKLY' ? 52 / 12 : 1 / 3),
          0,
        ),
    [mandates, pausedMandateIds],
  );

  const visible = useMemo(() => {
    const list = activeFilter === 'ALL' ? mandates : mandates.filter((m) => m.priority === activeFilter);
    return [...list].sort((a, b) => {
      const rank = ORDER.indexOf(a.priority) - ORDER.indexOf(b.priority);
      return rank !== 0 ? rank : a.nextDebit.getTime() - b.nextDebit.getTime();
    });
  }, [mandates, activeFilter]);

  const filters: Array<{ label: string; val: 'ALL' | Priority }> = [
    { label: `All ${counts.ALL}`, val: 'ALL' },
    ...ORDER.filter((p) => (counts[p] ?? 0) > 0).map((p) => ({
      label: `${PRIORITY_META[p].label} ${counts[p]}`,
      val: p,
    })),
  ];

  const display = (name: string) =>
    redactionOn && name.length > 8 ? `${name.slice(0, 4)}••••` : name;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Mandate Hub"
        onBack={onBack}
        subtitle={
          mandates.length > 0 ? `${money(monthlyTotal)} a month committed` : 'Recurring auto-debits'
        }
      />

      {mandates.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyWrap}>
          <EmptyState
            icon="🛡️"
            title="No auto-debits found"
            body={
              imported
                ? `We read ${imported.parsed} rows and found no counterparty billing this account on a fixed schedule with the regularity the projection needs.`
                : 'Import a statement and this fills in.'
            }
            hint="That is a real answer, not a failure — most personal UPI accounts carry no NACH or ECS mandates at all. The bounce guard simply has nothing to warn about here."
            {...(onOpenSubscriptions
              ? {
                  action: {
                    label: 'Look for repeating charges instead',
                    onPress: onOpenSubscriptions,
                  },
                }
              : {})}
          />
          <Text style={styles.emptyFootnote}>
            The Mandate Hub is deliberately strict: three occurrences, amounts within 5%, and a
            tight cadence band. Anything looser would put a debit on your projected balance that
            may never arrive, and every rupee downstream would inherit the mistake.
          </Text>
        </ScrollView>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabScroll}
            contentContainerStyle={styles.tabRow}
          >
            {filters.map((f) => {
              const isActive = activeFilter === f.val;
              return (
                <PressableScale
                  key={f.val}
                  style={[styles.tabItem, isActive && styles.activeTabItem]}
                  onPress={() => setActiveFilter(f.val)}
                  haptic={false}
                >
                  <Text style={[styles.tabText, isActive && styles.activeTabText]}>{f.label}</Text>
                </PressableScale>
              );
            })}
          </ScrollView>

          <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
            {visible.map((m, index) => {
              const isPaused = pausedMandateIds.includes(m.id);
              const prio = PRIORITY_META[m.priority];
              return (
                <FadeIn key={m.id} delay={Math.min(index * 30, 240)}>
                  <PressableScale
                    style={[styles.mandateRow, isPaused && styles.mandateRowPaused]}
                    onPress={() => setDetail(m)}
                    haptic={false}
                  >
                    <View style={[styles.logoCircle, { borderColor: prio.color }]}>
                      <Text style={[styles.logoText, { color: prio.color }]}>
                        {m.category === 'OTHER'
                          ? m.displayName.slice(0, 2).toUpperCase()
                          : m.category}
                      </Text>
                    </View>
                    <View style={styles.mandateInfo}>
                      <Text style={styles.mandateName}>{display(m.displayName)}</Text>
                      <Text style={styles.mandateMeta}>
                        {cadenceLabel(m.cadence)} · next {formatIstDate(m.nextDebit)}
                        {isPaused ? ' · PAUSED' : ''}
                      </Text>
                      <Text style={styles.provenanceText}>
                        {Math.round(m.confidence * 100)}% confidence · found from {m.occurrences}{' '}
                        statement rows
                      </Text>
                    </View>
                    <Rupee amount={m.amount} style={styles.mandateAmount} showPrefix={false} />
                  </PressableScale>
                </FadeIn>
              );
            })}

            <Text style={styles.listFootnote}>
              Tap any mandate for how it was found, and to pause it. Pausing removes the debit
              from the 30-day projection, so the curve and the bounce guard both change.
            </Text>
          </ScrollView>
        </>
      )}

      {/* ── Detail sheet ─────────────────────────────────────────────── */}
      <Modal visible={detail !== null} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.overlay}>
          <PressableScale
            style={styles.dismissArea}
            onPress={() => setDetail(null)}
            haptic={false}
          >
            <View style={styles.dismissFill} />
          </PressableScale>

          {detail && (
            <View style={styles.sheet}>
              <View style={styles.handleBar} />
              <Text style={styles.sheetTitle}>{detail.displayName}</Text>
              <Text style={styles.sheetSub}>
                {money(detail.amount)} · {cadenceLabel(detail.cadence)} · next{' '}
                {formatIstDate(detail.nextDebit, true)}
              </Text>

              <View style={styles.sheetGrid}>
                <Detail label="Priority" value={PRIORITY_META[detail.priority].label} />
                <Detail label="Category" value={detail.category} />
                <Detail
                  label="Confidence"
                  value={`${Math.round(detail.confidence * 100)}%`}
                />
                <Detail label="Occurrences" value={`${detail.occurrences} rows`} />
              </View>

              <Text style={styles.sheetExplain}>
                Detected by grouping {detail.occurrences} debits to{' '}
                <Text style={styles.sheetMono}>{detail.normalizedVpa}</Text> within 5% of{' '}
                {money(detail.amount)}, then taking the median gap between them. Confidence is
                0.6 × how many occurrences we have, plus 0.4 × how regular the gaps are.
              </Text>

              <PressableScale
                style={[
                  styles.sheetBtn,
                  pausedMandateIds.includes(detail.id) ? styles.sheetBtnResume : styles.sheetBtnPause,
                ]}
                onPress={() => {
                  togglePauseMandate(detail.id);
                  setDetail(null);
                }}
              >
                <Text style={styles.sheetBtnText}>
                  {pausedMandateIds.includes(detail.id)
                    ? 'Resume this debit'
                    : 'Pause this debit in the projection'}
                </Text>
              </PressableScale>

              <PressableScale
                style={styles.sheetCancel}
                onPress={() => setDetail(null)}
                haptic={false}
              >
                <Text style={styles.sheetCancelText}>Close</Text>
              </PressableScale>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const Detail: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.detailCell}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  emptyWrap: { paddingHorizontal: space.md, paddingBottom: 40 },
  emptyFootnote: {
    color: t.textFaint,
    fontSize: 11,
    lineHeight: 17,
    marginTop: space.md,
    textAlign: 'center',
  },

  tabScroll: { maxHeight: 52, flexGrow: 0 },
  tabRow: {
    flexDirection: 'row',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  tabItem: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.lg,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
  },
  activeTabItem: { backgroundColor: '#262010', borderColor: t.warn },
  tabText: { color: t.textDim, fontSize: 12, fontWeight: '600' },
  activeTabText: { color: t.warn, fontWeight: '700' },

  content: { flex: 1 },
  scrollContent: { paddingHorizontal: space.md, paddingBottom: 48 },

  mandateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  mandateRowPaused: { borderColor: t.ok, backgroundColor: '#0A1F18', opacity: 0.85 },
  logoCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    backgroundColor: t.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  logoText: { fontSize: 9, fontWeight: '900' },
  mandateInfo: { flex: 1, marginRight: space.sm },
  mandateName: { color: t.text, fontSize: 14, fontWeight: '700' },
  mandateMeta: { color: t.textDim, fontSize: 11, marginTop: 2 },
  provenanceText: { color: t.textFaint, fontSize: 10, marginTop: 2 },
  mandateAmount: {
    color: t.text,
    fontSize: 16,
    fontWeight: '800',
  },
  listFootnote: { color: t.textFaint, fontSize: 11, lineHeight: 17, marginTop: space.sm },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  dismissArea: { flex: 1 },
  dismissFill: { flex: 1 },
  sheet: {
    backgroundColor: t.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: 1,
    borderColor: t.border,
    padding: space.md,
    paddingBottom: space.lg,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.textFaint,
    alignSelf: 'center',
    marginBottom: space.md,
  },
  sheetTitle: { ...typography.title },
  sheetSub: { color: t.textDim, fontSize: 13, marginTop: 2 },
  sheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: space.md,
    backgroundColor: t.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border,
    padding: space.sm,
  },
  detailCell: { width: '50%', paddingVertical: 6, paddingHorizontal: space.xs },
  detailLabel: { color: t.textFaint, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { color: t.text, fontSize: 14, fontWeight: '700', marginTop: 2 },
  sheetExplain: { color: t.textDim, fontSize: 12, lineHeight: 18, marginTop: space.md },
  sheetMono: { color: t.text, fontWeight: '600' },
  sheetBtn: {
    marginTop: space.md,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnPause: { backgroundColor: t.warn },
  sheetBtnResume: { backgroundColor: t.ok },
  sheetBtnText: { color: '#000000', fontSize: 15, fontWeight: '800' },
  sheetCancel: { alignItems: 'center', paddingVertical: space.sm, marginTop: space.xs },
  sheetCancelText: { color: t.textDim, fontSize: 13, fontWeight: '600' },
});
