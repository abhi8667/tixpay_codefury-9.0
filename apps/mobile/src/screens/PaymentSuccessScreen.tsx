import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';

interface PaymentSuccessScreenProps {
  visible: boolean;
  amount: number;
  payeeName: string;
  onDismiss: () => void;
}

export const PaymentSuccessScreen: React.FC<PaymentSuccessScreenProps> = ({
  visible,
  amount,
  payeeName,
  onDismiss,
}) => {
  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.centerSection}>
          {/* Glowing Green Checkmark */}
          <View style={styles.checkCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>

          <Rupee amount={amount} style={styles.amountDisplay} showPrefix={false} />
          <Text style={styles.toLabel}>to {payeeName.toUpperCase()}</Text>
          <Text style={styles.vpaText}>aadhi7525@okicici</Text>

          <View style={styles.famAppBadge}>
            <Text style={styles.famAppText}>✓ Paid securely via FamApp</Text>
          </View>

          <View style={styles.speedBadge}>
            <Text style={styles.speedText}>⚡ Paid in 1.24 s</Text>
          </View>

          <Text style={styles.utrText}>UTR: 623327046949 📋</Text>
          <Text style={styles.viewDetailsText}>View Details ›</Text>
        </View>

        {/* 3 Security Badges */}
        <View style={styles.badgesRow}>
          <View style={styles.badgeItem}>
            <Text style={styles.badgeEmoji}>🛡️</Text>
            <Text style={styles.badgeTitle}>100% Secure</Text>
            <Text style={styles.badgeSub}>Your payment is safe with TiXPay</Text>
          </View>
          <View style={styles.badgeItem}>
            <Text style={styles.badgeEmoji}>⚡</Text>
            <Text style={styles.badgeTitle}>Instant Transfer</Text>
            <Text style={styles.badgeSub}>Amount sent successfully</Text>
          </View>
          <View style={styles.badgeItem}>
            <Text style={styles.badgeEmoji}>🧾</Text>
            <Text style={styles.badgeTitle}>Digital Receipt</Text>
            <Text style={styles.badgeSub}>Receipt sent to app inbox</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.analyticsBtn} onPress={onDismiss} activeOpacity={0.8}>
          <Text style={styles.analyticsBtnText}>📊 View Analytics & Balance Curve ›</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg,
    padding: space.lg,
    justifyContent: 'space-between',
  },
  closeBtn: {
    marginTop: space.sm,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: t.text,
    fontSize: 22,
  },
  centerSection: {
    alignItems: 'center',
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0A261C',
    borderColor: t.ok,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  checkIcon: {
    color: t.ok,
    fontSize: 36,
    fontWeight: '800',
  },
  amountDisplay: {
    color: t.text,
    fontSize: 44,
    fontWeight: '900',
    marginBottom: 4,
  },
  toLabel: {
    color: t.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  vpaText: {
    color: t.textDim,
    fontSize: 13,
    marginBottom: space.sm,
  },
  famAppBadge: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: space.xs,
  },
  famAppText: {
    color: t.ok,
    fontSize: 12,
    fontWeight: '600',
  },
  speedBadge: {
    backgroundColor: '#382A12',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginVertical: space.xs,
  },
  speedText: {
    color: t.warn,
    fontSize: 12,
    fontWeight: '700',
  },
  utrText: {
    color: t.textDim,
    fontSize: 13,
    marginTop: space.xs,
  },
  viewDetailsText: {
    color: t.warn,
    fontSize: 13,
    fontWeight: '700',
    marginTop: space.xs,
  },
  badgesRow: {
    flexDirection: 'row',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  badgeItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  badgeEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  badgeTitle: {
    color: t.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  badgeSub: {
    color: t.textFaint,
    fontSize: 10,
    textAlign: 'center',
  },
  analyticsBtn: {
    backgroundColor: t.surface,
    borderColor: t.warn,
    borderWidth: 1,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  analyticsBtnText: {
    color: t.warn,
    fontSize: 15,
    fontWeight: '800',
  },
});
