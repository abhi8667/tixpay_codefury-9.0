import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';

interface PayScreenProps {
  visible: boolean;
  onClose: () => void;
  onPaySuccess: () => void;
}

export const PayScreen: React.FC<PayScreenProps> = ({
  visible,
  onClose,
  onPaySuccess,
}) => {
  const [amountStr, setAmountStr] = useState('1');
  const [showWarningSheet, setShowWarningSheet] = useState(true);
  const [selectedInstrument, setSelectedInstrument] = useState<'WALLET' | 'BANK'>('WALLET');

  const handleKeyPress = (num: string) => {
    if (num === '⌫') {
      setAmountStr(amountStr.slice(0, -1) || '0');
    } else if (num === '.' && amountStr.includes('.')) {
      return;
    } else {
      setAmountStr(amountStr === '0' ? num : amountStr + num);
    }
  };

  const amountVal = parseFloat(amountStr) || 0;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
        </View>

        {/* Payee Info */}
        <View style={styles.payeeSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>T</Text>
          </View>
          <Text style={styles.payeeName}>Tarun Aadhithya V Sureendran Minor</Text>
          <Text style={styles.payeeVpa}>aadhi7525@okicici</Text>
        </View>

        {/* Amount Input */}
        <View style={styles.amountBox}>
          <Text style={styles.rupeeSymbol}>₹</Text>
          <Text style={styles.amountDisplay}>{amountStr}</Text>
        </View>

        <TouchableOpacity style={styles.addNoteBtn}>
          <Text style={styles.addNoteText}>📎 Add a note</Text>
        </TouchableOpacity>

        <ScrollView style={styles.warningList} showsVerticalScrollIndicator={false}>
          {/* Pre-Payment Intercept Warning Stack matching warning.png */}
          <View style={styles.warningItemUrgent}>
            <View style={styles.badgeUrgent}>
              <Text style={styles.badgeUrgentText}>URGENT</Text>
            </View>
            <View style={styles.warningInfo}>
              <Text style={styles.warningTitle}>You'll miss this upcoming SIP</Text>
              <Text style={styles.warningSub}>HDFC Mutual Fund • ₹5,000 on 12 Mar</Text>
            </View>
            <Text style={styles.viewDetailsText}>View Details ›</Text>
          </View>

          <View style={styles.warningItemImportant}>
            <View style={styles.badgeImportant}>
              <Text style={styles.badgeImportantText}>RECOMMENDATION</Text>
            </View>
            <View style={styles.warningInfo}>
              <Text style={styles.warningTitle}>💳 Pay with Amex instead</Text>
              <Text style={styles.warningSub}>You are ₹4,000 from your fee waiver</Text>
            </View>
            <Text style={styles.viewDetailsText}>Use Amex ›</Text>
          </View>
        </ScrollView>

        {/* Bottom Drawer Instrument Selector */}
        <View style={styles.instrumentDrawer}>
          <Text style={styles.payWithLabel}>Pay with</Text>
          <TouchableOpacity
            style={[
              styles.instrumentCard,
              selectedInstrument === 'WALLET' && styles.selectedInstrument,
            ]}
            onPress={() => setSelectedInstrument('WALLET')}
            activeOpacity={0.8}
          >
            <View style={styles.instrumentIcon}>
              <Text style={styles.instLogoText}>FamX</Text>
            </View>
            <View style={styles.instMeta}>
              <Text style={styles.instName}>FamX Wallet UPI</Text>
              <Text style={styles.instBal}>Balance: ₹12,450</Text>
            </View>
            <View style={[styles.radio, selectedInstrument === 'WALLET' && styles.radioActive]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.payNowBtn}
            onPress={onPaySuccess}
            activeOpacity={0.8}
          >
            <Text style={styles.payNowBtnText}>Pay ₹{amountVal.toLocaleString('en-IN')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onPaySuccess} style={styles.payAnywayLink}>
            <Text style={styles.payAnywayText}>Pay anyway without recommendation</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg,
    padding: space.md,
  },
  header: {
    height: 44,
    justifyContent: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backText: {
    color: t.text,
    fontSize: 24,
  },
  payeeSection: {
    alignItems: 'center',
    marginTop: space.sm,
    marginBottom: space.md,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1A365D',
    borderColor: t.accent,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  payeeName: {
    color: t.text,
    fontSize: 16,
    fontWeight: '700',
  },
  payeeVpa: {
    color: t.textDim,
    fontSize: 13,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    height: 70,
    marginVertical: space.sm,
  },
  rupeeSymbol: {
    color: t.warn,
    fontSize: 32,
    fontWeight: '700',
    marginRight: 6,
  },
  amountDisplay: {
    color: t.text,
    fontSize: 36,
    fontWeight: '800',
  },
  addNoteBtn: {
    alignSelf: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: space.md,
  },
  addNoteText: {
    color: t.warn,
    fontSize: 12,
    fontWeight: '600',
  },
  warningList: {
    flex: 1,
  },
  warningItemUrgent: {
    backgroundColor: '#2D1410',
    borderColor: t.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeUrgent: {
    backgroundColor: t.danger,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: space.sm,
  },
  badgeUrgentText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  warningItemImportant: {
    backgroundColor: '#382A12',
    borderColor: t.warn,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeImportant: {
    backgroundColor: t.warn,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: space.sm,
  },
  badgeImportantText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '900',
  },
  warningInfo: {
    flex: 1,
  },
  warningTitle: {
    color: t.text,
    fontSize: 14,
    fontWeight: '700',
  },
  warningSub: {
    color: t.textDim,
    fontSize: 12,
  },
  viewDetailsText: {
    color: t.warn,
    fontSize: 12,
    fontWeight: '700',
  },
  instrumentDrawer: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.sm,
  },
  payWithLabel: {
    color: t.textDim,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: space.xs,
  },
  instrumentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.bg,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: space.sm,
    marginBottom: space.md,
  },
  selectedInstrument: {
    borderColor: t.warn,
  },
  instrumentIcon: {
    width: 36,
    height: 24,
    borderRadius: 4,
    backgroundColor: t.warn,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  instLogoText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '900',
  },
  instMeta: {
    flex: 1,
  },
  instName: {
    color: t.text,
    fontSize: 14,
    fontWeight: '700',
  },
  instBal: {
    color: t.textDim,
    fontSize: 11,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: t.border,
  },
  radioActive: {
    borderColor: t.warn,
    backgroundColor: t.warn,
  },
  payNowBtn: {
    backgroundColor: t.warn,
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  payNowBtnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  payAnywayLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  payAnywayText: {
    color: t.textDim,
    fontSize: 12,
  },
});
