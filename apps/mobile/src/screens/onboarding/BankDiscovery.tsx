import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { t, typography, space, radius } from '../../theme';

interface BankDiscoveryProps {
  onNext: () => void;
}

export const BankDiscovery: React.FC<BankDiscoveryProps> = ({ onNext }) => {
  const [selectedId, setSelectedId] = useState('acc-1');

  const accounts = [
    { id: 'acc-1', bank: 'HDFC Bank', tail: '4471', type: 'Savings Account', primary: true },
    { id: 'acc-2', bank: 'Bank of Baroda', tail: '4735', type: 'Savings Account', primary: false },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Found 2 Accounts</Text>
        <Text style={styles.subtitle}>Linked to your registered mobile number</Text>
      </View>

      <View style={styles.list}>
        {accounts.map((acc) => {
          const isSelected = selectedId === acc.id;
          return (
            <TouchableOpacity
              key={acc.id}
              style={[styles.accountCard, isSelected && styles.selectedCard]}
              onPress={() => setSelectedId(acc.id)}
              activeOpacity={0.8}
            >
              <View style={styles.bankIconContainer}>
                <Text style={styles.bankIcon}>🏦</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.bankName}>{acc.bank}</Text>
                <Text style={styles.accDetails}>
                  {acc.type} •••• {acc.tail}
                </Text>
              </View>
              <View style={[styles.radio, isSelected && styles.radioActive]}>
                {isSelected && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.btn} onPress={onNext} activeOpacity={0.8}>
        <Text style={styles.btnText}>Link Selected Account</Text>
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
  list: {
    flex: 1,
    justifyContent: 'center',
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  selectedCard: {
    borderColor: t.warn,
    backgroundColor: t.surfaceHi,
  },
  bankIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: t.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  bankIcon: {
    fontSize: 20,
  },
  cardInfo: {
    flex: 1,
  },
  bankName: {
    color: t.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  accDetails: {
    color: t.textDim,
    fontSize: 13,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: t.warn,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: t.warn,
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
