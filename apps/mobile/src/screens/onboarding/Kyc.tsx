import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { t, typography, space, radius } from '../../theme';

interface KycProps {
  onNext: () => void;
}

export const Kyc: React.FC<KycProps> = ({ onNext }) => {
  const [name, setName] = useState('Anshul Kasat');
  const [pan, setPan] = useState('ABCDE1234F');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const handleVerify = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setIsVerified(true);
      setTimeout(() => {
        onNext();
      }, 800);
    }, 1500);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Identity Verification</Text>
        <Text style={styles.subtitle}>Enter your details as per PAN card</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor={t.textFaint}
        />

        <Text style={styles.label}>PAN Number</Text>
        <TextInput
          style={styles.input}
          value={pan}
          onChangeText={setPan}
          maxLength={10}
          autoCapitalize="characters"
          placeholder="ABCDE1234F"
          placeholderTextColor={t.textFaint}
        />

        {isVerifying && (
          <View style={styles.statusBox}>
            <ActivityIndicator color={t.warn} size="small" />
            <Text style={styles.verifyingText}>Verifying with NSDL…</Text>
          </View>
        )}

        {isVerified && (
          <View style={styles.statusBox}>
            <Text style={styles.verifiedText}>✓ Identity Verified</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.btn, isVerified && styles.btnSuccess]}
        onPress={handleVerify}
        disabled={isVerifying || isVerified}
        activeOpacity={0.8}
      >
        <Text style={styles.btnText}>
          {isVerified ? '✓ Verified' : isVerifying ? 'Verifying...' : 'Verify Details'}
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
  form: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    ...typography.caption,
    color: t.textDim,
    marginBottom: space.xs,
  },
  input: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: 52,
    color: t.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: space.md,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  verifyingText: {
    color: t.warn,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: space.sm,
  },
  verifiedText: {
    color: t.ok,
    fontSize: 16,
    fontWeight: '700',
  },
  btn: {
    backgroundColor: t.warn,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  btnSuccess: {
    backgroundColor: t.ok,
  },
  btnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
});
