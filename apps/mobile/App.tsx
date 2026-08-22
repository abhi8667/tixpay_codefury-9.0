import React, { useState, useCallback } from 'react';
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
import { useBackHandler } from './src/lib/useBackHandler';
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

/** One entry of the back stack: the screen plus which tab was lit for it. */
interface NavEntry {
  mode: ScreenMode;
  tab: TabName;
}

interface PaidPayment {
  amount: number;
  payeeName: string;
  vpa: string;
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const [screenMode, setScreenMode] = useState<ScreenMode>('HOME');
  const [activeTab, setActiveTab] = useState<TabName>('Home');
  /**
   * Where back goes, innermost last.
   *
   * Every tool screen used to hand `goHome` to its own back affordance, so
   * leaving Spend Insights — which is only reachable from Insights — dropped
   * the user on the dashboard. A stack makes back mean "the screen I came
   * from", which is also what Android's own back gesture has to mean.
   */
  const [navStack, setNavStack] = useState<NavEntry[]>([]);
  const [payVisible, setPayVisible] = useState(false);
  /** Text typed into the home chat bar, replayed once the coach mounts. */
  const [chatSeed, setChatSeed] = useState<string | null>(null);

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
    setNavStack([]);
  }, []);

  /** Push the current screen and open `mode`. */
  const navigate = useCallback(
    (mode: ScreenMode, tab?: TabName) => {
      setNavStack((stack) => [...stack, { mode: screenMode, tab: activeTab }]);
      setScreenMode(mode);
      if (tab) setActiveTab(tab);
    },
    [screenMode, activeTab],
  );

  /** Pop one entry. Returns false only when there is nothing left to pop. */
  const goBack = useCallback((): boolean => {
    if (navStack.length > 0) {
      const previous = navStack[navStack.length - 1];
      setNavStack((stack) => stack.slice(0, -1));
      setScreenMode(previous.mode);
      setActiveTab(previous.tab);
      return true;
    }
    if (screenMode !== 'HOME') {
      goHome();
      return true;
    }
    return false;
  }, [navStack, screenMode, goHome]);

  /**
   * Android back, resolved outermost-last: dismiss whatever is layered on top
   * before touching the stack underneath it. Returning false on an empty stack
   * at Home is what lets the OS close the app, which is the one case where
   * doing nothing would be wrong.
   */
  useBackHandler(() => {
    if (paid !== null) {
      setPaid(null);
      goHome();
      return true;
    }
    if (pendingIntervention !== null) {
      setPendingIntervention(null);
      return true;
    }
    if (openShortfall !== null) {
      setOpenShortfall(null);
      return true;
    }
    if (payVisible) {
      setPayVisible(false);
      goHome();
      return true;
    }
    return goBack();
  }, booted && onboardingDone);

  const confirmIntervention = useCallback(() => {
    if (pendingIntervention) applyIntervention(pendingIntervention);
    setPendingIntervention(null);
    setOpenShortfall(null);
    goHome();
  }, [pendingIntervention, applyIntervention, goHome]);

  /** Tabs are roots, not stack pushes — switching one clears the back stack. */
  const goToTab = useCallback((tab: TabName) => {
    setActiveTab(tab);
    if (tab === 'Pay') {
      setPayVisible(true);
      return;
    }
    setNavStack([]);
    if (tab === 'Home') setScreenMode('HOME');
    else if (tab === 'Insights') setScreenMode('INSIGHTS');
    else if (tab === 'Bank') setScreenMode('BANK');
    else if (tab === 'Keeper') setScreenMode('KEEPER');
  }, []);

  const openChat = useCallback(
    (seed?: string) => {
      setChatSeed(seed && seed.trim() ? seed.trim() : null);
      navigate('CHAT');
    },
    [navigate],
  );

  // The splash covers the first pipeline run and the bundle warm-up, so it sits
  // above everything else rather than being a step inside onboarding — a user
  // who has already imported a statement should still see it on a cold start.
  if (!booted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar hidden />
        <AnimatedSplash onDone={() => setBooted(true)} />
      </SafeAreaView>
    );
  }

  if (!onboardingDone) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar hidden />
        <OnboardingFlow onFinishOnboarding={goHome} />
      </SafeAreaView>
    );
  }

  const renderScreen = () => {
    switch (screenMode) {
      case 'SIMULATOR':
        return <SimulatorDashboard onBack={goBack} />;
      case 'BANK':
        return (
          <BankScreen
            onBack={goBack}
            onOpenMandates={() => navigate('MANDATE_HUB', 'Bank')}
          />
        );
      case 'MANDATE_HUB':
        return (
          <MandateHubScreen
            onBack={goBack}
            onOpenSubscriptions={() => navigate('SUBSCRIPTIONS')}
          />
        );
      case 'KEEPER':
        return <GoalsScreen onBack={goBack} />;
      case 'SPEND_INSIGHTS':
        return <SpendInsightsScreen onBack={goBack} />;
      case 'SIP_CHECK':
        return <SipCheckScreen onBack={goBack} />;
      case 'SUBSCRIPTIONS':
        return <SubscriptionsScreen onBack={goBack} />;
      case 'MONEY_MAP':
        return <MoneyMapScreen onBack={goBack} onOpenGoals={() => navigate('KEEPER')} />;
      case 'RISK_PROFILE':
        return (
          <RiskProfileScreen onBack={goBack} onOpenSipCheck={() => navigate('SIP_CHECK')} />
        );
      case 'CHAT':
        return <ChatScreen onBack={goBack} initialQuery={chatSeed} />;
      case 'INSIGHTS':
        return (
          <InsightsScreen
            onTapDip={(shortfall) => setOpenShortfall(shortfall)}
            onOpenKeeper={() => navigate('KEEPER', 'Keeper')}
            onOpenMandates={() => navigate('MANDATE_HUB', 'Bank')}
            onOpenPay={() => {
              setPayVisible(true);
              setActiveTab('Pay');
            }}
            onOpenSpendInsights={() => navigate('SPEND_INSIGHTS')}
            onOpenSipCheck={() => navigate('SIP_CHECK')}
            onOpenChat={() => openChat()}
            onOpenSubscriptions={() => navigate('SUBSCRIPTIONS')}
            onOpenMoneyMap={() => navigate('MONEY_MAP')}
            onOpenRiskProfile={() => navigate('RISK_PROFILE')}
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
            onOpenInsights={() => navigate('INSIGHTS', 'Insights')}
            onOpenKeeper={() => navigate('KEEPER', 'Keeper')}
            onOpenMandates={() => navigate('MANDATE_HUB', 'Bank')}
            onOpenChat={openChat}
            onTapDip={(shortfall) => setOpenShortfall(shortfall)}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden />

      <Header
        onMenuPress={() => navigate('SIMULATOR')}
        onNotificationPress={() => navigate('MANDATE_HUB', 'Bank')}
        onChatPress={() => openChat()}
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
  },
  content: {
    flex: 1,
  },
});
