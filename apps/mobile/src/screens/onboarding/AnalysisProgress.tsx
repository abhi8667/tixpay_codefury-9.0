import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { t, typography, space, radius } from '../../theme';

interface AnalysisProgressProps {
  onComplete: () => void;
}

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({ onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);

  const steps = [
    { label: 'Reading inbox SMS', detail: 'Parsing bank debit & credit alerts...' },
    { label: 'Finding recurring mandates', detail: 'Discovered 8 auto-debits (SIP, EMI, OTT)...' },
    { label: 'Projecting 30-day balance curve', detail: 'Building shadow ledger & calculating shortfalls...' },
  ];

  useEffect(() => {
    const t1 = setTimeout(() => setStepIndex(1), 1000);
    const t2 = setTimeout(() => setStepIndex(2), 2200);
    const t3 = setTimeout(() => onComplete(), 3400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={t.warn} style={styles.spinner} />
        <Text style={styles.title}>Analyzing Cash-Flow</Text>

        <View style={styles.stepsContainer}>
          {steps.map((step, idx) => {
            const isDone = idx < stepIndex;
            const isCurrent = idx === stepIndex;
            return (
              <View key={idx} style={styles.stepRow}>
                <View
                  style={[
                    styles.stepBadge,
                    isDone && styles.badgeDone,
                    isCurrent && styles.badgeCurrent,
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {isDone ? '✓' : idx + 1}
                  </Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text style={[styles.stepLabel, isCurrent && styles.textCurrent]}>
                    {step.label}
                  </Text>
                  {isCurrent && <Text style={styles.stepDetail}>{step.detail}</Text>}
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
  container: {
    flex: 1,
    backgroundColor: t.bg,
    padding: space.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  spinner: {
    marginBottom: space.lg,
    transform: [{ scale: 1.3 }],
  },
  title: {
    ...typography.title,
    fontSize: 24,
    marginBottom: space.xl,
    textAlign: 'center',
  },
  stepsContainer: {
    width: '100%',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: space.md,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
    marginTop: 2,
  },
  badgeDone: {
    backgroundColor: t.ok,
    borderColor: t.ok,
  },
  badgeCurrent: {
    borderColor: t.warn,
    backgroundColor: '#382A12',
  },
  badgeText: {
    color: t.text,
    fontSize: 12,
    fontWeight: '700',
  },
  stepInfo: {
    flex: 1,
  },
  stepLabel: {
    color: t.textDim,
    fontSize: 15,
    fontWeight: '600',
  },
  textCurrent: {
    color: t.warn,
    fontWeight: '700',
  },
  stepDetail: {
    color: t.textFaint,
    fontSize: 12,
    marginTop: 2,
  },
});
