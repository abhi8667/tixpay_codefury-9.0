import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Splash } from './Splash';
import { MobileOtp } from './MobileOtp';
import { Kyc } from './Kyc';
import { BankDiscovery } from './BankDiscovery';
import { UpiPinSetup } from './UpiPinSetup';
import { AddCards } from './AddCards';
import { SmsPermission } from './SmsPermission';
import { AnalysisProgress } from './AnalysisProgress';
import { DevSkipToggle } from '../../components/DevSkipToggle';

interface OnboardingFlowProps {
  onFinishOnboarding: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onFinishOnboarding }) => {
  const [step, setStep] = useState<number>(1);

  const nextStep = () => setStep((prev) => Math.min(prev + 1, 8));

  return (
    <View style={styles.container}>
      <DevSkipToggle onPress={onFinishOnboarding} label="⚡ Skip Onboarding" />

      {step === 1 && <Splash onNext={nextStep} />}
      {step === 2 && <MobileOtp onNext={nextStep} />}
      {step === 3 && <Kyc onNext={nextStep} />}
      {step === 4 && <BankDiscovery onNext={nextStep} />}
      {step === 5 && <UpiPinSetup onNext={nextStep} />}
      {step === 6 && <AddCards onNext={nextStep} />}
      {step === 7 && <SmsPermission onGrant={nextStep} />}
      {step === 8 && <AnalysisProgress onComplete={onFinishOnboarding} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
