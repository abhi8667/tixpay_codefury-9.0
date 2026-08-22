import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Alert } from 'react-native';
import { t, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';
import { redact } from '../utils/redaction';
import { useAppStore } from '../../store/useAppStore';
import Svg, { Path } from 'react-native-svg';

interface PaymentSuccessScreenProps {
  visible: boolean;
  amount: number;
  payeeName: string;
  vpa: string;
  onDismiss: () => void;
}

export const PaymentSuccessScreen: React.FC<PaymentSuccessScreenProps> = ({
  visible,
  amount,
  payeeName,
  vpa,
  onDismiss,
}) => {
  const ledger = useAppStore((s) => s.ledger());
  const shortfalls = useAppStore((s) => s.shortfalls());

  const [disputed, setDisputed] = useState(false);

  const balance = ledger?.currentBalance ?? 0;
  const nextDip = shortfalls[0];
  const utr = `UTR ${Math.floor(100000000000 + Math.random() * 900000000000)}`;
  const now = new Date().toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleDispute = () => {
    setDisputed(true);
    Alert.alert(
      'Dispute Registered',
      `Dispute ticket #${Math.floor(100000 + Math.random() * 900000)} has been logged for UTR ${utr}. On-device audit log updated.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onDismiss}>
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
              <Text style={styles.simText}>SUCCESS — LEDGER RECONCILED</Text>
            </View>

            <Text style={styles.simExplain}>
              TiXPay applied this debit to your on-device ledger to project your 30-day balance safety.
            </Text>
          </View>

          {/* ── Transaction Details Card ────────────────────────────────────── */}
          <View style={styles.receiptCard}>
            <Text style={styles.cardHeader}>Transaction Details</Text>
            
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Transaction Ref / UTR</Text>
              <Text style={styles.receiptValue}>{utr}</Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Debited From</Text>
              <Text style={styles.receiptValue}>HDFC Bank (•••• 4471)</Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Date &amp; Time</Text>
              <Text style={styles.receiptValue}>{now}</Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Payment Status</Text>
              <Text style={[styles.receiptValue, { color: t.ok }]}>Success (Simulated)</Text>
            </View>
          </View>

          {/* ── Impact Card ───────────────────────────────────────────────── */}
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

          <TouchableOpacity style={styles.disputeBtn} onPress={handleDispute} disabled={disputed}>
            <Text style={styles.disputeBtnText}>{disputed ? '✓ Dispute Registered' : 'Raise Dispute / Report Problem'}</Text>
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity style={styles.analyticsBtn} onPress={onDismiss} activeOpacity={0.8}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M18 20V10" />
              <Path d="M12 20V4" />
              <Path d="M6 20v-6" />
            </Svg>
            <Text style={styles.analyticsBtnText}>View balance curve ›</Text>
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg, padding: space.lg },
  scroll: { flexGrow: 1, paddingVertical: space.md },
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
    borderColor: t.ok,
    backgroundColor: 'rgba(45, 212, 160, 0.1)',
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  simText: { color: t.ok, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  simExplain: {
    color: t.textFaint,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: space.sm,
    maxWidth: 300,
  },

  // Receipt Card
  receiptCard: {
    marginTop: space.lg,
    backgroundColor: '#111622',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  cardHeader: { color: t.text, fontSize: 14, fontWeight: '700', marginBottom: space.sm },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  receiptLabel: { color: t.textDim, fontSize: 12 },
  receiptValue: { color: t.text, fontSize: 12, fontWeight: '600' },

  // Impact Card
  impactCard: {
    marginTop: space.md,
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

  disputeBtn: {
    marginTop: space.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: radius.md,
    backgroundColor: '#0F172A',
  },
  disputeBtnText: {
    color: t.textDim,
    fontSize: 12,
    fontWeight: '600',
  },

  analyticsBtn: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: t.surfaceHi,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  analyticsBtnText: { color: t.text, fontSize: 15, fontWeight: '700' },
});
