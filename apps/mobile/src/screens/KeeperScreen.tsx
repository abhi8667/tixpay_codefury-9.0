import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';
import { useAppStore, KEEPER_GOAL } from '../../store/useAppStore';
import { formatIstDate } from '@tixpay/engine';

interface KeeperScreenProps {
  onBack?: () => void;
}

const STEP = 500;

/**
 * The Keeper is the account a SWEEP intervention actually draws from.
 *
 * This screen used to be a static mockup — every figure a literal, every button
 * inert, and a goal date in 2025 while the app ran in 2026. Wiring it to the
 * store turns a dead tab into the other half of the headline loop: when the
 * guard says "move ₹4,500 in", the money visibly leaves this jar, and the
 * rescued curve is funded rather than asserted.
 */
export const KeeperScreen: React.FC<KeeperScreenProps> = ({ onBack }) => {
  const keeperBalance = useAppStore((s) => s.keeperBalance);
  const keeperTxns = useAppStore((s) => s.keeperTxns);
  const progress = useAppStore((s) => s.keeperProgress());
  const addToKeeper = useAppStore((s) => s.addToKeeper);
  const withdrawFromKeeper = useAppStore((s) => s.withdrawFromKeeper);
  const ledger = useAppStore((s) => s.ledger());

  const [notice, setNotice] = useState<string | null>(null);

  const accountBalance = ledger?.currentBalance ?? 0;
  const remaining = Math.max(0, KEEPER_GOAL - keeperBalance);
  const pct = Math.round(progress * 100);

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
    flash(`₹${STEP} moved into your Keeper.`);
  };

  const handleWithdraw = () => {
    if (keeperBalance < STEP) {
      flash('Your Keeper does not hold ₹500 yet.');
      return;
    }
    withdrawFromKeeper(STEP);
    flash(`₹${STEP} moved back to your account.`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Keeper</Text>
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
            <Text style={styles.jarEmojiLarge}>🏺</Text>
          </View>

          <Text style={styles.goalLabel}>Goal</Text>
          <Rupee amount={KEEPER_GOAL} style={typography.display} showPrefix={false} />

          <View style={styles.progressRow}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.min(pct, 100)}%` }]} />
            </View>
            <Text style={styles.pctText}>{pct}% of goal</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Keeper Balance</Text>
            <Rupee amount={keeperBalance} style={styles.statVal} showPrefix={false} />
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Left to Goal</Text>
            <Rupee amount={remaining} style={styles.statVal} showPrefix={false} />
          </View>
        </View>

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
            <Text style={styles.bannerTitle}>This is your bounce buffer</Text>
            <Text style={styles.bannerSub}>
              When the guard proposes a sweep, it comes from here.
            </Text>
          </View>
        </View>

        <View style={styles.txHeader}>
          <Text style={styles.txTitle}>Keeper Activity</Text>
          <Text style={styles.txCount}>{keeperTxns.length}</Text>
        </View>

        {keeperTxns.map((entry) => {
          const isIn = entry.amount >= 0;
          return (
            <View key={entry.id} style={styles.txRow}>
              <View style={[styles.txIcon, isIn ? styles.txIconIn : styles.txIconOut]}>
                <Text style={styles.txArrow}>{isIn ? '↓' : '↑'}</Text>
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txName}>{entry.label}</Text>
                <Text style={styles.txTime}>{formatIstDate(entry.date, true)}</Text>
              </View>
              <Text style={[styles.txAmount, isIn ? styles.amountIn : styles.amountOut]}>
                {isIn ? '+' : '−'} ₹{Math.abs(entry.amount).toLocaleString('en-IN')}
              </Text>
            </View>
          );
        })}
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
  goalLabel: { ...typography.caption, marginBottom: 2 },
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
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  txTitle: { color: t.text, fontSize: 16, fontWeight: '700' },
  txCount: { color: t.textDim, fontSize: 13 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  txIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.sm,
  },
  txIconIn: { backgroundColor: '#0A261C' },
  txIconOut: { backgroundColor: '#261214' },
  txArrow: { color: t.text, fontSize: 15, fontWeight: '800' },
  txInfo: { flex: 1 },
  txName: { color: t.text, fontSize: 14, fontWeight: '600' },
  txTime: { color: t.textFaint, fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  amountIn: { color: t.ok },
  amountOut: { color: t.warn },
});
