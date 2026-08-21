import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { typography, t } from '../theme';

interface RupeeProps {
  amount: number;
  style?: StyleProp<TextStyle>;
  showPrefix?: boolean;
  prefix?: string;
}

export const Rupee: React.FC<RupeeProps> = ({
  amount,
  style,
  showPrefix = true,
  prefix = '+',
}) => {
  const formatted = Math.abs(amount).toLocaleString('en-IN');
  const isNegative = amount < 0;
  const prefixStr = isNegative ? '-₹' : showPrefix && prefix && amount > 0 ? `${prefix}₹` : '₹';

  return (
    <Text
      style={[
        typography.body,
        { fontVariant: ['tabular-nums'] },
        style,
      ]}
    >
      {prefixStr}
      {formatted}
    </Text>
  );
};
