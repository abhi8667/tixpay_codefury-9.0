import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';
import { BalanceCurve } from '../components/BalanceCurve';
import { useAppStore } from '../../store/useAppStore';

interface InsightsScreenProps {
  onTapDip: () => void;
  isResolved?: boolean;
  onOpenKeeper?: () => void;
  onOpenMandates?: () => void;
}

export const InsightsScreen: React.FC<InsightsScreenProps> = ({
  onTapDip,
  isResolved = false,
  onOpenKeeper,
  onOpenMandates,
}) => {
  const curve = useAppStore((state) => state.curve());
  const mandates = useAppStore((state) => state.mandates());
  const shortfalls = useAppStore((state) => state.shortfalls());
  const ledger = useAppStore((state) => state.ledger());
  const pausedMandateIds = useAppStore((state) => state.pausedMandateIds);
  const redactionOn = useAppStore((state) => state.redactionOn);

  const activeShortfall = shortfalls.length > 0 ? shortfalls[0] : undefined;
  const isBackInSafeZone = isResolved || (pausedMandateIds.length > 0 && (!activeShortfall || activeShortfall.deficit <= 0));

  const currentBalance = ledger?.currentBalance ?? (curve[0]?.balance ?? 12450);
  const safeSpendAmount = isBackInSafeZone ? 3499 : 2850;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* 30-Day Selector Header */}
      <TouchableOpacity style={styles.selectorRow} activeOpacity={0.7}>
        <Text style={styles.selectorText}>Next 30 days</Text>
        <Text style={styles.dropdownArrow}> ∨</Text>
      </TouchableOpacity>

      {/* Inferred Balance Header */}
      <View style={styles.balanceHeader}>
        <View>
          <View style={styles.inferredRow}>
            <Text style={styles.inferredLabel}>Inferred Balance</Text>
            <View style={styles.infoBadge}>
              <Text style={styles.infoText}>i</Text>
            </View>
          </View>
          <Rupee
            amount={currentBalance}
            style={typography.display}
            showPrefix={false}
          />
        </View>

        <TouchableOpacity style={styles.safeSpendPill} activeOpacity={0.8}>
          <Text style={styles.safeSpendLabel}>Safe to spend </Text>
          <Rupee amount={safeSpendAmount} style={styles.safeSpendValue} showPrefix={false} />
          {isBackInSafeZone && <Text style={styles.deltaGreen}> +₹649</Text>}
          <Text style={styles.safeSpendArrow}> ›</Text>
        </TouchableOpacity>
      </View>

      {/* Hero Cash-Flow SVG Curve */}
      <BalanceCurve
        curve={curve}
        shortfall={activeShortfall}
        onDipPress={onTapDip}
        isResolved={isBackInSafeZone}
      />

      {/* Resolved Emerald Banner Overlay */}
      {isBackInSafeZone && (
        <View style={styles.resolvedBanner}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <View>
            <Text style={styles.resolvedTitle}>You're back in the safe zone!</Text>
            <Text style={styles.resolvedSub}>₹250 penalty avoided</Text>
          </View>
        </View>
      )}

      {/* Upcoming Mandates Horizontal Strip */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Upcoming Mandates</Text>
        <TouchableOpacity onPress={onOpenMandates}>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mandatesScroll}>
        {mandates.map((m) => {
          const isPaused = pausedMandateIds.includes(m.id);
          const displayName = redactionOn && m.displayName.length > 8
            ? `${m.displayName.slice(0, 4)}••••`
            : m.displayName;

          return (
            <View
              key={m.id}
              style={[styles.mandateCard, isPaused && styles.mandateCardPaused]}
            >
              <View style={styles.mandateHeader}>
                <View style={[styles.mandateLogoPlaceholder, isPaused && styles.mandateLogoPaused]}>
                  <Text style={styles.mandateLogoText}>
                    {m.displayName.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.mandateName} numberOfLines={1}>
                  {displayName}
                </Text>
              </View>
              <View style={styles.mandateMetaRow}>
                <Rupee amount={m.amount} style={styles.mandateAmount} showPrefix={false} />
                <Text style={[styles.mandateDate, isPaused && styles.pausedBadge]}>
                  {isPaused ? 'PAUSED' : `Mar ${m.dayOfMonth}`}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Grid Stat Cards: Bounce Risk & Safe to Spend */}
      <View style={styles.gridRow}>
        <View style={[styles.gridCard, styles.bounceRiskCard]}>
          <View style={styles.iconCircleYellow}>
            <Text style={styles.iconYellow}>⚠️</Text>
          </View>
          <Text style={styles.gridLabel}>Bounce Risk</Text>
          <Text style={styles.gridValueYellow}>
            {isBackInSafeZone ? 'None' : activeShortfall ? 'High' : 'Low'}
          </Text>
          <Text style={styles.gridSub}>Next 7 days</Text>
        </View>

        <View style={[styles.gridCard, styles.safeSpendCard]}>
          <View style={styles.iconCircleGreen}>
            <Text style={styles.iconGreen}>👛</Text>
          </View>
          <Text style={styles.gridLabel}>Safe to Spend</Text>
          <Rupee amount={safeSpendAmount} style={styles.gridValueGreen} showPrefix={false} />
          <Text style={styles.gridSub}>Until Mar 17</Text>
        </View>
      </View>

      {/* Keeper (Savings Jar) Preview Card */}
      <TouchableOpacity style={styles.keeperCard} onPress={onOpenKeeper} activeOpacity={0.8}>
        <View style={styles.jarGraphicPlaceholder}>
          <Text style={styles.jarEmoji}>🏺</Text>
        </View>
        <View style={styles.keeperInfo}>
          <Text style={styles.keeperTitle}>Keeper</Text>
          <Text style={styles.keeperSub}>Saving toward ₹50,000</Text>
          <Rupee amount={currentBalance} style={styles.keeperAmount} showPrefix={false} />

          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: '24.9%' }]} />
          </View>
        </View>
        <Text style={styles.keeperPct}>24.9% of goal ›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg,
  },
  scrollContent: {
    padding: space.md,
    paddingBottom: 40,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  selectorText: {
    color: t.text,
    fontSize: 16,
    fontWeight: '600',
  },
  dropdownArrow: {
    color: t.textDim,
    fontSize: 14,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  inferredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  inferredLabel: {
    color: t.textDim,
    fontSize: 13,
    fontWeight: '500',
    marginRight: 4,
  },
  infoBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: t.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    color: t.textDim,
    fontSize: 10,
    fontWeight: '700',
  },
  safeSpendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A261C',
    borderColor: t.ok,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  safeSpendLabel: {
    color: t.ok,
    fontSize: 13,
    fontWeight: '600',
  },
  safeSpendValue: {
    color: t.ok,
    fontSize: 13,
    fontWeight: '700',
  },
  deltaGreen: {
    color: t.ok,
    fontSize: 11,
    fontWeight: '800',
  },
  safeSpendArrow: {
    color: t.ok,
    fontSize: 14,
    fontWeight: '700',
  },
  resolvedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A261C',
    borderColor: t.ok,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginVertical: space.md,
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: t.ok,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  checkIcon: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '800',
  },
  resolvedTitle: {
    color: t.ok,
    fontSize: 15,
    fontWeight: '700',
  },
  resolvedSub: {
    color: t.textDim,
    fontSize: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.md,
    marginBottom: space.sm,
  },
  sectionTitle: {
    color: t.text,
    fontSize: 16,
    fontWeight: '700',
  },
  seeAllText: {
    color: t.warn,
    fontSize: 13,
    fontWeight: '700',
  },
  mandatesScroll: {
    marginBottom: space.lg,
  },
  mandateCard: {
    width: 140,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
    marginRight: space.sm,
  },
  mandateCardPaused: {
    borderColor: t.ok,
    backgroundColor: '#0A261C',
  },
  mandateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  mandateLogoPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: t.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  mandateLogoPaused: {
    backgroundColor: t.ok,
  },
  mandateLogoText: {
    color: t.warn,
    fontSize: 10,
    fontWeight: '800',
  },
  mandateName: {
    color: t.text,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  mandateMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mandateAmount: {
    color: t.text,
    fontSize: 14,
    fontWeight: '700',
  },
  mandateDate: {
    color: t.textDim,
    fontSize: 11,
  },
  pausedBadge: {
    color: t.ok,
    fontWeight: '800',
  },
  gridRow: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.lg,
  },
  gridCard: {
    flex: 1,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  bounceRiskCard: {},
  safeSpendCard: {},
  iconCircleYellow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#262010',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  iconYellow: {
    fontSize: 16,
  },
  iconCircleGreen: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0E281F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  iconGreen: {
    fontSize: 16,
  },
  gridLabel: {
    color: t.textDim,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  gridValueYellow: {
    color: t.warn,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  gridValueGreen: {
    color: t.ok,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  gridSub: {
    color: t.textFaint,
    fontSize: 11,
  },
  keeperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  jarGraphicPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#262010',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  jarEmoji: {
    fontSize: 24,
  },
  keeperInfo: {
    flex: 1,
  },
  keeperTitle: {
    color: t.text,
    fontSize: 14,
    fontWeight: '700',
  },
  keeperSub: {
    color: t.textDim,
    fontSize: 11,
    marginBottom: 2,
  },
  keeperAmount: {
    color: t.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  progressTrack: {
    height: 4,
    backgroundColor: t.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: t.warn,
  },
  keeperPct: {
    color: t.textDim,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: space.xs,
  },
});
