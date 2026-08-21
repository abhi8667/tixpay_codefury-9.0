import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';

interface KeeperScreenProps {
  onBack?: () => void;
}

export const KeeperScreen: React.FC<KeeperScreenProps> = ({ onBack }) => {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Keeper</Text>
        <Text style={styles.gearIcon}>⚙️</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Large Golden Jar Illustration Header */}
        <View style={styles.jarSection}>
          <View style={styles.jarGlowContainer}>
            <Text style={styles.jarEmojiLarge}>🏺</Text>
          </View>

          <Text style={styles.goalLabel}>Goal</Text>
          <Rupee amount={50000} style={typography.display} showPrefix={false} />

          <View style={styles.progressRow}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: '24.9%' }]} />
            </View>
            <Text style={styles.pctText}>24.9% of goal</Text>
          </View>
        </View>

        {/* 2 Stat Boxes */}
        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Keeper Balance</Text>
            <Rupee amount={12450} style={styles.statVal} showPrefix={false} />
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Interest Earned</Text>
            <Rupee amount={268} style={styles.statVal} showPrefix={false} />
          </View>
        </View>

        {/* Action CTAs */}
        <View style={styles.ctaRow}>
          <TouchableOpacity style={styles.addMoneyBtn} activeOpacity={0.8}>
            <Text style={styles.addMoneyText}>+ Add Money</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.withdrawBtn} activeOpacity={0.8}>
            <Text style={styles.withdrawText}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        {/* Autosave Banner */}
        <View style={styles.bannerCard}>
          <Text style={styles.bannerIcon}>👥</Text>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerTitle}>Autosave</Text>
            <Text style={styles.bannerSub}>Roundups & rules</Text>
          </View>
          <Text style={styles.activeTag}>Active ›</Text>
        </View>

        {/* Stat Summary 3 columns */}
        <View style={styles.threeColRow}>
          <View style={styles.col}>
            <Text style={styles.colValYellow}>24.9%</Text>
            <Text style={styles.colSub}>of your goal reached</Text>
          </View>
          <View style={styles.col}>
            <Rupee amount={12550} style={styles.colValGreen} showPrefix={false} />
            <Text style={styles.colSub}>left to reach goal</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.colValWhite}>Mar 31, 2025</Text>
            <Text style={styles.colSub}>estimated goal date</Text>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.txHeader}>
          <Text style={styles.txTitle}>Recent Transactions</Text>
          <Text style={styles.viewAllText}>View All</Text>
        </View>

        <View style={styles.txRow}>
          <View style={styles.txIconGreen}>
            <Text style={styles.txArrow}>↓</Text>
          </View>
          <View style={styles.txInfo}>
            <Text style={styles.txName}>Added from HDFC Bank</Text>
            <Text style={styles.txTime}>Today, 9:20 AM</Text>
          </View>
          <Text style={styles.txAmountGreen}>+ ₹500 ›</Text>
        </View>

        <View style={styles.txRow}>
          <View style={styles.txIconGreen}>
            <Text style={styles.txArrow}>↑</Text>
          </View>
          <View style={styles.txInfo}>
            <Text style={styles.txName}>Roundup Transfer</Text>
            <Text style={styles.txTime}>Yesterday, 8:45 PM</Text>
          </View>
          <Text style={styles.txAmountGreen}>+ ₹43 ›</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg,
  },
  headerRow: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
  },
  backBtn: {
    padding: space.xs,
  },
  backText: {
    color: t.text,
    fontSize: 22,
    fontWeight: '600',
  },
  headerTitle: {
    color: t.text,
    fontSize: 18,
    fontWeight: '700',
  },
  gearIcon: {
    fontSize: 18,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: space.md,
    paddingBottom: 40,
  },
  jarSection: {
    alignItems: 'center',
    marginBottom: space.lg,
  },
  jarGlowContainer: {
    width: 120,
    height: 140,
    borderRadius: 20,
    backgroundColor: '#262010',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  jarEmojiLarge: {
    fontSize: 72,
  },
  goalLabel: {
    color: t.textDim,
    fontSize: 13,
    marginBottom: 2,
  },
  progressRow: {
    width: '100%',
    marginTop: space.sm,
  },
  track: {
    height: 4,
    backgroundColor: t.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  fill: {
    height: '100%',
    backgroundColor: t.warn,
  },
  pctText: {
    color: t.textDim,
    fontSize: 12,
    textAlign: 'right',
  },
  statRow: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  statLabel: {
    color: t.textDim,
    fontSize: 13,
    marginBottom: 4,
  },
  statVal: {
    color: t.text,
    fontSize: 20,
    fontWeight: '800',
  },
  ctaRow: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.lg,
  },
  addMoneyBtn: {
    flex: 1,
    backgroundColor: t.warn,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoneyText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  withdrawBtn: {
    flex: 1,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdrawText: {
    color: t.text,
    fontSize: 15,
    fontWeight: '700',
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.lg,
  },
  bannerIcon: {
    fontSize: 20,
    marginRight: space.md,
  },
  bannerInfo: {
    flex: 1,
  },
  bannerTitle: {
    color: t.text,
    fontSize: 15,
    fontWeight: '700',
  },
  bannerSub: {
    color: t.textDim,
    fontSize: 12,
  },
  activeTag: {
    color: t.ok,
    fontSize: 13,
    fontWeight: '700',
  },
  threeColRow: {
    flexDirection: 'row',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.lg,
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  colValYellow: {
    color: t.warn,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  colValGreen: {
    color: t.ok,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  colValWhite: {
    color: t.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  colSub: {
    color: t.textDim,
    fontSize: 10,
    textAlign: 'center',
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  txTitle: {
    color: t.text,
    fontSize: 16,
    fontWeight: '700',
  },
  viewAllText: {
    color: t.warn,
    fontSize: 13,
    fontWeight: '700',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.xs,
  },
  txIconGreen: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0E281F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  txArrow: {
    color: t.ok,
    fontSize: 16,
    fontWeight: '800',
  },
  txInfo: {
    flex: 1,
  },
  txName: {
    color: t.text,
    fontSize: 14,
    fontWeight: '700',
  },
  txTime: {
    color: t.textDim,
    fontSize: 11,
  },
  txAmountGreen: {
    color: t.ok,
    fontSize: 14,
    fontWeight: '800',
  },
});
