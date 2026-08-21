import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { t, typography, space, radius } from '../../theme';

interface UpiPinSetupProps {
  onNext: () => void;
}

export const UpiPinSetup: React.FC<UpiPinSetupProps> = ({ onNext }) => {
  const [pin, setPin] = useState('');

  const handlePressNumber = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        setTimeout(() => {
          onNext();
        }, 300);
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Set 4-Digit UPI PIN</Text>
        <Text style={styles.subtitle}>Enter 4 digits for fast demo transactions</Text>
      </View>

      {/* Mandatory Safety Label per §2b of Brief */}
      <View style={styles.safetyBox}>
        <Text style={styles.safetyText}>⚠️ SIMULATED — this is not a real UPI PIN</Text>
      </View>

      <View style={styles.pinDotsRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
        ))}
      </View>

      {/* Custom Keypad */}
      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((item, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.key}
            onPress={() => {
              if (item === '⌫') handleDelete();
              else if (item !== '') handlePressNumber(item);
            }}
            disabled={item === ''}
            activeOpacity={0.6}
          >
            <Text style={styles.keyText}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
  },
  safetyBox: {
    backgroundColor: '#3D1C16',
    borderColor: t.danger,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    alignSelf: 'center',
    marginTop: space.sm,
  },
  safetyText: {
    color: t.danger,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  pinDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: space.xl,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: t.border,
    marginHorizontal: space.sm,
  },
  dotFilled: {
    backgroundColor: t.warn,
    borderColor: t.warn,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  key: {
    width: '30%',
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    margin: '1.5%',
  },
  keyText: {
    color: t.text,
    fontSize: 24,
    fontWeight: '600',
  },
});
