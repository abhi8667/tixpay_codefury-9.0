import React, { useState, useCallback } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar } from 'react-native';
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
import { t } from './src/theme';
import type { Intervention, Shortfall } from '@tixpay/types';
import { useAppStore } from './store/useAppStore';

type ScreenMode = 'INSIGHTS' | 'MANDATE_HUB' | 'KEEPER' | 'SIMULATOR';

interface PaidPayment {
  amount: number;
  payeeName: string;
  vpa: string;
}

export default function App() {
  const [screenMode, setScreenMode] = useState<ScreenMode>('INSIGHTS');
  const [activeTab, setActiveTab] = useState<TabName>('Insights');
  const [payVisible, setPayVisible] = useState(false);

  /** The shortfall the user tapped. Drives which remedies the sheet offers. */
  const [openShortfall, setOpenShortfall] = useState<Shortfall | null>(null);
  const [pendingIntervention, setPendingIntervention] = useState<Intervention | null>(null);
  const [paid, setPaid] = useState<PaidPayment | null>(null);

  const hasData = useAppStore((state) => state.hasData());
  const applyIntervention = useAppStore((state) => state.applyIntervention);

  // Onboarding is the entry point, not a screen you can navigate to. Until a
  // statement is imported there is genuinely nothing to render — every number
  // in this app is derived from one, and an empty dashboard with placeholder
  // figures is exactly the kind of thing this build refuses to show.
  const onboardingDone = hasData;

  const closeSheet = useCallback(() => setOpenShortfall(null), []);

  const confirmIntervention = useCallback(() => {
    if (pendingIntervention) applyIntervention(pendingIntervention);
    setPendingIntervention(null);
    setOpenShortfall(null);
    setScreenMode('INSIGHTS');
    setActiveTab('Insights');
  }, [pendingIntervention, applyIntervention]);

  const goToTab = useCallback((tab: TabName) => {
    setActiveTab(tab);
    if (tab === 'Pay') {
      setPayVisible(true);
      return;
    }
    if (tab === 'Insights') setScreenMode('INSIGHTS');
    else if (tab === 'Keeper') setScreenMode('KEEPER');
    else if (tab === 'Mandates') setScreenMode('MANDATE_HUB');
  }, []);

  if (!onboardingDone) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={t.bg} />
        <OnboardingFlow
          onFinishOnboarding={() => {
            setScreenMode('INSIGHTS');
            setActiveTab('Insights');
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={t.bg} />

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
            onTapDip={(shortfall) => setOpenShortfall(shortfall)}
            onOpenKeeper={() => {
              setScreenMode('KEEPER');
              setActiveTab('Keeper');
            }}
            onOpenMandates={() => {
              setScreenMode('MANDATE_HUB');
              setActiveTab('Mandates');
            }}
            onOpenPay={() => {
              setPayVisible(true);
              setActiveTab('Pay');
            }}
          />
        )}
      </View>

      <ShortfallSheet
        visible={openShortfall !== null}
        shortfall={openShortfall}
        onClose={closeSheet}
        onSelectAction={(intervention) => setPendingIntervention(intervention)}
      />

      <ConfirmActionModal
        visible={pendingIntervention !== null}
        intervention={pendingIntervention}
        onConfirm={confirmIntervention}
        onCancel={() => setPendingIntervention(null)}
      />

      <PayScreen
        visible={payVisible}
        onClose={() => {
          setPayVisible(false);
          setActiveTab('Insights');
          setScreenMode('INSIGHTS');
        }}
        onPaySuccess={(payment) => {
          setPayVisible(false);
          setPaid(payment);
        }}
      />

      <PaymentSuccessScreen
        visible={paid !== null}
        amount={paid?.amount ?? 0}
        payeeName={paid?.payeeName ?? ''}
        vpa={paid?.vpa ?? ''}
        onDismiss={() => {
          setPaid(null);
          setActiveTab('Insights');
          setScreenMode('INSIGHTS');
        }}
      />

      <BottomTabBar activeTab={activeTab} onTabChange={goToTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg,
  },
  content: {
    flex: 1,
  },
});
