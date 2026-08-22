import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { t, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';
import { useAppStore } from '../../store/useAppStore';
import type { Intervention } from '@tixpay/types';

interface ShortfallSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectAction: (actionLabel: string, intervention?: Intervention) => void;
}

export const ShortfallSheet: React.FC<ShortfallSheetProps> = ({
  visible,
  onClose,
  onSelectAction,
}) => {
  const shortfalls = useAppStore((state) => state.shortfalls());
  const activeShortfall = shortfalls.length > 0 ? shortfalls[0] : undefined;
  const interventions = useAppStore((state) => state.interventions(activeShortfall));
  const togglePauseMandate = useAppStore((state) => state.togglePauseMandate);
  const redactionOn = useAppStore((state) => state.redactionOn);

  const featuredIntervention = interventions.length > 0 ? interventions[0] : undefined;
  const secondaryInterventions = interventions.slice(1);

  const deficitAmount = activeShortfall?.deficit ?? 3200;
  const atRiskList = activeShortfall?.atRisk ?? [];

  const handleAction = (intervention: Intervention) => {
    if (intervention.target?.id) {
      togglePauseMandate(intervention.target.id);
    }
    onSelectAction(intervention.label, intervention);
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
                You'll be ₹{deficitAmount.toLocaleString('en-IN')} short on Mar 12
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
                        <Text style={styles.itemDate}>Mar {item.dayOfMonth}</Text>
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

            {/* Featured Action Card */}
            {featuredIntervention && (
              <View style={styles.featuredCard}>
                <View style={styles.featuredHeader}>
                  <View style={styles.netflixLogo}>
                    <Text style={styles.netflixN}>
                      {featuredIntervention.target?.displayName.slice(0, 1) || 'N'}
                    </Text>
                  </View>
                  <View style={styles.featuredMeta}>
                    <Text style={styles.featuredTitle}>{featuredIntervention.label}</Text>
                    <Text style={styles.featuredSub}>
                      Pause this payment on Mar {featuredIntervention.target?.dayOfMonth ?? 12}
                    </Text>
                  </View>
                  <Rupee
                    amount={featuredIntervention.amount ?? 649}
                    style={styles.featuredAmount}
                    showPrefix={false}
                  />
                </View>

                <View style={styles.benefitsBox}>
                  <Text style={styles.benefitGreen}>
                    ✓ Saves your ₹5,000 SIP
                  </Text>
                  <Text style={styles.benefitYellow}>
                    + ₹{featuredIntervention.penaltyAvoided ?? 250} penalty avoided
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.doThisBtnYellow}
                  onPress={() => handleAction(featuredIntervention)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.doThisBtnTextBlack}>Do this</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Secondary Actions */}
            {secondaryInterventions.map((intervention, idx) => (
              <View key={idx} style={styles.secondaryCard}>
                <View style={styles.secondaryHeader}>
                  <View style={styles.bbLogo}>
                    <Text style={styles.bbText}>
                      {intervention.target?.displayName.slice(0, 2) || '⚡'}
                    </Text>
                  </View>
                  <View style={styles.featuredMeta}>
                    <Text style={styles.featuredTitle}>{intervention.label}</Text>
                    <Text style={styles.featuredSub}>
                      Avoids ₹{intervention.penaltyAvoided} bounce penalty
                    </Text>
                  </View>
                  {intervention.amount && (
                    <Rupee
                      amount={intervention.amount}
                      style={styles.secondaryAmount}
                      showPrefix={false}
                    />
                  )}
                </View>
                <TouchableOpacity
                  style={styles.doThisBtnOutline}
                  onPress={() => handleAction(intervention)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.doThisBtnTextWhite}>Do this</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.viewAllBtn} activeOpacity={0.7}>
              <Text style={styles.viewAllText}>View all options ›</Text>
            </TouchableOpacity>

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
  netflixLogo: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  netflixN: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
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
