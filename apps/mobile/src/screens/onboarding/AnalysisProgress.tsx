import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { t, typography, space, radius } from '../../theme';
import { useAppStore } from '../../../store/useAppStore';

interface AnalysisProgressProps {
  onComplete: () => void;
}

/**
 * The analysis is already done by the time this screen mounts — the pipeline is
 * synchronous and ran the moment the file was parsed. So every number here is
 * the real result, revealed in sequence rather than invented for a loading
 * animation.
 *
 * The staging is honest theatre: nothing is fabricated, it is only paced. If
 * the statement produced three mandates, this says three.
 */
export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({ onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);

  const imported = useAppStore((s) => s.imported);
  const mandateCount = useAppStore((s) => s.mandates().length);
  const shortfallCount = useAppStore((s) => s.shortfalls().length);
  const ledger = useAppStore((s) => s.ledger());

  const balance = ledger?.currentBalance ?? 0;
  const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  const steps = [
    {
      label: 'Reading the statement',
      detail: imported
        ? `${imported.parsed} of ${imported.rows} rows · ${imported.bank}${
            imported.accountTail ? ` ••${imported.accountTail}` : ''
          }`
        : 'Parsing transactions…',
    },
    {
      label: 'Finding recurring mandates',
      detail:
        mandateCount > 0
          ? `Found ${mandateCount} auto-debit${mandateCount === 1 ? '' : 's'} by median gap`
          : 'No recurring debits found in this statement',
    },
    {
      label: 'Projecting 30 days forward',
      detail:
        shortfallCount > 0
          ? `Balance ${money(balance)} · ${shortfallCount} shortfall${
              shortfallCount === 1 ? '' : 's'
            } ahead`
          : `Balance ${money(balance)} · no shortfalls ahead`,
    },
  ];

  useEffect(() => {
    const timers = [
      setTimeout(() => setStepIndex(1), 900),
      setTimeout(() => setStepIndex(2), 1800),
      setTimeout(() => onComplete(), 2900),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={t.warn} style={styles.spinner} />
        <Text style={styles.title}>Analysing cash flow</Text>
        <Text style={styles.subtitle}>On this device. Nothing is uploaded.</Text>

        <View style={styles.stepsContainer}>
          {steps.map((step, idx) => {
            const isDone = idx < stepIndex;
            const isCurrent = idx === stepIndex;
            return (
              <View key={step.label} style={styles.stepRow}>
                <View
                  style={[
                    styles.stepBadge,
                    isDone && styles.badgeDone,
                    isCurrent && styles.badgeCurrent,
                  ]}
                >
                  <Text style={styles.badgeText}>{isDone ? '✓' : idx + 1}</Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text style={[styles.stepLabel, isCurrent && styles.textCurrent]}>
                    {step.label}
                  </Text>
                  {(isCurrent || isDone) && <Text style={styles.stepDetail}>{step.detail}</Text>}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg, padding: space.lg },
  center: { flex: 1, justifyContent: 'center' },
  spinner: { marginBottom: space.lg },
  title: { ...typography.title, fontSize: 22, textAlign: 'center' },
  subtitle: {
    ...typography.caption,
    fontSize: 12,
    textAlign: 'center',
    marginTop: space.xs,
    color: t.ok,
  },
  stepsContainer: {
    marginTop: space.xl,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.md },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: t.surfaceHi,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.sm,
  },
  badgeDone: { backgroundColor: t.ok, borderColor: t.ok },
  badgeCurrent: { borderColor: t.warn },
  badgeText: { color: t.text, fontSize: 12, fontWeight: '700' },
  stepInfo: { flex: 1 },
  stepLabel: { color: t.textDim, fontSize: 14, fontWeight: '600' },
  textCurrent: { color: t.text },
  stepDetail: { color: t.textFaint, fontSize: 12, marginTop: 2, lineHeight: 17 },
});
