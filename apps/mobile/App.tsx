import React, { useState } from 'react';
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

export default function App() {
  const [isOnboarding, setIsOnboarding] = useState(false); // Default active for fast demo
  const [activeTab, setActiveTab] = useState<TabName>('Insights');
  
  // Interventions & Curve Resolution State
  const [showShortfallSheet, setShowShortfallSheet] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedActionTitle, setSelectedActionTitle] = useState('Pause Netflix');
  const [isResolved, setIsResolved] = useState(false);

  // Payment Flow State
  const [showPayScreen, setShowPayScreen] = useState(false);
  const [showPaySuccess, setShowPaySuccess] = useState(false);

  // Secondary Views State
  const [showMandateHub, setShowMandateHub] = useState(false);
  const [showKeeper, setShowKeeper] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);

  const handleSelectAction = (actionTitle: string) => {
    setSelectedActionTitle(actionTitle);
    setShowShortfallSheet(false);
    setShowConfirmModal(true);
  };

  const handleConfirmAction = () => {
    setShowConfirmModal(false);
    setIsResolved(true); // Curve morphs to emerald green!
  };

  const handleTabChange = (tab: TabName) => {
    setActiveTab(tab);
    if (tab === 'Pay') {
      setShowPayScreen(true);
    } else if (tab === 'Card') {
      setShowKeeper(true);
    } else if (tab === 'More') {
      setShowMandateHub(true);
    }
  };

  if (isOnboarding) {
    return <OnboardingFlow onFinishOnboarding={() => setIsOnboarding(false)} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={t.bg} />

      <Header
        onMenuPress={() => setShowSimulator(true)}
        onNotificationPress={() => setShowMandateHub(true)}
      />

      <View style={styles.content}>
        {showSimulator ? (
          <SimulatorDashboard onBack={() => setShowSimulator(false)} />
        ) : showMandateHub ? (
          <MandateHubScreen onBack={() => setShowMandateHub(false)} />
        ) : showKeeper ? (
          <KeeperScreen onBack={() => setShowKeeper(false)} />
        ) : (
          <InsightsScreen
            onTapDip={() => setShowShortfallSheet(true)}
            isResolved={isResolved}
            onOpenKeeper={() => setShowKeeper(true)}
            onOpenMandates={() => setShowMandateHub(true)}
          />
        )}
      </View>

      {/* Shortfall Bottom Sheet */}
      <ShortfallSheet
        visible={showShortfallSheet}
        onClose={() => setShowShortfallSheet(false)}
        onSelectAction={handleSelectAction}
      />

      {/* Confirm Action Modal */}
      <ConfirmActionModal
        visible={showConfirmModal}
        actionTitle={selectedActionTitle}
        onConfirm={handleConfirmAction}
        onCancel={() => setShowConfirmModal(false)}
      />

      {/* Payment Intercept Flow */}
      <PayScreen
        visible={showPayScreen}
        onClose={() => setShowPayScreen(false)}
        onPaySuccess={() => {
          setShowPayScreen(false);
          setShowPaySuccess(true);
        }}
      />

      {/* Payment Success Screen */}
      <PaymentSuccessScreen
        visible={showPaySuccess}
        amount={1}
        payeeName="Tarun Aadhithya V Sureendran Minor"
        onDismiss={() => setShowPaySuccess(false)}
      />

      <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
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
