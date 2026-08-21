import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';
import { mockInterventions } from '@tixpay/types';

interface ShortfallSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectAction: (actionLabel: string) => void;
}

export const ShortfallSheet: React.FC<ShortfallSheetProps> = ({
  visible,
  onClose,
  onSelectAction,
}) => {
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
              <Text style={styles.headerSub}>You'll be ₹3,200 short on Mar 12</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 2 Payments at Risk Card */}
            <View style={styles.atRiskCard}>
              <Text style={styles.cardHeaderTitle}>2 payments are at risk</Text>
              <View style={styles.atRiskItem}>
                <View style={styles.itemLogoPlaceholder}>
                  <Text style={styles.logoText}>SIP</Text>
                </View>
                <View style={styles.itemMeta}>
                  <Text style={styles.itemName}>SIP • HDFC Mutual Fund</Text>
                  <Text style={styles.itemDate}>Mar 12</Text>
                </View>
                <Rupee amount={5000} style={styles.itemAmount} showPrefix={false} />
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityText}>Priority</Text>
                </View>
              </View>

              <View style={styles.atRiskItem}>
                <View style={styles.itemLogoPlaceholder}>
                  <Text style={styles.logoText}>⚡</Text>
                </View>
                <View style={styles.itemMeta}>
                  <Text style={styles.itemName}>Electricity Bill</Text>
                  <Text style={styles.itemDate}>Mar 12</Text>
                </View>
                <Rupee amount={1150} style={styles.itemAmount} showPrefix={false} />
              </View>
            </View>

            {/* Recommended Actions */}
            <Text style={styles.sectionTitle}>Recommended actions</Text>
            <Text style={styles.sectionSub}>Top ways to fix this shortfall</Text>

            {/* Featured Action Card (Pause Netflix) */}
            <View style={styles.featuredCard}>
              <View style={styles.featuredHeader}>
                <View style={styles.netflixLogo}>
                  <Text style={styles.netflixN}>N</Text>
                </View>
                <View style={styles.featuredMeta}>
                  <Text style={styles.featuredTitle}>Pause Netflix</Text>
                  <Text style={styles.featuredSub}>Pause this payment on Mar 12</Text>
                </View>
                <Rupee amount={649} style={styles.featuredAmount} showPrefix={false} />
              </View>

              <View style={styles.benefitsBox}>
                <Text style={styles.benefitGreen}>✓ Saves your ₹5,000 SIP</Text>
                <Text style={styles.benefitYellow}>+ ₹250 penalty avoided</Text>
              </View>

              <TouchableOpacity
                style={styles.doThisBtnYellow}
                onPress={() => onSelectAction('Pause Netflix')}
                activeOpacity={0.8}
              >
                <Text style={styles.doThisBtnTextBlack}>Do this</Text>
              </TouchableOpacity>
            </View>

            {/* Secondary Action 1 */}
            <View style={styles.secondaryCard}>
              <View style={styles.secondaryHeader}>
                <View style={styles.bbLogo}>
                  <Text style={styles.bbText}>bb</Text>
                </View>
                <View style={styles.featuredMeta}>
                  <Text style={styles.featuredTitle}>Delay BigBasket</Text>
                  <Text style={styles.featuredSub}>Delay by 3 days</Text>
                </View>
                <Rupee amount={1200} style={styles.secondaryAmount} showPrefix={false} />
              </View>
              <TouchableOpacity
                style={styles.doThisBtnOutline}
                onPress={() => onSelectAction('Delay BigBasket')}
                activeOpacity={0.8}
              >
                <Text style={styles.doThisBtnTextWhite}>Do this</Text>
              </TouchableOpacity>
            </View>

            {/* Secondary Action 2 */}
            <View style={styles.secondaryCard}>
              <View style={styles.secondaryHeader}>
                <View style={styles.bbLogo}>
                  <Text style={styles.bbText}>⚡</Text>
                </View>
                <View style={styles.featuredMeta}>
                  <Text style={styles.featuredTitle}>Move Electricity Bill</Text>
                  <Text style={styles.featuredSub}>Pay on Mar 15 instead</Text>
                </View>
                <Rupee amount={1150} style={styles.secondaryAmount} showPrefix={false} />
              </View>
              <TouchableOpacity
                style={styles.doThisBtnOutline}
                onPress={() => onSelectAction('Move Electricity Bill')}
                activeOpacity={0.8}
              >
                <Text style={styles.doThisBtnTextWhite}>Do this</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.viewAllBtn} activeOpacity={0.7}>
              <Text style={styles.viewAllText}>View all options ›</Text>
            </TouchableOpacity>

            <Text style={styles.footerSecurity}>🔒 Your data is safe and bank-grade secure</Text>
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
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.border,
    alignSelf: 'center',
    marginBottom: space.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.md,
  },
  alertCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3D100C',
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
    fontSize: 18,
    fontWeight: '800',
  },
  headerSub: {
    color: t.text,
    fontSize: 14,
    fontWeight: '600',
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
    color: t.text,
    fontSize: 16,
    fontWeight: '700',
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
    color: t.textDim,
    fontSize: 10,
    fontWeight: '700',
  },
  itemMeta: {
    flex: 1,
  },
  itemName: {
    color: t.text,
    fontSize: 14,
    fontWeight: '600',
  },
  itemDate: {
    color: t.textDim,
    fontSize: 12,
  },
  itemAmount: {
    color: t.text,
    fontSize: 14,
    fontWeight: '700',
    marginRight: space.xs,
  },
  priorityBadge: {
    borderColor: t.warn,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priorityText: {
    color: t.warn,
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
    borderColor: t.warn, // Yellow border for featured action
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  featuredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  netflixLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  netflixN: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  featuredMeta: {
    flex: 1,
  },
  featuredTitle: {
    color: t.text,
    fontSize: 16,
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
    marginVertical: space.xs,
  },
  benefitGreen: {
    color: t.ok,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  benefitYellow: {
    color: t.warn,
    fontSize: 13,
    fontWeight: '700',
  },
  doThisBtnYellow: {
    backgroundColor: t.warn,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secondaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bbLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#689F38',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  bbText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryAmount: {
    color: t.text,
    fontSize: 14,
    fontWeight: '700',
    marginRight: space.md,
  },
  doThisBtnOutline: {
    borderColor: t.border,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  doThisBtnTextWhite: {
    color: t.text,
    fontSize: 13,
    fontWeight: '700',
  },
  viewAllBtn: {
    alignItems: 'center',
    marginVertical: space.md,
  },
  viewAllText: {
    color: t.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  footerSecurity: {
    color: t.textFaint,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: space.sm,
  },
});
