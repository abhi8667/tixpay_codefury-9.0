import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { t, typography, space, radius } from '../../theme';
import { useAppStore } from '../../../store/useAppStore';

interface MobileOtpProps {
  onNext: () => void;
}

export const MobileOtp: React.FC<MobileOtpProps> = ({ onNext }) => {
  // Nothing is pre-filled — the user onboards with their own number.
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const setProfile = useAppStore((s) => s.setProfile);

  const phoneComplete = phone.length === 10;

  const handleSendOtp = () => {
    if (!phoneComplete) return;
    setProfile({ phone });
    setStep('OTP');
  };

  const handleVerifyOtp = () => {
    // Any 6 digits pass per §2b of brief
    if (otp.length === 6) {
      onNext();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {step === 'PHONE' ? 'Enter Mobile Number' : 'Enter 6-Digit OTP'}
        </Text>
        <Text style={styles.subtitle}>
          {step === 'PHONE'
            ? 'We will send a 6-digit verification code'
            : `Code sent to +91 ${phone}`}
        </Text>
      </View>

      {step === 'PHONE' ? (
        <View style={styles.inputContainer}>
          <Text style={styles.prefix}>+91</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="10-digit mobile number"
            placeholderTextColor={t.textFaint}
            autoFocus
          />
        </View>
      ) : (
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, styles.otpInput]}
            value={otp}
            onChangeText={(v) => {
              setOtp(v);
              if (v.length === 6) handleVerifyOtp();
            }}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="123456"
            placeholderTextColor={t.textFaint}
            autoFocus
          />
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.btn,
          (step === 'PHONE' ? !phoneComplete : otp.length !== 6) && styles.btnDisabled,
        ]}
        onPress={step === 'PHONE' ? handleSendOtp : handleVerifyOtp}
        disabled={step === 'PHONE' ? !phoneComplete : otp.length !== 6}
        activeOpacity={0.8}
      >
        <Text style={styles.btnText}>
          {step === 'PHONE' ? 'Send OTP' : 'Verify & Continue'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg,
    padding: space.lg,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: space.xl,
  },
  title: {
    ...typography.title,
    fontSize: 24,
    marginBottom: space.xs,
  },
  subtitle: {
    ...typography.caption,
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: 56,
  },
  prefix: {
    color: t.text,
    fontSize: 18,
    fontWeight: '600',
    marginRight: space.sm,
  },
  input: {
    flex: 1,
    color: t.text,
    fontSize: 18,
    fontWeight: '600',
  },
  otpInput: {
    letterSpacing: 8,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: t.warn,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
});
