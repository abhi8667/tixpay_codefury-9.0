import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { t, typography, space, radius } from '../../theme';

interface SmsPermissionProps {
  onGrant: () => void;
}

export const SmsPermission: React.FC<SmsPermissionProps> = ({ onGrant }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>📩</Text>
        </View>
        <Text style={styles.title}>Enable SMS Permission</Text>
        <Text style={styles.subtitle}>
          TiXPay reads bank SMS on-device to discover auto-debits & reconstruct your forward balance curve. Zero cloud, zero bank logins.
        </Text>
      </View>

      <View style={styles.privacyCard}>
        <Text style={styles.privacyHeader}>🔒 Bank-Grade On-Device Guarantee</Text>
        <Text style={styles.privacyBullet}>• Reads debit/credit notifications only</Text>
        <Text style={styles.privacyBullet}>• Personal chats and OTPs are ignored & never read</Text>
        <Text style={styles.privacyBullet}>• Zero network requests — 100% offline analysis</Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={onGrant} activeOpacity={0.8}>
        <Text style={styles.btnText}>Grant SMS Access & Analyze</Text>
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
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: t.surfaceHi,
    borderColor: t.warn,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    ...typography.title,
    fontSize: 24,
    marginBottom: space.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.caption,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  privacyCard: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  privacyHeader: {
    color: t.ok,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: space.xs,
  },
  privacyBullet: {
    color: t.textDim,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
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
