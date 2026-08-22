import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { useAppStore } from '../../store/useAppStore';
import { formatIstDate } from '@tixpay/engine';
import type { Cadence, VerdictLevel } from '@tixpay/types';

interface SipCheckScreenProps {
  onBack?: () => void;
}

const CADENCES: Cadence[] = ['MONTHLY', 'WEEKLY', 'QUARTERLY'];

const VERDICT_STYLE: Record<VerdictLevel, { bg: string; border: string; text: string; icon: string }> = {
  CLEAR: { bg: '#0A261C', border: t.ok, text: t.ok, icon: '✓' },
  ADVISORY: { bg: '#262010', border: t.warn, text: t.warn, icon: '⚠️' },
  WARNING: { bg: '#2A1416', border: t.danger, text: t.danger, icon: '⛔' },
};

/**
 * "Students begin SIPs without understanding risk" — the theme brief's own
 * words. This runs a proposed SIP against the same 90-day cash-flow
 * projection the guard already trusts, before the user commits to it, rather
 * than after a bounce happens.
 */
export const SipCheckScreen: React.FC<SipCheckScreenProps> = ({ onBack }) => {
  const [amountStr, setAmountStr] = useState('5000');
  const [cadence, setCadence] = useState<Cadence>('MONTHLY');
  const [dayOfMonth, setDayOfMonth] = useState('5');
  const [checked, setChecked] = useState(false);

  const checkSip = useAppStore((s) => s.checkSip);
  const hasData = useAppStore((s) => s.hasData());

  const amount = Math.max(0, parseInt(amountStr, 10) || 0);
  const day = Math.min(28, Math.max(1, parseInt(dayOfMonth, 10) || 1));

  const result = useMemo(() => {
    if (!checked || amount <= 0) return null;
    return checkSip(amount, cadence, day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked]);

  const style = result ? VERDICT_STYLE[result.level] : null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SIP Readiness Check</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.introText}>
          Before you commit to a new SIP, see what it does to your projected balance over the next 90 days.
        </Text>

        <Text style={styles.fieldLabel}>Monthly amount</Text>
        <View style={styles.amountRow}>
          <Text style={styles.rupeeSign}>₹</Text>
          <TextInput
            value={amountStr}
            onChangeText={(v) => {
              setAmountStr(v.replace(/[^0-9]/g, ''));
              setChecked(false);
            }}
            keyboardType="number-pad"
            style={styles.amountInput}
            placeholder="5000"
            placeholderTextColor={t.textFaint}
          />
        </View>

        <Text style={styles.fieldLabel}>Cadence</Text>
        <View style={styles.cadenceRow}>
          {CADENCES.map((c) => {
            const isActive = c === cadence;
            return (
              <TouchableOpacity
                key={c}
                style={[styles.cadencePill, isActive && styles.cadencePillActive]}
                onPress={() => {
                  setCadence(c);
                  setChecked(false);
                }}
              >
                <Text style={[styles.cadenceText, isActive && styles.cadenceTextActive]}>
                  {c === 'MONTHLY' ? 'Monthly' : c === 'WEEKLY' ? 'Weekly' : 'Quarterly'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Debit day of month</Text>
        <TextInput
          value={dayOfMonth}
          onChangeText={(v) => {
            setDayOfMonth(v.replace(/[^0-9]/g, ''));
            setChecked(false);
          }}
          keyboardType="number-pad"
          style={styles.dayInput}
          placeholder="5"
          placeholderTextColor={t.textFaint}
        />

        <TouchableOpacity
          style={[styles.checkBtn, (!hasData || amount <= 0) && styles.btnDisabled]}
          onPress={() => setChecked(true)}
          disabled={!hasData || amount <= 0}
          activeOpacity={0.85}
        >
          <Text style={styles.checkBtnText}>Check affordability</Text>
        </TouchableOpacity>

        {result && style && (
          <View style={[styles.resultCard, { backgroundColor: style.bg, borderColor: style.border }]}>
            <Text style={styles.resultIcon}>{style.icon}</Text>
            <View style={styles.resultInfo}>
              <Text style={[styles.resultHeadline, { color: style.text }]}>{result.headline}</Text>
              {result.subline && <Text style={styles.resultSubline}>{result.subline}</Text>}
              {result.newShortfalls.length > 0 && (
                <View style={styles.dateList}>
                  {result.newShortfalls.slice(0, 3).map((sf) => (
                    <Text key={sf.date.getTime()} style={styles.dateItem}>
                      • {formatIstDate(sf.date)} — short by ₹{Math.round(sf.deficit).toLocaleString('en-IN')}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {!hasData && <Text style={styles.noDataText}>Import a statement first to run this check.</Text>}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  headerRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  backBtn: { width: 32 },
  backText: { color: t.text, fontSize: 22 },
  headerTitle: { ...typography.title, fontSize: 16 },
  content: { flex: 1 },
  scrollContent: { padding: space.md, paddingBottom: 40 },
  introText: { color: t.textDim, fontSize: 13, lineHeight: 19, marginBottom: space.lg },
  fieldLabel: { color: t.textDim, fontSize: 12, fontWeight: '600', marginBottom: space.xs, marginTop: space.md },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  rupeeSign: { color: t.textDim, fontSize: 20, marginRight: space.xs },
  amountInput: { flex: 1, color: t.text, fontSize: 22, fontWeight: '700', paddingVertical: space.sm },
  cadenceRow: { flexDirection: 'row', gap: space.sm },
  cadencePill: {
    flex: 1,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    alignItems: 'center',
  },
  cadencePillActive: { borderColor: t.warn, backgroundColor: '#262010' },
  cadenceText: { color: t.textDim, fontSize: 13, fontWeight: '600' },
  cadenceTextActive: { color: t.warn, fontWeight: '700' },
  dayInput: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: t.text,
    fontSize: 16,
    fontWeight: '600',
    width: 80,
  },
  checkBtn: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: t.warn,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.lg,
  },
  btnDisabled: { opacity: 0.4 },
  checkBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.lg,
  },
  resultIcon: { fontSize: 20, marginRight: space.sm },
  resultInfo: { flex: 1 },
  resultHeadline: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  resultSubline: { color: t.textDim, fontSize: 13, marginTop: 4 },
  dateList: { marginTop: space.sm },
  dateItem: { color: t.textDim, fontSize: 12, marginTop: 2 },
  noDataText: { color: t.textFaint, fontSize: 12, textAlign: 'center', marginTop: space.md },
});
