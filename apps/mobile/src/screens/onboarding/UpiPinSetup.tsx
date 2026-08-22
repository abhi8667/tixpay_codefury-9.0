import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { t, typography, space, radius } from '../../theme';
import { useAppStore } from '../../../store/useAppStore';

interface UpiPinSetupProps {
  onNext: () => void;
}

export const UpiPinSetup: React.FC<UpiPinSetupProps> = ({ onNext }) => {
  const [pin, setPin] = useState('');
  /** The first entry, held while the user re-types it. Null on the first pass. */
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setUpiPin = useAppStore((s) => s.setUpiPin);

  const confirming = firstPin !== null;

  const handleComplete = (entered: string) => {
    if (!confirming) {
      setFirstPin(entered);
      setPin('');
      return;
    }
    if (entered === firstPin) {
      setUpiPin(entered);
      onNext();
      return;
    }
    // Mismatched confirmation restarts the whole thing. Keeping the first entry
    // and only clearing the second would let a typo in the first become the PIN.
    setFirstPin(null);
    setPin('');
    setError('PINs did not match. Start again.');
  };

  const handlePressNumber = (num: string) => {
    if (pin.length >= 4) return;
    const nextPin = pin + num;
    setPin(nextPin);
    if (error) setError(null);
    if (nextPin.length === 4) {
      setTimeout(() => handleComplete(nextPin), 220);
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    if (error) setError(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {confirming ? 'Confirm Your UPI PIN' : 'Set 4-Digit UPI PIN'}
        </Text>
        <Text style={styles.subtitle}>
          {confirming
            ? 'Re-enter the same 4 digits'
            : 'You will need this to pay and to reveal your balance'}
        </Text>
      </View>

      {/* Mandatory Safety Label per §2b of Brief */}
      <View style={styles.safetyBox}>
        <Text style={styles.safetyText}>⚠️ SIMULATED — this is not a real UPI PIN</Text>
      </View>

      <View style={styles.pinDotsRow}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.dot, i < pin.length && styles.dotFilled, !!error && styles.dotError]}
          />
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
    marginTop: space.xl,
    marginBottom: space.sm,
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
  dotError: {
    borderColor: t.danger,
  },
  errorText: {
    color: t.danger,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: space.md,
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
