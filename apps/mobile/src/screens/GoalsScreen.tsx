import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';
import { useAppStore } from '../../store/useAppStore';
import { formatIstDate } from '@tixpay/engine';

interface GoalsScreenProps {
  onBack?: () => void;
}

const STEP = 500;
const PRESET_TARGETS = [25000, 50000, 100000, 200000];

/**
 * Goal-based savings, built on the Keeper jar the guard already funds sweeps
 * from. The number that used to be a fixed KEEPER_GOAL is now something the
 * user names and sets a date for, and the "are you on track" answer comes
 * from the account's actual trailing surplus — not an assumed savings rate.
 */
export const GoalsScreen: React.FC<GoalsScreenProps> = ({ onBack }) => {
  const keeperBalance = useAppStore((s) => s.keeperBalance);
  const goalLabel = useAppStore((s) => s.goalLabel);
  const goalTargetAmount = useAppStore((s) => s.goalTargetAmount);
  const goalTargetDate = useAppStore((s) => s.goalTargetDate);
  const setGoal = useAppStore((s) => s.setGoal);
  const goalStatus = useAppStore((s) => s.goalStatus);
  const addToKeeper = useAppStore((s) => s.addToKeeper);
  const withdrawFromKeeper = useAppStore((s) => s.withdrawFromKeeper);
  const ledger = useAppStore((s) => s.ledger());
  const pipelineCache = useAppStore((s) => s._pipelineCache);

  const [editing, setEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState(goalLabel);
  const [notice, setNotice] = useState<string | null>(null);

  const status = useMemo(() => goalStatus(), [goalStatus, pipelineCache, keeperBalance, goalTargetAmount, goalTargetDate]);

  const accountBalance = ledger?.currentBalance ?? 0;
  const pct = Math.round((status?.pct ?? 0) * 100);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2200);
  };

  const handleAdd = () => {
    if (accountBalance < STEP) {
      flash('Not enough in your account to move ₹500 across.');
      return;
    }
    addToKeeper(STEP);
    flash(`₹${STEP} moved into your goal.`);
  };

  const handleWithdraw = () => {
    if (keeperBalance < STEP) {
      flash('This goal does not hold ₹500 yet.');
      return;
    }
    withdrawFromKeeper(STEP);
    flash(`₹${STEP} moved back to your account.`);
  };

  const saveLabel = () => {
    setGoal(labelDraft.trim() || 'Savings goal', goalTargetAmount, goalTargetDate);
    setEditing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Goals</Text>
        <View style={styles.backBtn} />
      </View>

      {notice && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.jarSection}>
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
              />
              <TouchableOpacity onPress={saveLabel} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.goalLabel}>{goalLabel} ✎</Text>
            </TouchableOpacity>
          )}

          <Rupee amount={goalTargetAmount} style={typography.display} showPrefix={false} />

          <View style={styles.progressRow}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.min(pct, 100)}%` }]} />
            </View>
            <Text style={styles.pctText}>{pct}% of goal</Text>
          </View>
        </View>

        <View style={styles.targetRow}>
          {PRESET_TARGETS.map((amt) => (
            <TouchableOpacity
              key={amt}
              style={[styles.targetPill, goalTargetAmount === amt && styles.targetPillActive]}
              onPress={() => setGoal(goalLabel, amt, goalTargetDate)}
            >
              <Text style={[styles.targetPillText, goalTargetAmount === amt && styles.targetPillTextActive]}>
                ₹{(amt / 1000).toFixed(0)}k
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Saved</Text>
            <Rupee amount={keeperBalance} style={styles.statVal} showPrefix={false} />
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Left to goal</Text>
            <Rupee amount={Math.max(0, goalTargetAmount - keeperBalance)} style={styles.statVal} showPrefix={false} />
          </View>
        </View>

        {status && (
          <View style={[styles.projectionCard, status.onTrack ? styles.onTrackCard : styles.offTrackCard]}>
            <Text style={styles.projectionIcon}>{status.onTrack ? '✓' : '⚠️'}</Text>
            <View style={styles.projectionInfo}>
              <Text style={[styles.projectionTitle, status.onTrack ? styles.onTrackText : styles.offTrackText]}>
                {status.onTrack ? "You're on track" : 'Off track at your current savings rate'}
              </Text>
              <Text style={styles.projectionSub}>
                {status.avgMonthlySurplus > 0
                  ? `Saving ~₹${Math.round(status.avgMonthlySurplus).toLocaleString('en-IN')}/mo from your account`
                  : 'No positive monthly surplus detected in your statement'}
              </Text>
              {status.projectedCompletionDate && (
                <Text style={styles.projectionSub}>
                  Projected to hit goal by {formatIstDate(status.projectedCompletionDate, true)}
                </Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.ctaRow}>
          <TouchableOpacity style={styles.addMoneyBtn} onPress={handleAdd} activeOpacity={0.8}>
            <Text style={styles.addMoneyText}>+ Add ₹{STEP}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.withdrawBtn, keeperBalance < STEP && styles.btnDisabled]}
            onPress={handleWithdraw}
            activeOpacity={0.8}
          >
            <Text style={styles.withdrawText}>Withdraw ₹{STEP}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bannerCard}>
          <Text style={styles.bannerIcon}>🛟</Text>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerTitle}>Also your bounce buffer</Text>
            <Text style={styles.bannerSub}>
              This is the same jar Keeper sweeps draw from — funding your goal doubles as your safety net.
            </Text>
          </View>
        </View>
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
  notice: {
    backgroundColor: t.surfaceHi,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  noticeText: { color: t.warn, fontSize: 13, fontWeight: '600' },
  content: { flex: 1 },
  scrollContent: { padding: space.md, paddingBottom: 40 },
  jarSection: { alignItems: 'center', marginTop: space.md },
  jarGlowContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.warn,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  jarEmojiLarge: { fontSize: 52 },
  goalLabel: { ...typography.caption, marginBottom: 2, fontSize: 14 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 4 },
  labelInput: {
    color: t.text,
    fontSize: 14,
    borderBottomWidth: 1,
    borderBottomColor: t.warn,
    paddingVertical: 2,
    minWidth: 140,
  },
  saveBtn: { paddingHorizontal: space.sm, paddingVertical: 4, backgroundColor: t.warn, borderRadius: radius.sm },
  saveBtnText: { color: '#000', fontSize: 12, fontWeight: '700' },
  progressRow: { width: '100%', marginTop: space.md, alignItems: 'center' },
  track: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: t.surfaceHi,
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: 4, backgroundColor: t.warn },
  pctText: { ...typography.caption, marginTop: space.xs },
  targetRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md, justifyContent: 'center' },
  targetPill: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  targetPillActive: { borderColor: t.warn, backgroundColor: '#262010' },
  targetPillText: { color: t.textDim, fontSize: 12, fontWeight: '600' },
  targetPillTextActive: { color: t.warn, fontWeight: '700' },
  statRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  statBox: {
    flex: 1,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  statLabel: { ...typography.caption, marginBottom: 4 },
  statVal: { color: t.text, fontSize: 20, fontWeight: '700' },
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
  projectionSub: { color: t.textDim, fontSize: 12, marginTop: 2 },
  ctaRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  addMoneyBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: t.warn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoneyText: { color: '#000000', fontSize: 15, fontWeight: '700' },
  withdrawBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  withdrawText: { color: t.text, fontSize: 15, fontWeight: '700' },
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
