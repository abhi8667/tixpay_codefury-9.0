import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { t, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';
import { redact } from '../utils/redaction';
import { useAppStore } from '../../store/useAppStore';

interface PaymentSuccessScreenProps {
  visible: boolean;
  amount: number;
  payeeName: string;
  vpa: string;
  onDismiss: () => void;
}

/**
 * The receipt for a SIMULATED payment.
 *
 * No money moved. TiXPay is not a PSP and holds no UPI licence, so this screen
 * says so plainly rather than dressing up a mock transfer as a real one — the
 * product on show is the analysis, and pretending to move money would put the
 * one genuinely trustworthy thing about this app in question.
 *
 * Everything rendered here comes from the payment the user actually made:
 * a previous version hardcoded ₹8,000 and a fixed payee, so paying ₹500
 * produced a receipt for someone else's ₹8,000.
 */
export const PaymentSuccessScreen: React.FC<PaymentSuccessScreenProps> = ({
  visible,
  amount,
  payeeName,
  vpa,
  onDismiss,
}) => {
  const ledger = useAppStore((s) => s.ledger());
  const shortfalls = useAppStore((s) => s.shortfalls());

  const balance = ledger?.currentBalance ?? 0;
  const nextDip = shortfalls[0];

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.centerSection}>
            <View style={styles.checkCircle}>
              <Text style={styles.checkIcon}>✓</Text>
            </View>

            <Rupee amount={amount} style={styles.amountDisplay} showPrefix={false} />
            <Text style={styles.toLabel}>to {payeeName.toUpperCase()}</Text>
            {vpa ? <Text style={styles.vpaText}>{redact.vpa(vpa)}</Text> : null}

            <View style={styles.simBadge}>
              <Text style={styles.simText}>SIMULATED — no money moved</Text>
            </View>

            <Text style={styles.simExplain}>
              TiXPay is not a payment provider. This debit is applied to your local ledger so
              you can see its effect on the projection.
            </Text>
          </View>

          <View style={styles.impactCard}>
            <Text style={styles.impactHeader}>What this did to your projection</Text>

            <View style={styles.impactRow}>
              <Text style={styles.impactLabel}>Balance now</Text>
              <Rupee amount={balance} style={styles.impactValue} showPrefix={false} />
            </View>

            <View style={styles.impactRow}>
              <Text style={styles.impactLabel}>Next shortfall</Text>
              <Text style={[styles.impactValue, nextDip ? styles.bad : styles.good]}>
                {nextDip
                  ? `${nextDip.date.getDate()} ${nextDip.date.toLocaleString('en-IN', {
                      month: 'short',
                    })} · ₹${Math.round(nextDip.deficit).toLocaleString('en-IN')} short`
                  : 'None in 30 days'}
              </Text>
            </View>

            {nextDip && nextDip.atRisk[0] ? (
              <Text style={styles.atRiskLine}>
                {nextDip.atRisk[0].displayName} ₹
                {nextDip.atRisk[0].amount.toLocaleString('en-IN')} is at risk.
              </Text>
            ) : null}
          </View>
        </ScrollView>

        <TouchableOpacity style={styles.analyticsBtn} onPress={onDismiss} activeOpacity={0.8}>
          <Text style={styles.analyticsBtnText}>📊 View balance curve ›</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg, padding: space.lg },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  closeBtn: {
    marginTop: space.sm,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: t.text, fontSize: 22 },
  centerSection: { alignItems: 'center' },
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
  checkIcon: { color: t.ok, fontSize: 36, fontWeight: '800' },
  amountDisplay: { color: t.text, fontSize: 44, fontWeight: '900', marginBottom: 4 },
  toLabel: { color: t.text, fontSize: 14, fontWeight: '600' },
  vpaText: { color: t.textDim, fontSize: 13, marginTop: 2 },
  simBadge: {
    marginTop: space.md,
    borderWidth: 1,
    borderColor: t.warn,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  simText: { color: t.warn, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  simExplain: {
    color: t.textFaint,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: space.sm,
    maxWidth: 300,
  },
  impactCard: {
    marginTop: space.xl,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  impactHeader: { color: t.text, fontSize: 14, fontWeight: '700', marginBottom: space.sm },
  impactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  impactLabel: { color: t.textDim, fontSize: 13 },
  impactValue: { color: t.text, fontSize: 15, fontWeight: '700' },
  good: { color: t.ok },
  bad: { color: t.danger },
  atRiskLine: { color: t.textDim, fontSize: 12, lineHeight: 18, marginTop: 2 },
  analyticsBtn: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: t.surfaceHi,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyticsBtnText: { color: t.text, fontSize: 15, fontWeight: '700' },
});
