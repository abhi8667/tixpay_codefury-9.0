import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { t, space, radius } from '../theme';
import { PressableScale } from './motion';
import { useAppStore } from '../../store/useAppStore';

interface UpiPinModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  /**
   * Whether the fingerprint key can stand in for the PIN.
   *
   * Off for anything that exists *because* the PIN is the gate — revealing the
   * balance, for one. A one-tap bypass there would make the lock decorative.
   */
  allowBiometric?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export const UpiPinModal: React.FC<UpiPinModalProps> = ({
  visible,
  title = 'Enter 4-Digit UPI PIN',
  subtitle = 'Security verification required',
  allowBiometric = true,
  onSuccess,
  onCancel,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const verifyUpiPin = useAppStore((s) => s.verifyUpiPin);

  useEffect(() => {
    if (!visible) {
      setPin('');
      setError(null);
    }
  }, [visible]);

  const handlePressNumber = (num: string) => {
    if (pin.length >= 4) return;
    const nextPin = pin + num;
    setPin(nextPin);
    if (error) setError(null);
    if (nextPin.length < 4) return;

    // Let the fourth dot paint before the verdict lands, so a wrong PIN reads
    // as a rejection rather than as a keypress that silently did nothing.
    setTimeout(() => {
      if (verifyUpiPin(nextPin)) {
        setPin('');
        setError(null);
        onSuccess();
      } else {
        setPin('');
        setError('Incorrect UPI PIN. Try again.');
      }
    }, 180);
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    if (error) setError(null);
  };

  const handleBiometric = () => {
    if (!allowBiometric) return;
    setPin('');
    setError(null);
    onSuccess();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.lockIconCircle}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={t.warn} strokeWidth={2}>
                <Rect x="3" y="11" width="18" height="11" rx="2" />
                <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </Svg>
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {/* PIN Indicator Dots */}
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((idx) => {
              const filled = pin.length > idx;
              return (
                <View
                  key={idx}
                  style={[styles.dot, filled && styles.dotFilled, error && styles.dotError]}
                >
                  {filled ? <View style={styles.dotInner} /> : null}
                </View>
              );
            })}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Keypad Grid */}
          <View style={styles.keypadGrid}>
            {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
              <View key={rIdx} style={styles.keypadRow}>
                {row.map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={styles.keyBtn}
                    onPress={() => handlePressNumber(num)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.keyText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            <View style={styles.keypadRow}>
              <TouchableOpacity
                style={[styles.keyBtn, !allowBiometric && styles.keyBtnHidden]}
                onPress={handleBiometric}
                disabled={!allowBiometric}
                activeOpacity={0.7}
              >
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={t.warn} strokeWidth={2}>
                  <Path d="M12 2a10 10 0 0 0-10 10c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
                </Svg>
              </TouchableOpacity>

              <TouchableOpacity style={styles.keyBtn} onPress={() => handlePressNumber('0')} activeOpacity={0.7}>
                <Text style={styles.keyText}>0</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.keyBtn} onPress={handleBackspace} activeOpacity={0.7}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#E8ECF2" strokeWidth={2}>
                  <Path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                  <Path d="M18 9l-6 6" />
                  <Path d="M12 9l6 6" />
                </Svg>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.md,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#111622',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: space.lg,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: space.md,
  },
  lockIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(245, 165, 36, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: t.warn,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: t.textDim,
    fontSize: 12,
    marginTop: 2,
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: space.lg,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFilled: {
    borderColor: t.warn,
  },
  dotError: {
    borderColor: t.danger,
  },
  errorText: {
    color: t.danger,
    fontSize: 12,
    fontWeight: '700',
    marginTop: -space.md,
    marginBottom: space.md,
  },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: t.warn,
  },

  // Keypad
  keypadGrid: {
    width: '100%',
    gap: 12,
    marginBottom: space.md,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  keyBtn: {
    width: 68,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBtnHidden: {
    backgroundColor: 'transparent',
    opacity: 0,
  },
  keyText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 8,
  },
  cancelText: {
    color: t.textDim,
    fontSize: 13,
  },
});
