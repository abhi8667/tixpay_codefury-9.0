import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Splash } from './Splash';
import { MobileOtp } from './MobileOtp';
import { Kyc } from './Kyc';
import { BankDiscovery } from './BankDiscovery';
import { UpiPinSetup } from './UpiPinSetup';
import { AddCards } from './AddCards';
import { StatementImport } from './StatementImport';
import { AnalysisProgress } from './AnalysisProgress';
import { DevSkipToggle } from '../../components/DevSkipToggle';
import { useAppStore } from '../../../store/useAppStore';

interface OnboardingFlowProps {
  onFinishOnboarding: () => void;
}

const IMPORT_STEP = 7;
const ANALYSIS_STEP = 8;

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onFinishOnboarding }) => {
  const [step, setStep] = useState<number>(1);
  const loadSampleStatement = useAppStore((s) => s.loadSampleStatement);

  const nextStep = () => setStep((prev) => Math.min(prev + 1, ANALYSIS_STEP));

  /**
   * Skip must actually produce data, not just advance the step.
   *
   * The app only leaves onboarding once a statement has been imported — there
   * is genuinely nothing to render before that. So a skip that merely called
   * `onFinishOnboarding` bounced straight back to this screen. Loading the
   * sample is what "skip" has to mean now.
   */
  const skip = useCallback(() => {
    loadSampleStatement();
    setStep(ANALYSIS_STEP);
  }, [loadSampleStatement]);

  return (
    <View style={styles.container}>
      <DevSkipToggle onPress={skip} label="⚡ Skip to demo" />

      {step === 1 && <Splash onNext={nextStep} />}
      {step === 2 && <MobileOtp onNext={nextStep} />}
      {step === 3 && <Kyc onNext={nextStep} />}
      {step === 4 && <BankDiscovery onNext={nextStep} />}
      {step === 5 && <UpiPinSetup onNext={nextStep} />}
      {step === 6 && <AddCards onNext={nextStep} />}
      {step === IMPORT_STEP && <StatementImport onImported={nextStep} />}
      {step === ANALYSIS_STEP && <AnalysisProgress onComplete={onFinishOnboarding} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
