import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { t, typography, space, radius } from '../../theme';

interface SplashProps {
  onNext: () => void;
}

export const Splash: React.FC<SplashProps> = ({ onNext }) => {
  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <View style={styles.logoRow}>
          <Text style={styles.logoWhite}>Tix</Text>
          <Text style={styles.logoGold}>Pay</Text>
        </View>
        <Text style={styles.tagline}>Zero-Integration Cash-Flow Guard for UPI</Text>
        <Text style={styles.description}>
          Predict shortfalls before payments bounce. Auto-discover mandates with zero bank login.
        </Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={onNext} activeOpacity={0.8}>
        <Text style={styles.btnText}>Get Started</Text>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  logoWhite: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  logoGold: {
    fontSize: 48,
    fontWeight: '800',
    color: t.warn,
    fontStyle: 'italic',
  },
  tagline: {
    ...typography.title,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: space.sm,
    color: t.text,
  },
  description: {
    ...typography.caption,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  btn: {
    backgroundColor: t.warn,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  btnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
});
