import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';
import { BalanceCurve } from '../components/BalanceCurve';
import { FadeIn, PressableScale, ProgressBar, Pulse, money } from '../components/motion';
import { useAppStore } from '../../store/useAppStore';
import { formatIstDate, PENALTY } from '@tixpay/engine';
import type { Shortfall } from '@tixpay/types';
import Svg, { Path, Circle, Rect, Line, Polyline, Polygon } from 'react-native-svg';

interface InsightsScreenProps {
  onTapDip: (shortfall: Shortfall) => void;
  onOpenKeeper?: () => void;
  onOpenMandates?: () => void;
  onOpenPay?: () => void;
  onOpenSpendInsights?: () => void;
  onOpenSipCheck?: () => void;
  onOpenChat?: () => void;
  onOpenSubscriptions?: () => void;
  onOpenMoneyMap?: () => void;
  onOpenRiskProfile?: () => void;
}

const HORIZONS = [30, 60, 90];

export const InsightsScreen: React.FC<InsightsScreenProps> = ({
  onTapDip,
  onOpenKeeper,
  onOpenMandates,
  onOpenPay,
  onOpenSpendInsights,
  onOpenSipCheck,
  onOpenChat,
  onOpenSubscriptions,
  onOpenMoneyMap,
  onOpenRiskProfile,
}) => {
  const curve = useAppStore((state) => state.curve());
  const mandates = useAppStore((state) => state.mandates());
  const shortfalls = useAppStore((state) => state.shortfalls());
  const ledger = useAppStore((state) => state.ledger());
  const pausedMandateIds = useAppStore((state) => state.pausedMandateIds);
  const redactionOn = useAppStore((state) => state.redactionOn);
  const keeperBalance = useAppStore((state) => state.keeperBalance);
  const keeperProgress = useAppStore((state) => state.keeperProgress());
  const goalLabel = useAppStore((state) => state.goalLabel);
  const goalTargetAmount = useAppStore((state) => state.goalTargetAmount);
  const horizonDays = useAppStore((state) => state.horizonDays);
  const setHorizon = useAppStore((state) => state.setHorizon);
  const healthVerdict = useAppStore((state) => state.healthVerdict);
  const pipelineCache = useAppStore((state) => state._pipelineCache);

  const activeShortfall = shortfalls.length > 0 ? shortfalls[0] : undefined;
  // Green means the projection genuinely cleared, not that a button was
  // pressed. There is no override: the only way to this state is a curve that
  // actually stays above the buffer.
  const isBackInSafeZone = !activeShortfall;

  const currentBalance = ledger?.currentBalance ?? curve[0]?.balance ?? 0;

  const verdict = useMemo(
    () => healthVerdict(),
    [healthVerdict, pipelineCache, keeperBalance],
  );

  /**
   * Safe to spend: the most you could pay today without pushing any day in the
   * projection below the ₹500 buffer.
   *
   * This used to be a hardcoded ₹3,499. It is the number a user is most likely
   * to act on, so inventing it was the worst possible thing to fake — it is
   * simply the lowest point the curve reaches, less the buffer.
   */
  const lowestProjected = curve.length > 0 ? Math.min(...curve.map((p) => p.balance)) : 0;
  const safeSpendAmount = Math.max(0, Math.floor(lowestProjected - 500));

  /** The day the projection bottoms out — what 'safe to spend' is measured to. */
  const lowestPoint = curve.reduce(
    (low, p) => (p.balance < low.balance ? p : low),
    curve[0] ?? { balance: 0, date: new Date(), events: [] },
  );

  /**
   * Rupees of bounce penalty currently on the line.
   *
   * Uses the engine's PENALTY table rather than a guess: OTT is deliberately
   * ₹0 there — a failed Netflix autopay costs a service pause, not a fee — and
   * a utility bounce is ₹100, not ₹250.
   */
  const penaltyAtRisk = shortfalls.reduce(
    (sum, sf) => sum + sf.atRisk.reduce((s2, m) => s2 + PENALTY[m.category], 0),
    0,
  );

  const tools: Array<{ id: string; icon: React.ReactNode; label: string; onPress?: () => void }> = [
    {
      id: 'spend',
      label: 'Spend Insights',
      onPress: onOpenSpendInsights,
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={t.warn} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M18 20V10" />
          <Path d="M12 20V4" />
          <Path d="M6 20v-6" />
        </Svg>
      ),
    },
    {
      id: 'recurring',
      label: 'Recurring',
      onPress: onOpenSubscriptions,
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M17 2l4 4-4 4" />
          <Path d="M3 11v-1a4 4 0 0 1 4-4h14" />
          <Path d="M7 22l-4-4 4-4" />
          <Path d="M21 13v1a4 4 0 0 1-4 4H3" />
        </Svg>
      ),
    },
    {
      id: 'map',
      label: 'Money Map',
      onPress: onOpenMoneyMap,
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <Line x1="8" y1="2" x2="8" y2="18" />
          <Line x1="16" y1="6" x2="16" y2="22" />
        </Svg>
      ),
    },
    {
      id: 'risk',
      label: 'Risk Profile',
      onPress: onOpenRiskProfile,
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#F472B6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Line x1="4" y1="21" x2="4" y2="14" />
          <Line x1="4" y1="10" x2="4" y2="3" />
          <Line x1="12" y1="21" x2="12" y2="12" />
          <Line x1="12" y1="8" x2="12" y2="3" />
          <Line x1="20" y1="21" x2="20" y2="16" />
          <Line x1="20" y1="12" x2="20" y2="3" />
        </Svg>
      ),
    },
    {
      id: 'sip',
      label: 'SIP Check',
      onPress: onOpenSipCheck,
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <Polyline points="17 6 23 6 23 12" />
        </Svg>
      ),
    },
    {
      id: 'coach',
      label: 'Money Coach',
      onPress: onOpenChat,
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={t.warn} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </Svg>
      ),
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* ── Horizon ─────────────────────────────────────────────────── */}
      <View style={styles.horizonRow}>
        {HORIZONS.map((days) => {
          const isActive = days === horizonDays;
          return (
            <PressableScale
              key={days}
              style={[styles.horizonPill, isActive && styles.horizonPillActive]}
              onPress={() => setHorizon(days)}
              haptic={false}
            >
              <Text style={[styles.horizonText, isActive && styles.horizonTextActive]}>
                Next {days} days
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {/* ── Balance ─────────────────────────────────────────────────── */}
      <FadeIn style={styles.balanceHeader}>
        <View>
          <Text style={styles.inferredLabel}>Inferred balance</Text>
          <Rupee amount={currentBalance} style={typography.display} showPrefix={false} animate />
          <Text style={styles.inferredSub}>
            {ledger?.drift === 0
              ? 'Reconciled to your statement, zero drift'
              : `Reconciled to within ${money(ledger?.drift ?? 0)}`}
          </Text>
        </View>

        <PressableScale style={styles.safeSpendPill} onPress={onOpenPay}>
          <Text style={styles.safeSpendLabel}>Safe to spend </Text>
          <Rupee amount={safeSpendAmount} style={styles.safeSpendValue} showPrefix={false} />
          <Text style={styles.safeSpendArrow}> ›</Text>
        </PressableScale>
      </FadeIn>

      {/* ── Curve ───────────────────────────────────────────────────── */}
      <BalanceCurve
        curve={curve}
        shortfall={activeShortfall}
        onDipPress={() => activeShortfall && onTapDip(activeShortfall)}
        isResolved={isBackInSafeZone}
      />

      {isBackInSafeZone ? (
        <FadeIn style={styles.resolvedBanner}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <View style={styles.bannerText}>
            <Text style={styles.resolvedTitle}>You're in the safe zone</Text>
            <Text style={styles.resolvedSub}>
              No projected shortfall in the next {horizonDays} days
            </Text>
          </View>
        </FadeIn>
      ) : (
        <Pulse>
          <PressableScale
            style={styles.alertBanner}
            onPress={() => activeShortfall && onTapDip(activeShortfall)}
          >
            <View style={styles.alertCircle}>
              <Text style={styles.checkIcon}>!</Text>
            </View>
            <View style={styles.bannerText}>
              <Text style={styles.alertTitle}>
                {money(activeShortfall!.deficit)} short on{' '}
                {formatIstDate(activeShortfall!.date)}
              </Text>
              <Text style={styles.alertSub}>
                {activeShortfall!.atRisk.length} payment
                {activeShortfall!.atRisk.length === 1 ? '' : 's'} at risk — tap to see the fixes
              </Text>
            </View>
          </PressableScale>
        </Pulse>
      )}

      {/* ── Health strip ────────────────────────────────────────────── */}
      {verdict && (
        <FadeIn delay={60}>
          <PressableScale style={styles.healthCard} onPress={onOpenMoneyMap} haptic={false}>
            <View style={styles.healthScore}>
              <Text style={styles.healthScoreText}>{verdict.score}</Text>
            </View>
            <View style={styles.healthInfo}>
              <Text style={styles.healthTitle}>{verdict.headline}</Text>
              <Text style={styles.healthSub} numberOfLines={2}>
                {verdict.findings[0]?.text ?? 'Open your Money Map for the full picture.'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </PressableScale>
        </FadeIn>
      )}

      {/* ── Mandates strip ──────────────────────────────────────────── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Upcoming mandates</Text>
        <PressableScale onPress={onOpenMandates} haptic={false}>
          <Text style={styles.seeAllText}>See all</Text>
        </PressableScale>
      </View>

      {mandates.length === 0 ? (
        <PressableScale style={styles.noMandatesCard} onPress={onOpenSubscriptions} haptic={false}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={t.warn} strokeWidth={2} style={{ marginRight: 10 }}>
            <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </Svg>
          <View style={styles.bannerText}>
            <Text style={styles.noMandatesTitle}>No auto-debits on this account</Text>
            <Text style={styles.noMandatesSub}>
              Nothing bills you on a fixed schedule, so the bounce guard has nothing to warn
              about. Tap to see what does repeat.
            </Text>
          </View>
        </PressableScale>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mandatesScroll}>
          {mandates.map((m, index) => {
            const isPaused = pausedMandateIds.includes(m.id);
            const displayName =
              redactionOn && m.displayName.length > 8
                ? `${m.displayName.slice(0, 4)}••••`
                : m.displayName;

            return (
              <FadeIn key={m.id} delay={120 + index * 30}>
                <PressableScale
                  style={[styles.mandateCard, isPaused && styles.mandateCardPaused]}
                  onPress={onOpenMandates}
                  haptic={false}
                >
                  <View style={styles.mandateHeader}>
                    <View
                      style={[styles.mandateLogoPlaceholder, isPaused && styles.mandateLogoPaused]}
                    >
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
                      {isPaused ? 'PAUSED' : formatIstDate(m.nextDebit)}
                    </Text>
                  </View>
                </PressableScale>
              </FadeIn>
            );
          })}
        </ScrollView>
      )}

      {/* ── Metric Grid ─────────────────────────────────────────────── */}
      <View style={styles.gridRow}>
        <FadeIn delay={90} style={styles.gridCard}>
          <View style={styles.iconCircleYellow}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={t.warn} strokeWidth={2}>
              <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <Line x1="12" y1="9" x2="12" y2="13" />
              <Line x1="12" y1="17" x2="12.01" y2="17" />
            </Svg>
          </View>
          <Text style={styles.gridLabel}>Bounce risk</Text>
          <Text style={styles.gridValueYellow}>
            {isBackInSafeZone ? 'None' : money(penaltyAtRisk)}
          </Text>
          <Text style={styles.gridSub}>
            {isBackInSafeZone ? `Next ${horizonDays} days` : 'In bounce penalties'}
          </Text>
        </FadeIn>

        <FadeIn delay={110} style={styles.gridCard}>
          <View style={styles.iconCircleGreen}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={t.ok} strokeWidth={2}>
              <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <Path d="M22 4L12 14.01l-3-3" />
            </Svg>
          </View>
          <Text style={styles.gridLabel}>Safe to spend</Text>
          <Rupee amount={safeSpendAmount} style={styles.gridValueGreen} showPrefix={false} />
          <Text style={styles.gridSub}>
            {curve.length > 0 ? `Lowest on ${formatIstDate(lowestPoint.date)}` : '—'}
          </Text>
        </FadeIn>
      </View>

      {/* ── Goal ────────────────────────────────────────────────────── */}
      <FadeIn delay={140}>
        <PressableScale style={styles.keeperCard} onPress={onOpenKeeper} haptic={false}>
          <View style={styles.jarGraphicPlaceholder}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={t.warn} strokeWidth={2}>
              <Circle cx="12" cy="12" r="10" />
              <Circle cx="12" cy="12" r="6" />
              <Circle cx="12" cy="12" r="2" fill={t.warn} />
            </Svg>
          </View>
          <View style={styles.keeperInfo}>
            <Text style={styles.keeperTitle}>{goalLabel}</Text>
            <Text style={styles.keeperSub}>Saving toward {money(goalTargetAmount)}</Text>
            <Rupee amount={keeperBalance} style={styles.keeperAmount} showPrefix={false} animate={false} />
            <ProgressBar progress={keeperProgress} height={4} style={styles.keeperTrack} />
          </View>
          <Text style={styles.keeperPct}>{Math.round(keeperProgress * 100)}% ›</Text>
        </PressableScale>
      </FadeIn>

      {/* ── Tools ───────────────────────────────────────────────────── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Tools</Text>
      </View>
      <View style={styles.toolsGrid}>
        {tools.map((tool, index) => (
          <FadeIn key={tool.label} delay={160 + index * 25} style={styles.toolWrap}>
            <PressableScale style={styles.toolCard} onPress={tool.onPress}>
              <View style={styles.toolIconWrap}>{tool.icon}</View>
              <Text style={styles.toolLabel}>{tool.label}</Text>
            </PressableScale>
          </FadeIn>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  scrollContent: { padding: space.md, paddingBottom: 40 },

  horizonRow: { flexDirection: 'row', gap: space.xs, marginBottom: space.md },
  horizonPill: {
    paddingHorizontal: space.sm,
    paddingVertical: 5,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  horizonPillActive: { borderColor: t.warn, backgroundColor: '#262010' },
  horizonText: { color: t.textDim, fontSize: 11, fontWeight: '600' },
  horizonTextActive: { color: t.warn, fontWeight: '700' },

  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  inferredLabel: { color: t.textDim, fontSize: 13, fontWeight: '500', marginBottom: 2 },
  inferredSub: { color: t.textFaint, fontSize: 10, marginTop: 3 },
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
  safeSpendLabel: { color: t.ok, fontSize: 13, fontWeight: '600' },
  safeSpendValue: { color: t.ok, fontSize: 13, fontWeight: '700' },
  safeSpendArrow: { color: t.ok, fontSize: 14, fontWeight: '700' },

  bannerText: { flex: 1 },
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
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#261214',
    borderColor: t.danger,
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
  alertCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: t.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  checkIcon: { color: '#000000', fontSize: 18, fontWeight: '800' },
  resolvedTitle: { color: t.ok, fontSize: 15, fontWeight: '700' },
  resolvedSub: { color: t.textDim, fontSize: 12 },
  alertTitle: { color: t.danger, fontSize: 15, fontWeight: '800' },
  alertSub: { color: t.textDim, fontSize: 12, marginTop: 1 },

  healthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  healthScore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: t.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  healthScoreText: {
    color: t.accent,
    fontSize: 15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  healthInfo: { flex: 1 },
  healthTitle: { color: t.text, fontSize: 14, fontWeight: '700' },
  healthSub: { color: t.textDim, fontSize: 11, marginTop: 2, lineHeight: 16 },
  chevron: { color: t.textDim, fontSize: 20, marginLeft: space.sm },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.md,
    marginBottom: space.sm,
  },
  sectionTitle: { color: t.text, fontSize: 16, fontWeight: '700' },
  seeAllText: { color: t.warn, fontSize: 13, fontWeight: '700' },

  noMandatesCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.lg,
  },
  noMandatesIcon: { fontSize: 22, marginRight: space.sm },
  noMandatesTitle: { color: t.text, fontSize: 14, fontWeight: '700' },
  noMandatesSub: { color: t.textDim, fontSize: 12, lineHeight: 17, marginTop: 2 },

  mandatesScroll: { marginBottom: space.lg },
  mandateCard: {
    width: 140,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
    marginRight: space.sm,
  },
  mandateCardPaused: { borderColor: t.ok, backgroundColor: '#0A261C' },
  mandateHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
  mandateLogoPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: t.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  mandateLogoPaused: { backgroundColor: t.ok },
  mandateLogoText: { color: t.warn, fontSize: 10, fontWeight: '800' },
  mandateName: { color: t.text, fontSize: 12, fontWeight: '600', flex: 1 },
  mandateMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mandateAmount: { color: t.text, fontSize: 14, fontWeight: '700' },
  mandateDate: { color: t.textDim, fontSize: 11 },
  pausedBadge: { color: t.ok, fontWeight: '800' },

  gridRow: { flexDirection: 'row', gap: space.md, marginBottom: space.md },
  gridCard: {
    flex: 1,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  iconCircleYellow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#262010',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  iconYellow: { fontSize: 16 },
  iconCircleGreen: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0E281F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  iconGreen: { fontSize: 16 },
  gridLabel: { color: t.textDim, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  gridValueYellow: { color: t.warn, fontSize: 18, fontWeight: '800', marginBottom: 2 },
  gridValueGreen: { color: t.ok, fontSize: 18, fontWeight: '800', marginBottom: 2 },
  gridSub: { color: t.textFaint, fontSize: 11 },

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
  jarEmoji: { fontSize: 24 },
  keeperInfo: { flex: 1 },
  keeperTitle: { color: t.text, fontSize: 14, fontWeight: '700' },
  keeperSub: { color: t.textDim, fontSize: 11, marginBottom: 2 },
  keeperAmount: { color: t.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  keeperTrack: { width: '100%' },
  keeperPct: { color: t.textDim, fontSize: 12, fontWeight: '600', marginLeft: space.xs },

  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  toolWrap: { width: '31%', flexGrow: 1 },
  toolCard: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    alignItems: 'center',
  },
  toolIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  toolLabel: { color: t.text, fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
