import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, TextInput } from 'react-native';
import type { PaymentIntent, VerdictLevel } from '@tixpay/types';
import { deriveTxnRef } from '@tixpay/engine';
import { t, typography, space, radius } from '../theme';
import { useAppStore } from '../../store/useAppStore';
import { redact } from '../utils/redaction';
import { QrScanner } from './QrScanner';

interface PayScreenProps {
  visible: boolean;
  onClose: () => void;
  /** Hands the completed payment up so the receipt shows what was actually paid. */
  onPaySuccess: (payment: { amount: number; payeeName: string; vpa: string }) => void;
}

/** Where the pay sheet starts when nothing has been scanned. */
const DEFAULT_PAYEE = { vpa: 'croma.store@ybl', name: 'Croma Electronics' };

/** Verdict level to the three colours the sheet can wear. */
const LEVEL_STYLE: Record<VerdictLevel, { color: string; bg: string; badge: string }> = {
  WARNING: { color: t.danger, bg: '#261214', badge: 'URGENT' },
  ADVISORY: { color: t.warn, bg: '#1E190E', badge: 'HEADS UP' },
  CLEAR: { color: t.ok, bg: '#0E1F16', badge: 'CLEAR' },
};

export const PayScreen: React.FC<PayScreenProps> = ({
  visible,
  onClose,
  onPaySuccess,
}) => {
  const [amountStr, setAmountStr] = useState('8000');
  const [selectedInstrument, setSelectedInstrument] = useState<'WALLET' | 'BANK'>('WALLET');
  const [payee, setPayee] = useState(DEFAULT_PAYEE);
  const [scanning, setScanning] = useState(false);

  const ledger = useAppStore((state) => state.ledger());
  const curve = useAppStore((state) => state.curve());
  const redactionOn = useAppStore((state) => state.redactionOn);
  const executePaymentStore = useAppStore((state) => state.executePayment);
  const evaluate = useAppStore((state) => state.evaluate);
  // The pipeline cache is the real dependency of the verdict below: evaluating
  // against a stale cache would show yesterday's warning after the World Clock
  // moves.
  const pipelineCache = useAppStore((state) => state._pipelineCache);

  const currentBalance = ledger?.currentBalance ?? curve[0]?.balance ?? 0;
  const amountVal = parseFloat(amountStr) || 0;

  /**
   * The intercept.
   *
   * Recomputed on every keystroke because that IS the feature: a judge types
   * 500 and sees green, types 8000 and sees the SIP about to bounce. A cached
   * or debounced verdict reads as a canned response.
   */
  const verdict = useMemo(() => {
    if (amountVal <= 0) return null;
    const intent: PaymentIntent = {
      vpa: payee.vpa,
      payeeName: payee.name,
      amount: amountVal,
      txnRef: deriveTxnRef(payee.vpa, amountVal),
      source: 'MANUAL',
    };
    return evaluate(intent);
  }, [amountVal, payee.vpa, payee.name, evaluate, pipelineCache]);

  const level: VerdictLevel = verdict?.level ?? 'CLEAR';
  const skin = LEVEL_STYLE[level];
  const recommendation = verdict?.recommendation;
  const showRecommendation = recommendation && recommendation.rail === 'CARD_SWIPE';

  const payeeDisplayName = payee.name;
  const payeeVpaDisplay = redactionOn ? redact.vpa(payee.vpa) : payee.vpa;

  const handleScanned = (intent: PaymentIntent) => {
    setPayee({ vpa: intent.vpa, name: intent.payeeName });
    // Static merchant QRs carry no amount; keep whatever the user typed.
    if (intent.amount > 0) setAmountStr(String(intent.amount));
    setScanning(false);
  };

  const handleConfirmPay = () => {
    if (amountVal <= 0) return;
    executePaymentStore(amountVal, payee.name, payee.vpa);
    onPaySuccess({ amount: amountVal, payeeName: payee.name, vpa: payee.vpa });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Text style={styles.backText}>&#8592;</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setScanning(true)} style={styles.scanBtn}>
            <Text style={styles.scanBtnText}>Scan QR</Text>
          </TouchableOpacity>
        </View>

        {/* Payee Info */}
        <View style={styles.payeeSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{payeeDisplayName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.payeeName}>{payeeDisplayName}</Text>
          <Text style={styles.payeeVpa}>{payeeVpaDisplay}</Text>
        </View>

        {/* Interactive Amount Input */}
        <View style={styles.amountBox}>
          <Text style={styles.rupeeSymbol}>&#8377;</Text>
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
                &#8377;{Number(preset).toLocaleString('en-IN')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.warningList} showsVerticalScrollIndicator={false}>
          {/* Pre-payment intercept: live verdict from evaluatePayment() */}
          {verdict && (
            <View
              style={[
                styles.verdictCard,
                { backgroundColor: skin.bg, borderColor: skin.color },
              ]}
            >
              <View style={styles.verdictHeaderRow}>
                <View style={[styles.badge, { backgroundColor: skin.color }]}>
                  <Text style={styles.badgeText}>{skin.badge}</Text>
                </View>
                {verdict.recommendation && verdict.recommendation.mccConfidence < 1 && (
                  <Text style={styles.mccConfidence}>
                    merchant match {Math.round(verdict.recommendation.mccConfidence * 100)}%
                  </Text>
                )}
              </View>

              <Text style={[styles.verdictHeadline, { color: skin.color }]}>
                {verdict.headline}
              </Text>
              {verdict.subline && <Text style={styles.verdictSubline}>{verdict.subline}</Text>}

              {verdict.atRisk.length > 0 && (
                <View style={styles.atRiskBlock}>
                  {verdict.atRisk.slice(0, 3).map((m) => (
                    <View key={m.id} style={styles.atRiskRow}>
                      <Text style={styles.atRiskName}>{m.displayName}</Text>
                      <Text style={styles.atRiskAmount}>
                        &#8377;{m.amount.toLocaleString('en-IN')}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Cross-rail arbitrage: only when the engine actually prefers a card */}
          {showRecommendation && (
            <View style={styles.warningItemImportant}>
              <View style={styles.badgeImportant}>
                <Text style={styles.badgeImportantText}>BETTER RAIL</Text>
              </View>
              <View style={styles.warningInfo}>
                <Text style={styles.warningTitle}>
                  {typeof recommendation.instrument === 'string'
                    ? 'Bank account'
                    : recommendation.instrument.name}
                </Text>
                <Text style={styles.warningSub}>{recommendation.reason}</Text>
                {recommendation.warnings.map((w) => (
                  <Text key={w} style={styles.warningCaveat}>{w}</Text>
                ))}
              </View>
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
              <Text style={styles.instName}>
                HDFC Bank UPI ({redactionOn ? redact.tail('4471') : '4471'})
              </Text>
              <Text style={styles.instBal}>
                Available Balance: &#8377;{currentBalance.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={[styles.radio, selectedInstrument === 'WALLET' && styles.radioActive]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.payNowBtn, { backgroundColor: skin.color }]}
            onPress={handleConfirmPay}
            activeOpacity={0.8}
          >
            <Text style={styles.payNowBtnText}>
              Pay &#8377;{amountVal.toLocaleString('en-IN')}
            </Text>
          </TouchableOpacity>

          {level !== 'CLEAR' && (
            <TouchableOpacity onPress={handleConfirmPay} style={styles.payAnywayLink}>
              <Text style={styles.payAnywayText}>Pay anyway</Text>
            </TouchableOpacity>
          )}
        </View>

        <QrScanner
          visible={scanning}
          onClose={() => setScanning(false)}
          onScanned={handleScanned}
        />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scanBtn: {
    backgroundColor: t.surfaceHi,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  scanBtnText: {
    color: t.text,
    fontSize: 13,
    fontWeight: '700',
  },
  verdictCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  verdictHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.xs,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
  },
  mccConfidence: {
    color: t.textDim,
    fontSize: 10,
    fontWeight: '600',
  },
  verdictHeadline: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  verdictSubline: {
    color: t.text,
    fontSize: 13,
    marginTop: 4,
  },
  atRiskBlock: {
    marginTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: t.border,
    paddingTop: space.xs,
  },
  atRiskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  atRiskName: {
    color: t.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  atRiskAmount: {
    color: t.text,
    fontSize: 12,
    fontWeight: '700',
  },
  warningCaveat: {
    color: t.textDim,
    fontSize: 10,
    marginTop: 2,
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
