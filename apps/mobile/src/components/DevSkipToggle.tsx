import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { t } from '../theme';

interface DevSkipToggleProps {
  onPress: () => void;
  label?: string;
}

export const DevSkipToggle: React.FC<DevSkipToggleProps> = ({
  onPress,
  label = '⚡ Dev Skip',
}) => {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: '#1E2638',
    borderColor: t.warn,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 999,
    elevation: 10,
  },
  text: {
    color: t.warn,
    fontSize: 12,
    fontWeight: '700',
  },
});
