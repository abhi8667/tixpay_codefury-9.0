import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';
import { ScreenHeader } from '../components/ScreenHeader';
import { FadeIn, PressableScale, ProgressBar, money } from '../components/motion';
import { useAppStore, type TransferResult } from '../../store/useAppStore';
import { formatIstDate } from '@tixpay/engine';

interface GoalsScreenProps {
  onBack?: () => void;
}

const QUICK_AMOUNTS = [500, 1000, 2500, 5000];
const PRESET_TARGETS = [25000, 50000, 100000, 200000];
/** Target-date options, in months from now. */
const HORIZONS = [6, 12, 24, 36];

/**
 * Goal-based savings, built on the Keeper jar the guard already funds sweeps
 * from. The number that used to be a fixed KEEPER_GOAL is now something the
 * user names, sets a target date for, and moves any amount into — and the "are
 * you on track" answer comes from the account's actual trailing surplus, not an
 * assumed savings rate.
 */
export const GoalsScreen: React.FC<GoalsScreenProps> = ({ onBack }) => {
  const keeperBalance = useAppStore((s) => s.keeperBalance);
  const keeperTxns = useAppStore((s) => s.keeperTxns);
  const goalLabel = useAppStore((s) => s.goalLabel);
  const goalTargetAmount = useAppStore((s) => s.goalTargetAmount);
  const goalTargetDate = useAppStore((s) => s.goalTargetDate);
  const setGoal = useAppStore((s) => s.setGoal);
  const goalStatus = useAppStore((s) => s.goalStatus);
  const addToKeeper = useAppStore((s) => s.addToKeeper);
  const withdrawFromKeeper = useAppStore((s) => s.withdrawFromKeeper);
  const ledger = useAppStore((s) => s.ledger());
  const now = useAppStore((s) => s.now);
  const pipelineCache = useAppStore((s) => s._pipelineCache);

  const [editing, setEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState(goalLabel);
  const [amountStr, setAmountStr] = useState('500');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  /**
   * One timer, cleared on every new flash and on unmount.
   *
   * The previous version called `setTimeout` per flash with no handle. Tapping
   * twice inside the window meant the FIRST timer cleared the SECOND message,
   * so the confirmation for a move that had succeeded vanished after a few
   * hundred milliseconds and the screen looked like it had rejected the tap.
   */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (result: TransferResult) => {
    if (timer.current) clearTimeout(timer.current);
    setNotice({ ok: result.ok, text: result.message });
    timer.current = setTimeout(() => setNotice(null), 2600);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const status = useMemo(
    () => goalStatus(),
    [goalStatus, pipelineCache, keeperBalance, goalTargetAmount, goalTargetDate],
  );

  const accountBalance = ledger?.currentBalance ?? 0;
  const pct = Math.min(1, Math.max(0, status?.pct ?? 0));
  const amountVal = parseFloat(amountStr) || 0;

  const handleAdd = () => flash(addToKeeper(amountVal));
  const handleWithdraw = () => flash(withdrawFromKeeper(amountVal));

  const saveLabel = () => {
    setGoal(labelDraft.trim() || 'Savings goal', goalTargetAmount, goalTargetDate);
    setEditing(false);
  };

  const setHorizonMonths = (months: number) => {
    const target = new Date(now.getTime());
    target.setUTCMonth(target.getUTCMonth() + months);
    setGoal(goalLabel, goalTargetAmount, target);
  };

  const monthsToTarget = (months: number): boolean => {
    if (!goalTargetDate) return false;
    const candidate = new Date(now.getTime());
    candidate.setUTCMonth(candidate.getUTCMonth() + months);
    return Math.abs(candidate.getTime() - goalTargetDate.getTime()) < 36e5 * 24;
  };

  const history = keeperTxns.slice(0, 6);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Goals" onBack={onBack} subtitle={goalLabel} />

      {notice && (
        <FadeIn offset={-6} style={[styles.notice, notice.ok ? styles.noticeOk : styles.noticeBad]}>
          <Text style={[styles.noticeText, notice.ok ? styles.noticeTextOk : styles.noticeTextBad]}>
            {notice.text}
          </Text>
        </FadeIn>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <FadeIn style={styles.jarSection}>
          <View style={styles.jarGlowContainer}>
            <Text style={styles.jarEmojiLarge}>🎯</Text>
          </View>

          {editing ? (
            <View style={styles.editRow}>
              <TextInput
                value={labelDraft}
                onChangeText={setLabelDraft}
                style={styles.labelInput}
                placeholder="Goal name"
                placeholderTextColor={t.textFaint}
                autoFocus
                onSubmitEditing={saveLabel}
              />
              <PressableScale onPress={saveLabel} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save</Text>
              </PressableScale>
            </View>
          ) : (
            <PressableScale onPress={() => setEditing(true)} haptic={false}>
              <Text style={styles.goalLabel}>{goalLabel} ✎</Text>
            </PressableScale>
          )}

          <Rupee amount={keeperBalance} style={typography.display} showPrefix={false} animate />
          <Text style={styles.ofTarget}>of {money(goalTargetAmount)}</Text>

          <ProgressBar progress={pct} style={styles.progress} />
          <Text style={styles.pctText}>{Math.round(pct * 100)}% of goal</Text>
        </FadeIn>

        {/* ── Move money ───────────────────────────────────────────────── */}
        <FadeIn delay={60} style={styles.card}>
          <Text style={styles.cardTitle}>Move money</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountSymbol}>₹</Text>
            <TextInput
              value={amountStr}
              onChangeText={(v) => setAmountStr(v.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric"
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={t.textFaint}
            />
          </View>

          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map((amt) => (
              <PressableScale
                key={amt}
                style={[styles.quickChip, amountStr === String(amt) && styles.quickChipActive]}
                onPress={() => setAmountStr(String(amt))}
              >
                <Text
                  style={[
                    styles.quickChipText,
                    amountStr === String(amt) && styles.quickChipTextActive,
                  ]}
                >
                  {money(amt)}
                </Text>
              </PressableScale>
            ))}
          </View>

          <View style={styles.ctaRow}>
            <PressableScale
              style={[styles.addMoneyBtn, amountVal > accountBalance && styles.btnDisabled]}
              onPress={handleAdd}
              disabled={amountVal <= 0}
            >
              <Text style={styles.addMoneyText}>Add to goal</Text>
            </PressableScale>
            <PressableScale
              style={[styles.withdrawBtn, keeperBalance < amountVal && styles.btnDisabled]}
              onPress={handleWithdraw}
              disabled={amountVal <= 0}
            >
              <Text style={styles.withdrawText}>Take out</Text>
            </PressableScale>
          </View>

          <Text style={styles.availableNote}>
            Account balance {money(accountBalance)} · goal holds {money(keeperBalance)}
          </Text>
        </FadeIn>

        {/* ── Target ───────────────────────────────────────────────────── */}
        <FadeIn delay={110} style={styles.card}>
          <Text style={styles.cardTitle}>Target</Text>
          <View style={styles.pillRow}>
            {PRESET_TARGETS.map((amt) => (
              <PressableScale
                key={amt}
                style={[styles.pill, goalTargetAmount === amt && styles.pillActive]}
                onPress={() => setGoal(goalLabel, amt, goalTargetDate)}
              >
                <Text
                  style={[styles.pillText, goalTargetAmount === amt && styles.pillTextActive]}
                >
                  ₹{(amt / 1000).toFixed(0)}k
                </Text>
              </PressableScale>
            ))}
          </View>

          <Text style={[styles.cardTitle, styles.cardTitleSpaced]}>By when</Text>
          <View style={styles.pillRow}>
            {HORIZONS.map((months) => (
              <PressableScale
                key={months}
                style={[styles.pill, monthsToTarget(months) && styles.pillActive]}
                onPress={() => setHorizonMonths(months)}
              >
                <Text style={[styles.pillText, monthsToTarget(months) && styles.pillTextActive]}>
                  {months}m
                </Text>
              </PressableScale>
            ))}
            <PressableScale
              style={[styles.pill, goalTargetDate === null && styles.pillActive]}
              onPress={() => setGoal(goalLabel, goalTargetAmount, null)}
            >
              <Text style={[styles.pillText, goalTargetDate === null && styles.pillTextActive]}>
                No date
              </Text>
            </PressableScale>
          </View>
          {goalTargetDate ? (
            <Text style={styles.availableNote}>
              Aiming for {formatIstDate(goalTargetDate, true)}
            </Text>
          ) : null}
        </FadeIn>

        {/* ── Are you on track ─────────────────────────────────────────── */}
        {status && (
          <FadeIn delay={160}>
            <View
              style={[
                styles.projectionCard,
                status.onTrack ? styles.onTrackCard : styles.offTrackCard,
              ]}
            >
              <Text style={styles.projectionIcon}>{status.onTrack ? '✓' : '⚠️'}</Text>
              <View style={styles.projectionInfo}>
                <Text
                  style={[
                    styles.projectionTitle,
                    status.onTrack ? styles.onTrackText : styles.offTrackText,
                  ]}
                >
                  {status.onTrack ? "You're on track" : 'Off track at your current savings rate'}
                </Text>
                <Text style={styles.projectionSub}>
                  {status.avgMonthlySurplus > 0
                    ? `Saving about ${money(status.avgMonthlySurplus)} a month, measured from your statement`
                    : 'No positive monthly surplus detected in your statement'}
                </Text>
                {status.projectedCompletionDate && (
                  <Text style={styles.projectionSub}>
                    On this rate you reach {money(goalTargetAmount)} by{' '}
                    {formatIstDate(status.projectedCompletionDate, true)}
                  </Text>
                )}
                {status.suggestedMonthlyContribution ? (
                  <Text style={styles.projectionSub}>
                    Hitting your date needs {money(status.suggestedMonthlyContribution)} a month.
                  </Text>
                ) : null}
              </View>
            </View>
          </FadeIn>
        )}

        {/* ── Jar history ──────────────────────────────────────────────── */}
        <FadeIn delay={200} style={styles.card}>
          <Text style={styles.cardTitle}>Activity</Text>
          {history.map((entry) => (
            <View key={entry.id} style={styles.historyRow}>
              <View style={styles.historyMeta}>
                <Text style={styles.historyLabel}>{entry.label}</Text>
                <Text style={styles.historyDate}>{formatIstDate(entry.date)}</Text>
              </View>
              <Text
                style={[
                  styles.historyAmount,
                  entry.amount < 0 ? styles.historyOut : styles.historyIn,
                ]}
              >
                {entry.amount < 0 ? '−' : '+'}
                {money(entry.amount)}
              </Text>
            </View>
          ))}
        </FadeIn>

        <FadeIn delay={240} style={styles.bannerCard}>
          <Text style={styles.bannerIcon}>🛟</Text>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerTitle}>Also your bounce buffer</Text>
            <Text style={styles.bannerSub}>
              This is the same jar Keeper sweeps draw from — funding your goal doubles as your
              safety net.
            </Text>
          </View>
        </FadeIn>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  notice: {
    borderBottomWidth: 1,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  noticeOk: { backgroundColor: '#0A261C', borderBottomColor: t.ok },
  noticeBad: { backgroundColor: '#261214', borderBottomColor: t.danger },
  noticeText: { fontSize: 13, fontWeight: '600' },
  noticeTextOk: { color: t.ok },
  noticeTextBad: { color: t.danger },
  content: { flex: 1 },
  scrollContent: { padding: space.md, paddingBottom: 48 },

  jarSection: { alignItems: 'center', marginTop: space.sm },
  jarGlowContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.warn,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  jarEmojiLarge: { fontSize: 44 },
  goalLabel: { ...typography.caption, marginBottom: 4, fontSize: 14 },
  ofTarget: { color: t.textDim, fontSize: 13, marginTop: 2 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 4 },
  labelInput: {
    color: t.text,
    fontSize: 14,
    borderBottomWidth: 1,
    borderBottomColor: t.warn,
    paddingVertical: 2,
    minWidth: 150,
  },
  saveBtn: {
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    backgroundColor: t.warn,
    borderRadius: radius.sm,
  },
  saveBtnText: { color: '#000', fontSize: 12, fontWeight: '700' },
  progress: { width: '100%', marginTop: space.md },
  pctText: { ...typography.caption, marginTop: space.xs },

  card: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.md,
  },
  cardTitle: {
    color: t.textDim,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: space.sm,
  },
  cardTitleSpaced: { marginTop: space.md },

  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  amountSymbol: { color: t.textDim, fontSize: 24, fontWeight: '700', marginRight: 2 },
  amountInput: {
    color: t.text,
    fontSize: 30,
    fontWeight: '800',
    minWidth: 90,
    textAlign: 'center',
    padding: 0,
    fontVariant: ['tabular-nums'],
  },
  quickRow: {
    flexDirection: 'row',
    gap: space.xs,
    justifyContent: 'center',
    marginTop: space.sm,
  },
  quickChip: {
    backgroundColor: t.surfaceHi,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: space.sm,
    paddingVertical: 5,
  },
  quickChipActive: { backgroundColor: t.warn, borderColor: t.warn },
  quickChipText: { color: t.textDim, fontSize: 12, fontWeight: '600' },
  quickChipTextActive: { color: '#000000', fontWeight: '800' },

  ctaRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  addMoneyBtn: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: t.warn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoneyText: { color: '#000000', fontSize: 15, fontWeight: '700' },
  withdrawBtn: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdrawText: { color: t.text, fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.45 },
  availableNote: { color: t.textFaint, fontSize: 11, marginTop: space.sm, textAlign: 'center' },

  pillRow: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surfaceHi,
  },
  pillActive: { borderColor: t.warn, backgroundColor: '#262010' },
  pillText: { color: t.textDim, fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: t.warn, fontWeight: '700' },

  projectionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.md,
  },
  onTrackCard: { backgroundColor: '#0A261C', borderColor: t.ok },
  offTrackCard: { backgroundColor: '#262010', borderColor: t.warn },
  projectionIcon: { fontSize: 18, marginRight: space.sm },
  projectionInfo: { flex: 1 },
  projectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  onTrackText: { color: t.ok },
  offTrackText: { color: t.warn },
  projectionSub: { color: t.textDim, fontSize: 12, marginTop: 2, lineHeight: 17 },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: t.border,
  },
  historyMeta: { flex: 1 },
  historyLabel: { color: t.text, fontSize: 13, fontWeight: '600' },
  historyDate: { color: t.textFaint, fontSize: 11, marginTop: 1 },
  historyAmount: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  historyIn: { color: t.ok },
  historyOut: { color: t.textDim },

  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.md,
  },
  bannerIcon: { fontSize: 22, marginRight: space.sm },
  bannerInfo: { flex: 1 },
  bannerTitle: { color: t.text, fontSize: 14, fontWeight: '700' },
  bannerSub: { color: t.textDim, fontSize: 12, marginTop: 2, lineHeight: 17 },
});
