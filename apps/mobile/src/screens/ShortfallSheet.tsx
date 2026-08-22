import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { t, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';
import { FadeIn, PressableScale, EmptyState } from '../components/motion';
import { useAppStore } from '../../store/useAppStore';
import type { Intervention, Shortfall } from '@tixpay/types';
import { formatIstDate } from '@tixpay/engine';

interface ShortfallSheetProps {
  visible: boolean;
  /** The dip the user tapped. Null when the sheet is closed. */
  shortfall: Shortfall | null;
  onClose: () => void;
  onSelectAction: (intervention: Intervention) => void;
}

export const ShortfallSheet: React.FC<ShortfallSheetProps> = ({
  visible,
  shortfall,
  onClose,
  onSelectAction,
}) => {
  const shortfalls = useAppStore((state) => state.shortfalls());
  // Fall back to the earliest dip when opened without a specific one.
  const activeShortfall = shortfall ?? shortfalls[0];
  // `interventions()` filters, so it returns a new array each call — selecting
  // it directly re-renders forever. `_pipelineCache` is a stable reference that
  // changes exactly when the projection is recomputed, which is the real
  // dependency here.
  const pipelineCache = useAppStore((state) => state._pipelineCache);
  const interventionsFor = useAppStore((state) => state.interventions);
  const interventions = useMemo(
    () => interventionsFor(activeShortfall),
    [interventionsFor, pipelineCache, activeShortfall],
  );
  const redactionOn = useAppStore((state) => state.redactionOn);
  const canFundSweep = useAppStore((state) => state.canFundSweep);
  const keeperBalance = useAppStore((state) => state.keeperBalance);

  /**
   * Expanded shows everything the engine proposed, including the remedies the
   * Keeper cannot currently fund — each labelled with the shortfall that makes
   * it unavailable.
   *
   * Collapsed is the default because a list of eight options, three of which
   * silently do nothing, is worse than three that work.
   */
  const [expanded, setExpanded] = useState(false);

  // Collapse again whenever a different dip is opened, so the sheet does not
  // inherit the previous shortfall's expanded state.
  useEffect(() => {
    if (visible) setExpanded(false);
  }, [visible, activeShortfall]);

  // A sweep the Keeper cannot fund is not an option, it is a dead end. Hide it
  // by default rather than offer a remedy that does nothing when confirmed.
  const affordable = useMemo(
    () => interventions.filter((i) => i.kind !== 'SWEEP' || canFundSweep(i.amount ?? 0)),
    [interventions, canFundSweep, keeperBalance],
  );

  const unaffordable = useMemo(
    () => interventions.filter((i) => i.kind === 'SWEEP' && !canFundSweep(i.amount ?? 0)),
    [interventions, canFundSweep, keeperBalance],
  );

  const shown = expanded ? [...affordable, ...unaffordable] : affordable.slice(0, 2);
  const featuredIntervention = shown.length > 0 ? shown[0] : undefined;
  const secondaryInterventions = shown.slice(1);
  const hiddenCount = affordable.length + unaffordable.length - shown.length;

  const deficitAmount = activeShortfall?.deficit ?? 0;
  const atRiskList = activeShortfall?.atRisk ?? [];
  const dipDate = activeShortfall ? formatIstDate(activeShortfall.date) : '';

  /** One line saying what accepting this actually does. */
  const describe = (i: Intervention): string => {
    if (i.kind === 'PAUSE') {
      return `Skip this debit${i.target ? ` on ${formatIstDate(i.target.nextDebit)}` : ''}`;
    }
    if (i.kind === 'SHIFT') {
      return i.target ? `Move the debit to ${formatIstDate(i.target.nextDebit)}` : 'Move the debit later';
    }
    return `From your Keeper · ₹${Math.round(keeperBalance).toLocaleString('en-IN')} available`;
  };

  /** What this rescues, named from the engine rather than assumed. */
  const saves = (i: Intervention): string | null => {
    const first = i.savedMandates[0];
    if (!first) return null;
    const more = i.savedMandates.length - 1;
    return `✓ Saves your ₹${first.amount.toLocaleString('en-IN')} ${first.displayName}${
      more > 0 ? ` and ${more} more` : ''
    }`;
  };

  /** A sweep bigger than the jar. Shown, but never offered as a live button. */
  const isUnaffordable = (i: Intervention): boolean =>
    i.kind === 'SWEEP' && !canFundSweep(i.amount ?? 0);

  const blockedReason = (i: Intervention): string =>
    `Needs ₹${Math.round(i.amount ?? 0).toLocaleString('en-IN')} in your Goals jar — it holds ₹${Math.round(keeperBalance).toLocaleString('en-IN')}.`;

  const handleAction = (intervention: Intervention) => {
    // Deliberately does NOT apply the intervention. This is the "pick one"
    // step; the confirm modal owns applying it. Applying here as well meant the
    // two cancelled out and the curve never moved.
    onSelectAction(intervention);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismissArea} onPress={onClose} />
        <View style={styles.sheetContainer}>
          <View style={styles.handleBar} />

          {/* Red Glowing Alert Header */}
          <View style={styles.headerRow}>
            <View style={styles.alertCircle}>
              <Text style={styles.alertIcon}>⚠️</Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>Cash shortfall detected</Text>
              <Text style={styles.headerSub}>
                You'll be ₹{Math.round(deficitAmount).toLocaleString('en-IN')} short on {dipDate}
              </Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Payments at Risk Card */}
            {atRiskList.length > 0 && (
              <View style={styles.atRiskCard}>
                <Text style={styles.cardHeaderTitle}>
                  {atRiskList.length} payments are at risk
                </Text>
                {atRiskList.map((item, idx) => {
                  const displayName = redactionOn && item.displayName.length > 8
                    ? `${item.displayName.slice(0, 4)}••••`
                    : item.displayName;

                  return (
                    <View key={item.id || idx} style={styles.atRiskItem}>
                      <View style={styles.itemLogoPlaceholder}>
                        <Text style={styles.logoText}>
                          {item.category === 'SIP' ? 'SIP' : item.displayName.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.itemMeta}>
                        <Text style={styles.itemName}>{displayName}</Text>
                        <Text style={styles.itemDate}>{formatIstDate(item.nextDebit)}</Text>
                      </View>
                      <Rupee amount={item.amount} style={styles.itemAmount} showPrefix={false} />
                      {item.priority === 'CRITICAL' && (
                        <View style={styles.priorityBadge}>
                          <Text style={styles.priorityText}>Priority</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Recommended Actions */}
            <Text style={styles.sectionTitle}>Recommended actions</Text>
            <Text style={styles.sectionSub}>Top ways to fix this shortfall</Text>

            {shown.length === 0 && (
              <EmptyState
                icon="🤔"
                title="No safe fix found"
                body="Nothing in your detected mandates or reserve can lift this dip on its own."
                hint="Adding money to your Goals jar gives the guard a sweep to offer."
              />
            )}

            {/* Featured Action Card */}
            {featuredIntervention && (
              <FadeIn style={[
                styles.featuredCard,
                isUnaffordable(featuredIntervention) && styles.cardUnaffordable,
              ]}>
                <View style={styles.featuredHeader}>
                  <View style={styles.actionLogo}>
                    <Text style={styles.actionLogoText}>
                      {featuredIntervention.target?.displayName.slice(0, 1) ??
                        (featuredIntervention.kind === 'SWEEP' ? '🏺' : '⚡')}
                    </Text>
                  </View>
                  <View style={styles.featuredMeta}>
                    <Text style={styles.featuredTitle}>{featuredIntervention.label}</Text>
                    <Text style={styles.featuredSub}>{describe(featuredIntervention)}</Text>
                  </View>
                  {featuredIntervention.amount ? (
                    <Rupee
                      amount={featuredIntervention.amount}
                      style={styles.featuredAmount}
                      showPrefix={false}
                    />
                  ) : null}
                </View>

                <View style={styles.benefitsBox}>
                  {saves(featuredIntervention) && (
                    <Text style={styles.benefitGreen}>{saves(featuredIntervention)}</Text>
                  )}
                  {featuredIntervention.penaltyAvoided > 0 && (
                    <Text style={styles.benefitYellow}>
                      + ₹{featuredIntervention.penaltyAvoided.toLocaleString('en-IN')} penalty avoided
                    </Text>
                  )}
                </View>

                {isUnaffordable(featuredIntervention) ? (
                  <View style={styles.unavailableRow}>
                    <Text style={styles.unavailableText}>{blockedReason(featuredIntervention)}</Text>
                  </View>
                ) : (
                  <PressableScale
                    style={styles.doThisBtnYellow}
                    onPress={() => handleAction(featuredIntervention)}
                  >
                    <Text style={styles.doThisBtnTextBlack}>Do this</Text>
                  </PressableScale>
                )}
              </FadeIn>
            )}

            {/* Secondary Actions */}
            {secondaryInterventions.map((intervention, idx) => (
              <FadeIn
                key={`${intervention.kind}_${intervention.target?.id ?? intervention.amount ?? idx}`}
                delay={Math.min(idx * 40, 200)}
                style={[
                  styles.secondaryCard,
                  isUnaffordable(intervention) && styles.cardUnaffordable,
                ]}
              >
                <View style={styles.secondaryHeader}>
                  <View style={styles.bbLogo}>
                    <Text style={styles.bbText}>
                      {intervention.target?.displayName.slice(0, 2) ??
                        (intervention.kind === 'SWEEP' ? '🏺' : '⚡')}
                    </Text>
                  </View>
                  <View style={styles.featuredMeta}>
                    <Text style={styles.featuredTitle}>{intervention.label}</Text>
                    <Text style={styles.featuredSub}>{describe(intervention)}</Text>
                  </View>
                  {intervention.amount && (
                    <Rupee
                      amount={intervention.amount}
                      style={styles.secondaryAmount}
                      showPrefix={false}
                    />
                  )}
                </View>
                {isUnaffordable(intervention) ? (
                  <View style={styles.unavailableRow}>
                    <Text style={styles.unavailableText}>{blockedReason(intervention)}</Text>
                  </View>
                ) : (
                  <PressableScale
                    style={styles.doThisBtnOutline}
                    onPress={() => handleAction(intervention)}
                  >
                    <Text style={styles.doThisBtnTextWhite}>Do this</Text>
                  </PressableScale>
                )}
              </FadeIn>
            ))}

            {/* This used to be a TouchableOpacity with no onPress at all — a
                button that looked live and did nothing. It now toggles the
                full list, and disappears when there is nothing left to show. */}
            {(hiddenCount > 0 || expanded) && (
              <PressableScale style={styles.viewAllBtn} onPress={() => setExpanded((v) => !v)}>
                <Text style={styles.viewAllText}>
                  {expanded
                    ? 'Show fewer options'
                    : `View all ${affordable.length + unaffordable.length} options ›`}
                </Text>
              </PressableScale>
            )}

            <Text style={styles.footerSecurity}>🔒 Zero-knowledge inference • 100% on-device</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: t.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: space.md,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: t.border,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.textFaint,
    alignSelf: 'center',
    marginBottom: space.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.md,
  },
  alertCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#381616',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  alertIcon: {
    fontSize: 20,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: t.danger,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSub: {
    color: t.textDim,
    fontSize: 13,
    marginTop: 2,
  },
  atRiskCard: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  cardHeaderTitle: {
    color: t.textDim,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: space.sm,
  },
  atRiskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  itemLogoPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: t.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.sm,
  },
  logoText: {
    color: t.warn,
    fontSize: 10,
    fontWeight: '800',
  },
  itemMeta: {
    flex: 1,
  },
  itemName: {
    color: t.text,
    fontSize: 13,
    fontWeight: '600',
  },
  itemDate: {
    color: t.textDim,
    fontSize: 11,
  },
  itemAmount: {
    color: t.text,
    fontSize: 14,
    fontWeight: '700',
    marginRight: space.sm,
  },
  priorityBadge: {
    backgroundColor: '#381616',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priorityText: {
    color: t.danger,
    fontSize: 10,
    fontWeight: '800',
  },
  sectionTitle: {
    color: t.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSub: {
    color: t.textDim,
    fontSize: 12,
    marginBottom: space.sm,
  },
  featuredCard: {
    backgroundColor: t.surface,
    borderColor: t.warn,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  featuredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  // Was a hardcoded Netflix red, which coloured whatever the engine happened to
  // rank first — a Bajaj EMI pause wearing Netflix's brand.
  actionLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: t.surfaceHi,
    borderWidth: 1,
    borderColor: t.warn,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  actionLogoText: {
    color: t.warn,
    fontSize: 16,
    fontWeight: '900',
  },
  cardUnaffordable: {
    opacity: 0.6,
    borderStyle: 'dashed',
  },
  unavailableRow: {
    backgroundColor: t.surfaceHi,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: space.sm,
  },
  unavailableText: {
    color: t.textDim,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  featuredMeta: {
    flex: 1,
  },
  featuredTitle: {
    color: t.text,
    fontSize: 15,
    fontWeight: '700',
  },
  featuredSub: {
    color: t.textDim,
    fontSize: 12,
  },
  featuredAmount: {
    color: t.text,
    fontSize: 16,
    fontWeight: '800',
  },
  benefitsBox: {
    backgroundColor: '#0E281F',
    borderRadius: radius.sm,
    padding: space.sm,
    marginBottom: space.md,
  },
  benefitGreen: {
    color: t.ok,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  benefitYellow: {
    color: t.warn,
    fontSize: 12,
    fontWeight: '600',
  },
  doThisBtnYellow: {
    backgroundColor: t.warn,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doThisBtnTextBlack: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryCard: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  secondaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  bbLogo: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: t.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  bbText: {
    color: t.warn,
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryAmount: {
    color: t.text,
    fontSize: 15,
    fontWeight: '700',
  },
  doThisBtnOutline: {
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surfaceHi,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doThisBtnTextWhite: {
    color: t.text,
    fontSize: 14,
    fontWeight: '700',
  },
  viewAllBtn: {
    alignItems: 'center',
    paddingVertical: space.md,
  },
  viewAllText: {
    color: t.warn,
    fontSize: 14,
    fontWeight: '700',
  },
  footerSecurity: {
    color: t.textFaint,
    fontSize: 11,
    textAlign: 'center',
    marginVertical: space.md,
  },
});
