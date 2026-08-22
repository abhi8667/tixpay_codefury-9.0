import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { typography } from '../theme';
import { useCountUp } from './motion';

interface RupeeProps {
  amount: number;
  style?: StyleProp<TextStyle>;
  showPrefix?: boolean;
  prefix?: string;
  /**
   * Count from the previous figure to this one instead of swapping.
   *
   * Off by default. It belongs on the two or three figures per screen whose
   * CHANGE is the point — the balance after a payment, the jar after a top-up.
   * On a list of amounts that never move it is motion for its own sake.
   */
  animate?: boolean;
}

export const Rupee: React.FC<RupeeProps> = ({
  amount,
  style,
  showPrefix = true,
  prefix = '+',
  animate = false,
}) => {
  const safe = Number.isFinite(amount) ? amount : 0;
  const animated = useCountUp(safe);
  const shown = animate ? animated : safe;

  const formatted = Math.round(Math.abs(shown)).toLocaleString('en-IN');
  const isNegative = shown < 0;
  const prefixStr = isNegative ? '-₹' : showPrefix && prefix && shown > 0 ? `${prefix}₹` : '₹';

  return (
    <Text style={[typography.body, style]}>
      {prefixStr}
      {formatted}
    </Text>
  );
};
