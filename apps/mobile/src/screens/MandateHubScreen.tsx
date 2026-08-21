import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { Rupee } from '../components/Rupee';
import { mockMandates } from '@tixpay/types';

interface MandateHubScreenProps {
  onBack?: () => void;
}

export const MandateHubScreen: React.FC<MandateHubScreenProps> = ({ onBack }) => {
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

  const filters = [
    { label: 'All 12', val: 'ALL' },
    { label: 'Critical 2', val: 'CRITICAL' },
    { label: 'High 3', val: 'HIGH' },
    { label: 'Medium 4', val: 'MEDIUM' },
    { label: 'Low 3', val: 'LOW' },
  ];

  const criticals = mockMandates.filter((m) => m.priority === 'CRITICAL');
  const highs = mockMandates.filter((m) => m.priority === 'HIGH');
  const mediums = mockMandates.filter((m) => m.priority === 'MEDIUM');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mandate Hub</Text>
        <Text style={styles.filterIcon}>∇</Text>
      </View>

      {/* Category Tabs */}
      <View style={styles.tabRow}>
        {filters.map((f) => {
          const isActive = activeFilter === f.val;
          return (
            <TouchableOpacity
              key={f.val}
              style={[styles.tabItem, isActive && styles.activeTabItem]}
              onPress={() => setActiveFilter(f.val as any)}
            >
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* CRITICAL SECTION */}
        {(activeFilter === 'ALL' || activeFilter === 'CRITICAL') && (
          <View style={styles.section}>
            <Text style={styles.criticalTitle}>CRITICAL</Text>
            {criticals.map((m) => (
              <View key={m.id} style={styles.mandateRow}>
                <View style={styles.logoCircle}>
                  <Text style={styles.logoText}>SIP</Text>
                </View>
                <View style={styles.mandateInfo}>
                  <Text style={styles.mandateName}>{m.displayName}</Text>
                  <Text style={styles.mandateMeta}>Monthly • Next: Mar {m.dayOfMonth}</Text>
                  <Text style={styles.provenanceText}>
                    {Math.round(m.confidence * 100)}% confidence • Found from {m.occurrences} SMS
                  </Text>
                </View>
                <Rupee amount={m.amount} style={styles.mandateAmount} showPrefix={false} />
              </View>
            ))}
          </View>
        )}

        {/* HIGH SECTION */}
        {(activeFilter === 'ALL' || activeFilter === 'HIGH') && (
          <View style={styles.section}>
            <Text style={styles.highTitle}>HIGH</Text>
            {highs.map((m) => (
              <View key={m.id} style={styles.mandateRow}>
                <View style={styles.logoCircle}>
                  <Text style={styles.logoText}>{m.displayName.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={styles.mandateInfo}>
                  <Text style={styles.mandateName}>{m.displayName}</Text>
                  <Text style={styles.mandateMeta}>Monthly • Next: Mar {m.dayOfMonth}</Text>
                  <Text style={styles.provenanceText}>
                    {Math.round(m.confidence * 100)}% confidence • Found from {m.occurrences} SMS
                  </Text>
                </View>
                <Rupee amount={m.amount} style={styles.mandateAmount} showPrefix={false} />
              </View>
            ))}
          </View>
        )}

        {/* MEDIUM SECTION */}
        {(activeFilter === 'ALL' || activeFilter === 'MEDIUM') && (
          <View style={styles.section}>
            <Text style={styles.mediumTitle}>MEDIUM</Text>
            {mediums.map((m) => (
              <View key={m.id} style={styles.mandateRow}>
                <View style={styles.logoCircle}>
                  <Text style={styles.logoText}>⚡</Text>
                </View>
                <View style={styles.mandateInfo}>
                  <Text style={styles.mandateName}>{m.displayName}</Text>
                  <Text style={styles.mandateMeta}>Monthly • Next: Mar {m.dayOfMonth}</Text>
                  <Text style={styles.provenanceText}>
                    {Math.round(m.confidence * 100)}% confidence • Found from {m.occurrences} SMS
                  </Text>
                </View>
                <Rupee amount={m.amount} style={styles.mandateAmount} showPrefix={false} />
              </View>
            ))}
          </View>
        )}

        <View style={styles.confidenceCard}>
          <Text style={styles.shieldIcon}>🛡️</Text>
          <View style={styles.confidenceMeta}>
            <Text style={styles.confidenceCardTitle}>Confidence levels</Text>
            <Text style={styles.confidenceCardSub}>
              Based on SMS history, transaction patterns and merchant detection
            </Text>
          </View>
          <Text style={styles.arrowRight}>›</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg,
  },
  headerRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
  },
  backBtn: {
    padding: space.xs,
  },
  backText: {
    color: t.text,
    fontSize: 22,
    fontWeight: '600',
  },
  headerTitle: {
    color: t.text,
    fontSize: 18,
    fontWeight: '700',
  },
  filterIcon: {
    color: t.textDim,
    fontSize: 18,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: t.border,
    paddingHorizontal: space.md,
  },
  tabItem: {
    paddingVertical: space.sm,
    marginRight: space.md,
  },
  activeTabItem: {
    borderBottomWidth: 2,
    borderBottomColor: t.warn,
  },
  tabText: {
    color: t.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: t.warn,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: space.md,
  },
  section: {
    marginBottom: space.lg,
  },
  criticalTitle: {
    color: t.danger,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: space.xs,
  },
  highTitle: {
    color: t.warn,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: space.xs,
  },
  mediumTitle: {
    color: t.ok,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: space.xs,
  },
  mandateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.xs,
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  logoText: {
    color: t.warn,
    fontSize: 10,
    fontWeight: '800',
  },
  mandateInfo: {
    flex: 1,
  },
  mandateName: {
    color: t.text,
    fontSize: 15,
    fontWeight: '700',
  },
  mandateMeta: {
    color: t.textDim,
    fontSize: 12,
    marginVertical: 2,
  },
  provenanceText: {
    color: t.textFaint,
    fontSize: 11,
  },
  mandateAmount: {
    color: t.text,
    fontSize: 16,
    fontWeight: '800',
  },
  confidenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.md,
  },
  shieldIcon: {
    fontSize: 20,
    marginRight: space.md,
  },
  confidenceMeta: {
    flex: 1,
  },
  confidenceCardTitle: {
    color: t.text,
    fontSize: 14,
    fontWeight: '700',
  },
  confidenceCardSub: {
    color: t.textDim,
    fontSize: 12,
  },
  arrowRight: {
    color: t.textDim,
    fontSize: 18,
  },
});
