import React, { useState } from 'react';
import { StyleSheet, View, Text, SafeAreaView, StatusBar, ScrollView, TouchableOpacity } from 'react-native';
import { Header } from './src/components/Header';
import { BottomTabBar, TabName } from './src/components/BottomTabBar';
import { InsightsScreen } from './src/screens/InsightsScreen';
import { ShortfallSheet } from './src/screens/ShortfallSheet';
import { ConfirmActionModal } from './src/screens/ConfirmActionModal';
import { MandateHubScreen } from './src/screens/MandateHubScreen';
import { PayScreen } from './src/screens/PayScreen';
import { PaymentSuccessScreen } from './src/screens/PaymentSuccessScreen';
import { KeeperScreen } from './src/screens/KeeperScreen';
import { SimulatorDashboard } from './src/screens/SimulatorDashboard';
import { OnboardingFlow } from './src/screens/onboarding/OnboardingFlow';
import { t, space } from './src/theme';
import { useAppStore } from './store/useAppStore';

export type ScreenMode =
  | 'INSIGHTS'
  | 'SHORTFALL_SHEET'
  | 'CONFIRM_MODAL'
  | 'MANDATE_HUB'
  | 'PAY'
  | 'PAY_SUCCESS'
  | 'KEEPER'
  | 'SIMULATOR'
  | 'ONBOARDING';

export default function App() {
  const [screenMode, setScreenMode] = useState<ScreenMode>('INSIGHTS');
  const [activeTab, setActiveTab] = useState<TabName>('Insights');
  const [isResolved, setIsResolved] = useState(false);
  const [selectedActionLabel, setSelectedActionLabel] = useState('Pause Netflix');

  const togglePauseMandate = useAppStore((state) => state.togglePauseMandate);
  const mandates = useAppStore((state) => state.mandates());

  const screens: { id: ScreenMode; label: string }[] = [
    { id: 'INSIGHTS', label: '📊 Insights' },
    { id: 'SHORTFALL_SHEET', label: '⚠️ Shortfall Sheet' },
    { id: 'CONFIRM_MODAL', label: '✓ Confirm Modal' },
    { id: 'MANDATE_HUB', label: '🛡️ Mandates' },
    { id: 'PAY', label: '💳 Pay Intercept' },
    { id: 'PAY_SUCCESS', label: '🎉 Pay Success' },
    { id: 'KEEPER', label: '🏺 Keeper Jar' },
    { id: 'SIMULATOR', label: '🎛️ Simulator' },
    { id: 'ONBOARDING', label: '🚀 Onboarding' },
  ];

  if (screenMode === 'ONBOARDING') {
    return <OnboardingFlow onFinishOnboarding={() => setScreenMode('INSIGHTS')} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={t.bg} />

      {/* Screen Direct Switcher Bar */}
      <View style={styles.switcherContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.switcherScroll}>
          <Text style={styles.switcherLabel}>Direct Screen View: </Text>
          {screens.map((sc) => {
            const isActive = screenMode === sc.id;
            return (
              <TouchableOpacity
                key={sc.id}
                style={[styles.switcherChip, isActive && styles.switcherChipActive]}
                onPress={() => {
                  setScreenMode(sc.id);
                  if (sc.id === 'INSIGHTS') setActiveTab('Insights');
                  else if (sc.id === 'PAY') setActiveTab('Pay');
                  else if (sc.id === 'KEEPER') setActiveTab('Card');
                  else if (sc.id === 'MANDATE_HUB') setActiveTab('More');
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {sc.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <Header
        onMenuPress={() => setScreenMode('SIMULATOR')}
        onNotificationPress={() => setScreenMode('MANDATE_HUB')}
      />

      <View style={styles.content}>
        {screenMode === 'SIMULATOR' ? (
          <SimulatorDashboard onBack={() => setScreenMode('INSIGHTS')} />
        ) : screenMode === 'MANDATE_HUB' ? (
          <MandateHubScreen onBack={() => setScreenMode('INSIGHTS')} />
        ) : screenMode === 'KEEPER' ? (
          <KeeperScreen onBack={() => setScreenMode('INSIGHTS')} />
        ) : (
          <InsightsScreen
            onTapDip={() => setScreenMode('SHORTFALL_SHEET')}
            isResolved={isResolved}
            onOpenKeeper={() => setScreenMode('KEEPER')}
            onOpenMandates={() => setScreenMode('MANDATE_HUB')}
          />
        )}
      </View>

      {/* Direct Shortfall Bottom Sheet */}
      <ShortfallSheet
        visible={screenMode === 'SHORTFALL_SHEET'}
        onClose={() => setScreenMode('INSIGHTS')}
        onSelectAction={(actionLabel) => {
          setSelectedActionLabel(actionLabel);
          setScreenMode('CONFIRM_MODAL');
        }}
      />

      {/* Direct Confirm Action Modal */}
      <ConfirmActionModal
        visible={screenMode === 'CONFIRM_MODAL'}
        actionTitle={selectedActionLabel}
        onConfirm={() => {
          // Find target mandate to pause (e.g. Netflix)
          const target = mandates.find((m) =>
            m.displayName.toLowerCase().includes('netflix') ||
            selectedActionLabel.toLowerCase().includes(m.displayName.toLowerCase())
          );
          if (target) {
            togglePauseMandate(target.id);
          }
          setIsResolved(true);
          setScreenMode('INSIGHTS');
        }}
        onCancel={() => setScreenMode('INSIGHTS')}
      />

      {/* Direct Payment Intercept Screen */}
      <PayScreen
        visible={screenMode === 'PAY'}
        onClose={() => setScreenMode('INSIGHTS')}
        onPaySuccess={() => setScreenMode('PAY_SUCCESS')}
      />

      {/* Direct Payment Success Screen */}
      <PaymentSuccessScreen
        visible={screenMode === 'PAY_SUCCESS'}
        amount={8000}
        payeeName="Tarun Aadhithya V Sureendran Minor"
        onDismiss={() => setScreenMode('INSIGHTS')}
      />

      <BottomTabBar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === 'Insights') setScreenMode('INSIGHTS');
          else if (tab === 'Pay') setScreenMode('PAY');
          else if (tab === 'Card') setScreenMode('KEEPER');
          else if (tab === 'More') setScreenMode('MANDATE_HUB');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg,
  },
  switcherContainer: {
    backgroundColor: '#141824',
    borderBottomWidth: 1,
    borderBottomColor: t.border,
    paddingVertical: 6,
  },
  switcherScroll: {
    alignItems: 'center',
    paddingHorizontal: space.sm,
  },
  switcherLabel: {
    color: t.warn,
    fontSize: 11,
    fontWeight: '800',
    marginRight: 6,
  },
  switcherChip: {
    backgroundColor: t.surfaceHi,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
  },
  switcherChipActive: {
    backgroundColor: t.warn,
    borderColor: t.warn,
  },
  chipText: {
    color: t.textDim,
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  content: {
    flex: 1,
  },
});
