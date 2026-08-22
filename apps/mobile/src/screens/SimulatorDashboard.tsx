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
  const injectSimulated = useAppStore((state) => state.injectSimulated);
  const activeScenario = useAppStore((state) => state.activeScenario);
  const redactionOn = useAppStore((state) => state.redactionOn);
  const toggleRedaction = useAppStore((state) => state.toggleRedaction);
  const imported = useAppStore((state) => state.imported);
  const loadSampleStatement = useAppStore((state) => state.loadSampleStatement);
  const txnCount = useAppStore((state) => state.transactions().length);


  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleShiftDay = (delta: number) => {
    const nextDate = new Date(now);
    nextDate.setDate(nextDate.getDate() + delta);
    setNow(nextDate);
    triggerToast(
      `World Clock: ${nextDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    );
  };

  const handleLoadScenario = (preset: ScenarioPreset) => {
    loadScenario(preset);
    const names = {
      healthy: 'Healthy — clear of the buffer all month',
      tight: 'Tight — clear on open, one payment from trouble',
      bounce: 'Bounce imminent — already short ahead',
    };
    triggerToast(`${names[preset]} · clock set to ${preset === 'bounce' ? '1' : preset === 'healthy' ? '13' : '26'} March`);
  };

  /**
   * Append a simulated movement to the local ledger.
   *
   * Nothing is fabricated into the statement itself — the imported file stays
   * exactly as the bank wrote it. These land in a separate `simulatedTxns`
   * list, so 'Reset' restores the pristine import and the question "is this
   * rigged?" has a one-tap answer.
   */
  const handleInject = (kind: 'SALARY' | 'SIP') => {
    if (kind === 'SALARY') {
      injectSimulated('CREDIT', 45000, 'NEFT CR-SIMULATED SALARY');
      triggerToast('Simulated: ₹45,000 salary credited');
    } else {
      injectSimulated('DEBIT', 5000, 'ACH D-SIMULATED SIP');
      triggerToast('Simulated: ₹5,000 SIP debited');
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
          <Text style={styles.clockValue}>
            Today: {now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>

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
          <Text style={styles.sectionSub}>
            Each preset moves the clock only. The statement is never swapped, so
            every figure stays derived from the same file.
          </Text>

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
              🔴 Bounce Imminent
            </Text>
          </TouchableOpacity>
        </View>

        {/* Simulated transaction injector */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            🧪 Simulated Transactions ({txnCount} in ledger)
          </Text>
          <Text style={styles.sectionSub}>
            Applied locally on top of the imported statement. The file itself is never edited.
          </Text>

          <View style={styles.injectGrid}>
            <TouchableOpacity style={styles.injectBtn} onPress={() => handleInject('SALARY')}>
              <Text style={styles.injectBtnText}>+ [Salary Credited ₹45,000]</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.injectBtn} onPress={() => handleInject('SIP')}>
              <Text style={styles.injectBtnText}>- [SIP Debited ₹5,000]</Text>
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
              <Text style={styles.toggleTitle}>Data source</Text>
              <Text style={styles.toggleSub}>
                {imported
                  ? `${imported.sourceName} · ${imported.parsed} rows`
                  : 'No statement imported'}
              </Text>
            </View>
            <TouchableOpacity style={styles.modeToggleBtn} onPress={() => {
              loadSampleStatement();
              triggerToast('Reset to the pristine sample statement');
            }}>
              <Text style={styles.modeToggleText}>RESET</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.privacyNote}>
            No SMS, no contacts, no network. This build reads one file you hand it.
          </Text>
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
  injectGrid: {
    gap: space.sm,
  },
  injectBtn: {
    backgroundColor: t.surfaceHi,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: space.md,
  },
  injectBtnText: {
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
  privacyNote: {
    color: t.ok,
    fontSize: 11,
    lineHeight: 16,
    marginTop: space.md,
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
