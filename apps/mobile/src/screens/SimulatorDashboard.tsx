import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { t, typography, space, radius } from '../theme';

interface SimulatorDashboardProps {
  onBack?: () => void;
}

export const SimulatorDashboard: React.FC<SimulatorDashboardProps> = ({ onBack }) => {
  const [currentDay, setCurrentDay] = useState(1);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stage Simulator Dashboard</Text>
      </View>

      {toastMsg && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* World Clock Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>⏱️ World Clock Slider</Text>
          <Text style={styles.sectionSub}>Shift "today" forward/backward deterministically</Text>
          <Text style={styles.clockValue}>Today: March {currentDay}, 2026</Text>

          <View style={styles.sliderButtons}>
            {[-5, -1, 1, 5].map((delta) => (
              <TouchableOpacity
                key={delta}
                style={styles.dayBtn}
                onPress={() => {
                  const next = Math.max(1, Math.min(30, currentDay + delta));
                  setCurrentDay(next);
                  triggerToast(`Shifted world clock to March ${next}`);
                }}
              >
                <Text style={styles.dayBtnText}>
                  {delta > 0 ? `+${delta} Day` : `${delta} Day`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Demo Scenario Presets */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🎬 Demo Scenario Presets</Text>
          <Text style={styles.sectionSub}>One-tap state presets for judges Q&A</Text>

          <TouchableOpacity
            style={[styles.presetBtn, { borderColor: t.ok }]}
            onPress={() => triggerToast('Loaded "Healthy Month" preset (No shortfalls)')}
          >
            <Text style={[styles.presetText, { color: t.ok }]}>🟢 Healthy Month</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetBtn, { borderColor: t.warn }]}
            onPress={() => triggerToast('Loaded "Tight Month" preset (Low margin)')}
          >
            <Text style={[styles.presetText, { color: t.warn }]}>🟡 Tight Month</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetBtn, { borderColor: t.danger }]}
            onPress={() => triggerToast('Loaded "Bounce Imminent" preset (Deficit -₹3,200)')}
          >
            <Text style={[styles.presetText, { color: t.danger }]}>🔴 Bounce Imminent (Hero Demo)</Text>
          </TouchableOpacity>
        </View>

        {/* Synthetic SMS Injector */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>📩 Synthetic SMS Injector</Text>
          <Text style={styles.sectionSub}>Inject real-time bank SMS alerts</Text>

          <View style={styles.smsGrid}>
            <TouchableOpacity
              style={styles.smsBtn}
              onPress={() => triggerToast('SMS Injected: ₹45,000 Salary Credited from HDFC')}
            >
              <Text style={styles.smsBtnText}>[Salary Credited]</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.smsBtn}
              onPress={() => triggerToast('SMS Injected: ₹5,000 SIP Debited by HDFC MF')}
            >
              <Text style={styles.smsBtnText}>[SIP Debited]</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.smsBtn}
              onPress={() => triggerToast('SMS Injected: Autopay FAILED for Netflix')}
            >
              <Text style={styles.smsBtnText}>[Autopay FAILED]</Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  backBtn: {
    marginRight: space.md,
  },
  backText: {
    color: t.text,
    fontSize: 22,
  },
  headerTitle: {
    color: t.text,
    fontSize: 18,
    fontWeight: '700',
  },
  toast: {
    backgroundColor: t.warn,
    padding: space.sm,
    alignItems: 'center',
  },
  toastText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: space.md,
  },
  sectionCard: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.lg,
  },
  sectionTitle: {
    color: t.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionSub: {
    color: t.textDim,
    fontSize: 12,
    marginBottom: space.md,
  },
  clockValue: {
    color: t.warn,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: space.md,
  },
  sliderButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayBtn: {
    backgroundColor: t.surfaceHi,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dayBtnText: {
    color: t.text,
    fontSize: 13,
    fontWeight: '700',
  },
  presetBtn: {
    backgroundColor: t.surfaceHi,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: space.md,
    marginBottom: space.sm,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 14,
    fontWeight: '800',
  },
  smsGrid: {
    gap: space.sm,
  },
  smsBtn: {
    backgroundColor: t.surfaceHi,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: space.md,
  },
  smsBtnText: {
    color: t.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
