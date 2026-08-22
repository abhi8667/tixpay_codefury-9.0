import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, TextInput } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { useAppStore } from '../../store/useAppStore';

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
  const [amountStr, setAmountStr] = useState('8000');
  const [selectedInstrument, setSelectedInstrument] = useState<'WALLET' | 'BANK'>('WALLET');

  const recommendation = useAppStore((state) => state.recommendation());
  const shortfalls = useAppStore((state) => state.shortfalls());
  const ledger = useAppStore((state) => state.ledger());
  const curve = useAppStore((state) => state.curve());
  const redactionOn = useAppStore((state) => state.redactionOn);
  const executePaymentStore = useAppStore((state) => state.executePayment);

  const currentBalance = ledger?.currentBalance ?? (curve[0]?.balance ?? 12450);
  const activeShortfall = shortfalls.length > 0 ? shortfalls[0] : undefined;
  const atRiskItem = activeShortfall?.atRisk?.[0];

  const amountVal = parseFloat(amountStr) || 0;
  const payeeDisplayName = redactionOn ? 'Tarun Aadhithya ••••' : 'Tarun Aadhithya V Sureendran Minor';
  const payeeVpaDisplay = redactionOn ? 'aadhi••••@okicici' : 'aadhi7525@okicici';

  const handleConfirmPay = () => {
    if (amountVal > 0) {
      executePaymentStore(amountVal, payeeDisplayName);
    }
    onPaySuccess();
  };

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
          <Text style={styles.payeeName}>{payeeDisplayName}</Text>
          <Text style={styles.payeeVpa}>{payeeVpaDisplay}</Text>
        </View>

        {/* Interactive Amount Input */}
        <View style={styles.amountBox}>
          <Text style={styles.rupeeSymbol}>₹</Text>
          <TextInput
            style={styles.amountInput}
            value={amountStr}
            onChangeText={setAmountStr}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={t.textDim}
          />
        </View>

        {/* Preset Amount Chips */}
        <View style={styles.presetChipsRow}>
          {['500', '2500', '5000', '8000'].map((preset) => (
            <TouchableOpacity
              key={preset}
              style={[styles.presetChip, amountStr === preset && styles.presetChipActive]}
              onPress={() => setAmountStr(preset)}
            >
              <Text style={[styles.presetChipText, amountStr === preset && styles.presetChipTextActive]}>
                ₹{Number(preset).toLocaleString('en-IN')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.warningList} showsVerticalScrollIndicator={false}>
          {/* Pre-Payment Intercept Warning Stack */}
          {activeShortfall && (
            <View style={styles.warningItemUrgent}>
              <View style={styles.badgeUrgent}>
                <Text style={styles.badgeUrgentText}>URGENT</Text>
              </View>
              <View style={styles.warningInfo}>
                <Text style={styles.warningTitle}>You'll miss an upcoming critical debit</Text>
                <Text style={styles.warningSub}>
                  {atRiskItem ? `${atRiskItem.displayName} • ₹${atRiskItem.amount} on ${atRiskItem.dayOfMonth} Mar` : '₹3,200 deficit projected on Mar 12'}
                </Text>
              </View>
              <Text style={styles.viewDetailsText}>View Details ›</Text>
            </View>
          )}

          {recommendation && (
            <View style={styles.warningItemImportant}>
              <View style={styles.badgeImportant}>
                <Text style={styles.badgeImportantText}>RECOMMENDATION</Text>
              </View>
              <View style={styles.warningInfo}>
                <Text style={styles.warningTitle}>
                  💳 {typeof recommendation.instrument === 'string' ? recommendation.instrument : recommendation.instrument.name}
                </Text>
                <Text style={styles.warningSub}>{recommendation.reason}</Text>
              </View>
              <Text style={styles.viewDetailsText}>Switch ›</Text>
            </View>
          )}
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
              <Text style={styles.instLogoText}>Bank</Text>
            </View>
            <View style={styles.instMeta}>
              <Text style={styles.instName}>HDFC Bank UPI (**4471)</Text>
              <Text style={styles.instBal}>
                Available Balance: ₹{currentBalance.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={[styles.radio, selectedInstrument === 'WALLET' && styles.radioActive]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.payNowBtn}
            onPress={handleConfirmPay}
            activeOpacity={0.8}
          >
            <Text style={styles.payNowBtnText}>Pay ₹{amountVal.toLocaleString('en-IN')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleConfirmPay} style={styles.payAnywayLink}>
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
    backgroundColor: t.surfaceHi,
    borderColor: t.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  avatarText: {
    color: t.warn,
    fontSize: 24,
    fontWeight: '800',
  },
  payeeName: {
    color: t.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  payeeVpa: {
    color: t.textDim,
    fontSize: 13,
    marginTop: 2,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: space.md,
  },
  rupeeSymbol: {
    color: t.textDim,
    fontSize: 32,
    fontWeight: '700',
    marginRight: 4,
  },
  amountInput: {
    color: t.text,
    fontSize: 42,
    fontWeight: '900',
    minWidth: 100,
    textAlign: 'center',
    padding: 0,
  },
  presetChipsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.xs,
    marginBottom: space.md,
  },
  presetChip: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
  },
  presetChipActive: {
    backgroundColor: t.warn,
    borderColor: t.warn,
  },
  presetChipText: {
    color: t.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: '#000000',
    fontWeight: '800',
  },

  addNoteBtn: {
    alignSelf: 'center',
    backgroundColor: t.surfaceHi,
    borderRadius: 16,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    marginBottom: space.md,
  },
  addNoteText: {
    color: t.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  warningList: {
    flex: 1,
  },
  warningItemUrgent: {
    backgroundColor: '#261214',
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
    fontSize: 10,
    fontWeight: '900',
  },
  warningInfo: {
    flex: 1,
  },
  warningTitle: {
    color: t.text,
    fontSize: 13,
    fontWeight: '700',
  },
  warningSub: {
    color: t.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  viewDetailsText: {
    color: t.danger,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: space.xs,
  },
  warningItemImportant: {
    backgroundColor: '#1E190E',
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
  instrumentDrawer: {
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: t.border,
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
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  selectedInstrument: {
    borderColor: t.warn,
    backgroundColor: t.surfaceHi,
  },
  instrumentIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: t.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  instLogoText: {
    color: t.warn,
    fontSize: 11,
    fontWeight: '800',
  },
  instMeta: {
    flex: 1,
  },
  instName: {
    color: t.text,
    fontSize: 15,
    fontWeight: '700',
  },
  instBal: {
    color: t.ok,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: t.border,
  },
  radioActive: {
    borderColor: t.warn,
    backgroundColor: t.warn,
  },
  payNowBtn: {
    backgroundColor: t.warn,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  payNowBtnText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '800',
  },
  payAnywayLink: {
    alignItems: 'center',
    paddingVertical: space.xs,
  },
  payAnywayText: {
    color: t.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
});
