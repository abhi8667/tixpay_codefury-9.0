import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';

interface ConfirmActionModalProps {
  visible: boolean;
  actionTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  visible,
  actionTitle,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.cardContainer}>
          {/* Glowing Green Checkmark */}
          <View style={styles.checkCircleGlowing}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>

          <Text style={styles.title}>Action selected</Text>
          <Text style={styles.subtitle}>We'll update your plan</Text>

          {/* Selected Action Card */}
          <View style={styles.actionCard}>
            <View style={styles.netflixLogo}>
              <Text style={styles.netflixN}>N</Text>
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionName}>Netflix</Text>
              <Text style={styles.actionSub}>Paused on Mar 12</Text>
            </View>
            <Rupee amount={649} style={styles.actionAmount} showPrefix={false} />
          </View>

          {/* Impact Checklist */}
          <View style={styles.impactBox}>
            <Text style={styles.impactTitle}>What this does</Text>
            <View style={styles.impactRow}>
              <Text style={styles.greenCheck}>✓</Text>
              <Text style={styles.impactText}>Keeps your ₹5,000 SIP safe</Text>
            </View>
            <View style={styles.impactRow}>
              <Text style={styles.greenCheck}>✓</Text>
              <Text style={styles.impactText}>₹250 penalty avoided</Text>
            </View>
          </View>

          {/* CTAs */}
          <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm} activeOpacity={0.8}>
            <Text style={styles.confirmBtnText}>Confirm & Apply</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.infoFooter}>ⓘ Changes will reflect instantly</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.md,
  },
  cardContainer: {
    backgroundColor: t.bg,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.sheet,
    padding: space.lg,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  checkCircleGlowing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0A261C',
    borderColor: t.ok,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  checkIcon: {
    color: t.ok,
    fontSize: 32,
    fontWeight: '800',
  },
  title: {
    color: t.ok,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: t.textDim,
    fontSize: 14,
    marginBottom: space.lg,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    width: '100%',
    marginBottom: space.md,
  },
  netflixLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  netflixN: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  actionInfo: {
    flex: 1,
  },
  actionName: {
    color: t.text,
    fontSize: 16,
    fontWeight: '700',
  },
  actionSub: {
    color: t.textDim,
    fontSize: 12,
  },
  actionAmount: {
    color: t.text,
    fontSize: 18,
    fontWeight: '800',
  },
  impactBox: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    width: '100%',
    marginBottom: space.lg,
  },
  impactTitle: {
    color: t.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: space.sm,
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  greenCheck: {
    color: t.ok,
    fontSize: 14,
    fontWeight: '800',
    marginRight: space.xs,
  },
  impactText: {
    color: t.text,
    fontSize: 14,
    fontWeight: '500',
  },
  confirmBtn: {
    backgroundColor: t.warn,
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: space.sm,
  },
  confirmBtnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  cancelBtn: {
    paddingVertical: 8,
    marginBottom: space.sm,
  },
  cancelBtnText: {
    color: t.warn,
    fontSize: 14,
    fontWeight: '700',
  },
  infoFooter: {
    color: t.textFaint,
    fontSize: 12,
  },
});
