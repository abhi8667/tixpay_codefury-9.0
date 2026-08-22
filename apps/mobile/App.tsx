import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, Platform } from 'react-native';
import { Header } from './src/components/Header';
import { BottomTabBar, TabName } from './src/components/BottomTabBar';
import { InsightsScreen } from './src/screens/InsightsScreen';
import { ShortfallSheet } from './src/screens/ShortfallSheet';
import { ConfirmActionModal } from './src/screens/ConfirmActionModal';
import { MandateHubScreen } from './src/screens/MandateHubScreen';
import { PayScreen } from './src/screens/PayScreen';
import { PaymentSuccessScreen } from './src/screens/PaymentSuccessScreen';
import { GoalsScreen } from './src/screens/GoalsScreen';
import { SimulatorDashboard } from './src/screens/SimulatorDashboard';
import { SpendInsightsScreen } from './src/screens/SpendInsightsScreen';
import { SipCheckScreen } from './src/screens/SipCheckScreen';
import { SubscriptionsScreen } from './src/screens/SubscriptionsScreen';
import { MoneyMapScreen } from './src/screens/MoneyMapScreen';
import { RiskProfileScreen } from './src/screens/RiskProfileScreen';
import { BankScreen } from './src/screens/BankScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { OnboardingFlow } from './src/screens/onboarding/OnboardingFlow';
import { AnimatedSplash } from './src/screens/onboarding/AnimatedSplash';
import { HomeScreen } from './src/screens/HomeScreen';
import { ScreenTransition } from './src/components/motion';
import { t } from './src/theme';
import type { Intervention, Shortfall } from '@tixpay/types';
import { useAppStore } from './store/useAppStore';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const fontStyle = document.createElement('style');
  fontStyle.textContent = `@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;800;900&display=swap'); body, input, button, select, textarea, div, span, p, a { font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important; }`;
  document.head.appendChild(fontStyle);
}

type ScreenMode =
  | 'HOME'
  | 'BANK'
  | 'INSIGHTS'
  | 'MANDATE_HUB'
  | 'KEEPER'
  | 'SIMULATOR'
  | 'SPEND_INSIGHTS'
  | 'SIP_CHECK'
  | 'SUBSCRIPTIONS'
  | 'MONEY_MAP'
  | 'RISK_PROFILE'
  | 'CHAT';

interface PaidPayment {
  amount: number;
  payeeName: string;
  vpa: string;
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const [screenMode, setScreenMode] = useState<ScreenMode>('HOME');
  const [activeTab, setActiveTab] = useState<TabName>('Home');
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

  const goHome = useCallback(() => {
    setScreenMode('HOME');
    setActiveTab('Home');
  }, []);

  const confirmIntervention = useCallback(() => {
    if (pendingIntervention) applyIntervention(pendingIntervention);
    setPendingIntervention(null);
    setOpenShortfall(null);
    goHome();
  }, [pendingIntervention, applyIntervention, goHome]);

  const goToTab = useCallback((tab: TabName) => {
    setActiveTab(tab);
    if (tab === 'Pay') {
      setPayVisible(true);
      return;
    }
    if (tab === 'Home') setScreenMode('HOME');
    else if (tab === 'Insights') setScreenMode('INSIGHTS');
    else if (tab === 'Bank') setScreenMode('BANK');
    else if (tab === 'Keeper') setScreenMode('KEEPER');
  }, []);

  // The splash covers the first pipeline run and the bundle warm-up, so it sits
  // above everything else rather than being a step inside onboarding — a user
  // who has already imported a statement should still see it on a cold start.
  if (!booted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={t.bg} />
        <AnimatedSplash onDone={() => setBooted(true)} />
      </SafeAreaView>
    );
  }

  if (!onboardingDone) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={t.bg} />
        <OnboardingFlow onFinishOnboarding={goHome} />
      </SafeAreaView>
    );
  }

  const renderScreen = () => {
    switch (screenMode) {
      case 'SIMULATOR':
        return <SimulatorDashboard onBack={goHome} />;
      case 'BANK':
        return (
          <BankScreen
            onBack={goHome}
            onOpenMandates={() => {
              setScreenMode('MANDATE_HUB');
              setActiveTab('Bank');
            }}
          />
        );
      case 'MANDATE_HUB':
        return (
          <MandateHubScreen
            onBack={goHome}
            onOpenSubscriptions={() => setScreenMode('SUBSCRIPTIONS')}
          />
        );
      case 'KEEPER':
        return <GoalsScreen onBack={goHome} />;
      case 'SPEND_INSIGHTS':
        return <SpendInsightsScreen onBack={goHome} />;
      case 'SIP_CHECK':
        return <SipCheckScreen onBack={goHome} />;
      case 'SUBSCRIPTIONS':
        return <SubscriptionsScreen onBack={goHome} />;
      case 'MONEY_MAP':
        return (
          <MoneyMapScreen onBack={goHome} onOpenGoals={() => setScreenMode('KEEPER')} />
        );
      case 'RISK_PROFILE':
        return (
          <RiskProfileScreen onBack={goHome} onOpenSipCheck={() => setScreenMode('SIP_CHECK')} />
        );
      case 'CHAT':
        return <ChatScreen onBack={goHome} />;
      case 'INSIGHTS':
        return (
          <InsightsScreen
            onTapDip={(shortfall) => setOpenShortfall(shortfall)}
            onOpenKeeper={() => {
              setScreenMode('KEEPER');
              setActiveTab('Keeper');
            }}
            onOpenMandates={() => {
              setScreenMode('MANDATE_HUB');
              setActiveTab('Bank');
            }}
            onOpenPay={() => {
              setPayVisible(true);
              setActiveTab('Pay');
            }}
            onOpenSpendInsights={() => setScreenMode('SPEND_INSIGHTS')}
            onOpenSipCheck={() => setScreenMode('SIP_CHECK')}
            onOpenChat={() => setScreenMode('CHAT')}
            onOpenSubscriptions={() => setScreenMode('SUBSCRIPTIONS')}
            onOpenMoneyMap={() => setScreenMode('MONEY_MAP')}
            onOpenRiskProfile={() => setScreenMode('RISK_PROFILE')}
          />
        );
      case 'HOME':
      default:
        return (
          <HomeScreen
            onOpenScan={() => {
              setPayVisible(true);
              setActiveTab('Pay');
            }}
            onOpenPayContact={() => {
              setPayVisible(true);
              setActiveTab('Pay');
            }}
            onOpenInsights={() => {
              setScreenMode('INSIGHTS');
              setActiveTab('Insights');
            }}
            onOpenKeeper={() => {
              setScreenMode('KEEPER');
              setActiveTab('Keeper');
            }}
            onOpenMandates={() => {
              setScreenMode('MANDATE_HUB');
              setActiveTab('Bank');
            }}
            onOpenChat={() => setScreenMode('CHAT')}
            onTapDip={(shortfall) => setOpenShortfall(shortfall)}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={t.bg} />

      <Header
        onMenuPress={() => setScreenMode('SIMULATOR')}
        onNotificationPress={() => setScreenMode('MANDATE_HUB')}
        onChatPress={() => setScreenMode('CHAT')}
      />

      <View style={styles.content}>
        {renderScreen()}
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
          goHome();
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
          goHome();
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 0,
  },
  content: {
    flex: 1,
  },
});
