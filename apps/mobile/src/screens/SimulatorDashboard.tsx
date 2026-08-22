import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';
import { t, space, radius } from '../theme';
import { useAppStore, ScenarioPreset } from '../../store/useAppStore';

interface SimulatorDashboardProps {
  onBack?: () => void;
}

export const SimulatorDashboard: React.FC<SimulatorDashboardProps> = ({ onBack }) => {
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const now = useAppStore((state) => state.now);
  const setNow = useAppStore((state) => state.setNow);
  const loadScenario = useAppStore((state) => state.loadScenario);
  const injectSms = useAppStore((state) => state.injectSms);
  const activeScenario = useAppStore((state) => state.activeScenario);
  const redactionOn = useAppStore((state) => state.redactionOn);
  const toggleRedaction = useAppStore((state) => state.toggleRedaction);
  const inboxMode = useAppStore((state) => state.inboxMode);
  const setInboxMode = useAppStore((state) => state.setInboxMode);
  const rawSms = useAppStore((state) => state.rawSms);

  const currentDay = now.getDate();

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleShiftDay = (delta: number) => {
    const nextDate = new Date(now);
    nextDate.setDate(nextDate.getDate() + delta);
    setNow(nextDate);
    triggerToast(`World Clock set to March ${nextDate.getDate()}, 2026`);
  };

  const handleLoadScenario = (preset: ScenarioPreset) => {
    loadScenario(preset);
    const names = {
      healthy: 'Healthy Month (Positive curve, no shortfall)',
      tight: 'Tight Month (Low cash-flow margin)',
      bounce: 'Bounce Imminent (Hero Demo: -₹3,200 deficit on Mar 12)',
    };
    triggerToast(`Loaded "${names[preset]}"`);
  };

  const handleInject = (kind: 'SALARY' | 'SIP' | 'FAILED') => {
    const timestamp = now.getTime();
    if (kind === 'SALARY') {
      injectSms({
        address: 'AD-HDFCBK',
        body: 'Rs.45,000.00 credited to a/c **4471 by SALARY CREDIT. Avl Bal Rs.57,450.00',
        date: timestamp,
      });
      triggerToast('SMS Injected: ₹45,000 Salary Credited from HDFC');
    } else if (kind === 'SIP') {
      injectSms({
        address: 'VM-HDFCBK-S',
        body: 'Rs.5,000.00 debited from a/c **4471 on 12-03-26 to VPA hdfcmutual@hdfcbank. Ref 841555106570. Avl Bal Rs.7,450.00',
        date: timestamp,
      });
      triggerToast('SMS Injected: ₹5,000 SIP Debited by HDFC MF');
    } else {
      injectSms({
        address: 'JD-ICICIB',
        body: 'Autopay debit of Rs.649.00 towards Netflix could not be processed due to insufficient balance in a/c **4471.',
        date: timestamp,
      });
      triggerToast('SMS Injected: Autopay FAILED for Netflix');
    }
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
                onPress={() => handleShiftDay(delta)}
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
            style={[
              styles.presetBtn,
              { borderColor: t.ok },
              activeScenario === 'healthy' && styles.presetBtnActive,
            ]}
            onPress={() => handleLoadScenario('healthy')}
          >
            <Text style={[styles.presetText, { color: t.ok }]}>🟢 Healthy Month</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.presetBtn,
              { borderColor: t.warn },
              activeScenario === 'tight' && styles.presetBtnActive,
            ]}
            onPress={() => handleLoadScenario('tight')}
          >
            <Text style={[styles.presetText, { color: t.warn }]}>🟡 Tight Month</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.presetBtn,
              { borderColor: t.danger },
              activeScenario === 'bounce' && styles.presetBtnActive,
            ]}
            onPress={() => handleLoadScenario('bounce')}
          >
            <Text style={[styles.presetText, { color: t.danger }]}>
              🔴 Bounce Imminent (Hero Demo: -₹3,200)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Synthetic SMS Injector */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>📩 Synthetic SMS Injector ({rawSms.length} loaded)</Text>
          <Text style={styles.sectionSub}>Inject real-time bank SMS alerts into live stream</Text>

          <View style={styles.smsGrid}>
            <TouchableOpacity
              style={styles.smsBtn}
              onPress={() => handleInject('SALARY')}
            >
              <Text style={styles.smsBtnText}>+ [Salary Credited ₹45,000]</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.smsBtn}
              onPress={() => handleInject('SIP')}
            >
              <Text style={styles.smsBtnText}>- [SIP Debited ₹5,000]</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.smsBtn}
              onPress={() => handleInject('FAILED')}
            >
              <Text style={styles.smsBtnText}>! [Autopay FAILED: Netflix]</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stage Settings & Privacy Toggles */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>⚙️ Stage Settings & Privacy</Text>
          <Text style={styles.sectionSub}>Audience presentation safeguards</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleMeta}>
              <Text style={styles.toggleTitle}>Projector Redaction Shield</Text>
              <Text style={styles.toggleSub}>Mask account numbers and sensitive names</Text>
            </View>
            <Switch
              value={redactionOn}
              onValueChange={toggleRedaction}
              trackColor={{ false: t.surfaceHi, true: t.ok }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.toggleRow, { marginTop: space.md }]}>
            <View style={styles.toggleMeta}>
              <Text style={styles.toggleTitle}>SMS Inbox Mode</Text>
              <Text style={styles.toggleSub}>
                Currently: {inboxMode === 'real' ? 'Real Device Inbox' : 'Seeded Synthetic'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modeToggleBtn}
              onPress={() => {
                const nextMode = inboxMode === 'real' ? 'seeded' : 'real';
                setInboxMode(nextMode);
                triggerToast(`Switched Inbox Mode to: ${nextMode.toUpperCase()}`);
              }}
            >
              <Text style={styles.modeToggleText}>{inboxMode.toUpperCase()}</Text>
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
    paddingBottom: 40,
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
  presetBtnActive: {
    backgroundColor: '#1C1910',
    borderWidth: 2,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleMeta: {
    flex: 1,
    marginRight: space.md,
  },
  toggleTitle: {
    color: t.text,
    fontSize: 14,
    fontWeight: '700',
  },
  toggleSub: {
    color: t.textDim,
    fontSize: 12,
  },
  modeToggleBtn: {
    backgroundColor: t.surfaceHi,
    borderColor: t.warn,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modeToggleText: {
    color: t.warn,
    fontSize: 12,
    fontWeight: '800',
  },
});
