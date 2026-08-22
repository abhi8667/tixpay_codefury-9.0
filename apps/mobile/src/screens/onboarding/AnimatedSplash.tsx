import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { t } from '../../theme';

/**
 * The cold-start splash.
 *
 * This runs once per process, before anything is on screen, and it is doing a
 * job beyond decoration: the engine's first pipeline run and the JS bundle's
 * warm-up both land in this window, so a blank dark rectangle for eight hundred
 * milliseconds is what the user would otherwise see.
 *
 * The choreography is a wordmark that assembles — 'Tix' from the left, 'Pay'
 * from the right, an underline drawing beneath — then the whole thing lifts and
 * fades. Total budget is under 1.6 seconds because a splash that outstays the
 * work it is covering is worse than none.
 *
 * `onDone` fires on the last animation's completion callback rather than on a
 * parallel timer, so a slow device shows the whole sequence instead of being
 * cut off mid-way.
 */
export const AnimatedSplash: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const left = useRef(new Animated.Value(0)).current;
  const right = useRef(new Animated.Value(0)).current;
  const rule = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;

  // `onDone` is almost always an inline arrow at the call site, so a new
  // identity arrives on every render. Depending on it directly restarted the
  // sequence each time and the splash never reached its exit — it just kept
  // replaying the entrance. The ref keeps the latest callback without making
  // the effect depend on its identity.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    // The rule's width is a layout property and cannot ride the native driver.
    // Kept out of the main sequence rather than mixed into it, so one animation
    // that has to run on the JS thread does not decide the driver for all of
    // them.
    const ruleAnimation = Animated.timing(rule, {
      toValue: 1,
      duration: 320,
      delay: 430,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.timing(left, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(right, {
          toValue: 1,
          duration: 420,
          delay: 90,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(tagline, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(340),
      Animated.timing(exit, {
        toValue: 1,
        duration: 260,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    ruleAnimation.start();
    sequence.start(({ finished }) => {
      if (finished) done.current();
    });

    // A splash that never hands over is a frozen app. If the driver is starved
    // — a backgrounded tab is the usual cause — hand over anyway.
    const failsafe = setTimeout(() => done.current(), 3200);

    return () => {
      clearTimeout(failsafe);
      ruleAnimation.stop();
      sequence.stop();
    };
  }, [left, right, rule, tagline, exit]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [
            { translateY: exit.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }) },
          ],
        },
      ]}
    >
      <View style={styles.wordmarkRow}>
        <Animated.Text
          style={[
            styles.logoWhite,
            {
              opacity: left,
              transform: [
                { translateX: left.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) },
              ],
            },
          ]}
        >
          Tix
        </Animated.Text>
        <Animated.Text
          style={[
            styles.logoGold,
            {
              opacity: right,
              transform: [
                { translateX: right.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
              ],
            },
          ]}
        >
          Pay
        </Animated.Text>
      </View>

      <Animated.View
        style={[
          styles.rule,
          {
            width: rule.interpolate({ inputRange: [0, 1], outputRange: ['0%', '46%'] }),
          },
        ]}
      />

      <Animated.Text
        style={[
          styles.tagline,
          {
            opacity: tagline,
            transform: [
              { translateY: tagline.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            ],
          },
        ]}
      >
        Your cash flow, one file, zero uploads
      </Animated.Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center' },
  logoWhite: { fontSize: 52, fontWeight: '800', color: '#FFFFFF', fontStyle: 'italic' },
  logoGold: { fontSize: 52, fontWeight: '800', color: t.warn, fontStyle: 'italic' },
  rule: {
    height: 2,
    backgroundColor: t.warn,
    borderRadius: 1,
    marginTop: 14,
  },
  tagline: {
    color: t.textDim,
    fontSize: 13,
    letterSpacing: 0.3,
    marginTop: 16,
  },
});
