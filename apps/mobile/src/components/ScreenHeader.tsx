import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { t, typography, space } from '../theme';
import { PressableScale } from './motion';

/**
 * The back-row every sub-screen carries.
 *
 * Six screens had grown their own copy of this, and they had already drifted —
 * different heights, one with no border, one whose back arrow was a plain Text
 * with no hit area. Centring the title only works if the two sides reserve the
 * same width, which is what the trailing spacer is for.
 */
export const ScreenHeader: React.FC<{
  title: string;
  onBack?: () => void;
  /** Rendered on the right. Keep it to one control. */
  right?: React.ReactNode;
  subtitle?: string;
}> = ({ title, onBack, right, subtitle }) => (
  <View style={styles.row}>
    <View style={styles.side}>
      {onBack ? (
        <PressableScale style={styles.iconBtn} onPress={onBack} accessibilityLabel="Go back">
          <Text style={styles.back}>←</Text>
        </PressableScale>
      ) : null}
    </View>

    <View style={styles.center}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>

    <View style={[styles.side, styles.rightSide]}>{right}</View>
  </View>
);

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  side: { width: 56, justifyContent: 'center' },
  rightSide: { alignItems: 'flex-end' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { color: t.text, fontSize: 22, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center' },
  title: { ...typography.title, fontSize: 17 },
  subtitle: { color: t.textDim, fontSize: 11, marginTop: 1 },
});
