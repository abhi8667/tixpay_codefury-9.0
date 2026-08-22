import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { t } from '../theme';

/**
 * Motion primitives.
 *
 * Everything here uses the stock `Animated` API rather than Reanimated. That is
 * a deliberate constraint, not an oversight: the app ships to a browser preview
 * as well as to Android, `react-native-web` drives `Animated` natively, and
 * adding a native-module dependency for a fade would mean the web build — which
 * is how this gets demoed — stops working.
 *
 * `useNativeDriver` is on wherever the property allows it. Layout properties
 * (width, and anything the transition wrapper animates alongside a colour) fall
 * back to the JS driver, which is fine at these durations.
 */

/** Native driver is unavailable for layout props on web. */
const NATIVE = Platform.OS !== 'web';

// ─── Entrance ────────────────────────────────────────────────────────────────

interface FadeInProps {
  children: React.ReactNode;
  /** Milliseconds before this element starts. Stagger a list with the index. */
  delay?: number;
  duration?: number;
  /** Pixels to travel upward while fading in. 0 for a pure fade. */
  offset?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fade-and-rise, once, on mount.
 *
 * The staggered version of this is what makes a screen feel composed rather
 * than dumped: cards arrive in reading order a beat apart. Keep the delay
 * budget under ~300ms in total, or the last card looks broken rather than
 * choreographed.
 */
export const FadeIn: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  duration = 320,
  offset = 12,
  style,
}) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    // A fade-in that never gets a frame leaves its content at zero opacity —
    // an invisible screen, which is indistinguishable from a crash. Guarantee
    // the end state; the animation is the nice-to-have.
    const settle = setTimeout(() => progress.setValue(1), delay + duration + 80);
    return () => {
      animation.stop();
      clearTimeout(settle);
    };
  }, [progress, delay, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

const EXIT_MS = 120;
const ENTER_MS = 220;

/**
 * Cross-fade whatever is rendered whenever `routeKey` changes.
 *
 * The old screen leaves before the new one arrives rather than dissolving
 * through it, because two dark screens at 50% opacity read as one grey one.
 */
export const ScreenTransition: React.FC<{
  routeKey: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ routeKey, children, style }) => {
  const progress = useRef(new Animated.Value(1)).current;
  const [shown, setShown] = useState(routeKey);
  const [content, setContent] = useState(children);

  // Keep the live children in a ref so the exit animation's completion callback
  // swaps in what is current at that moment, not what was current when the
  // animation started.
  const latest = useRef(children);
  latest.current = children;

  useEffect(() => {
    if (routeKey === shown) {
      setContent(children);
      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: EXIT_MS,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();

    /**
     * The swap runs on a timer, not on the fade's completion callback.
     *
     * Hanging navigation off `start(callback)` means the app only changes screen
     * if frames are being delivered. They are not when the surface is hidden —
     * a backgrounded app, a tab the user has switched away from — and the
     * callback then never fires, so tapping a tab and switching away leaves the
     * user on the previous screen when they come back. Navigation has to be a
     * fact; the fade is only how it looks.
     */
    const swap = setTimeout(() => {
      setShown(routeKey);
      setContent(latest.current);
      Animated.timing(progress, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      // If frames never arrive the entrance cannot run, and the new screen
      // would sit at zero opacity. Set the value outright as a floor.
      settle = setTimeout(() => progress.setValue(1), ENTER_MS + 80);
    }, EXIT_MS);

    let settle: ReturnType<typeof setTimeout> | undefined;

    return () => {
      clearTimeout(swap);
      if (settle) clearTimeout(settle);
    };
  }, [routeKey, shown, children, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          flex: 1,
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        },
      ]}
    >
      {content}
    </Animated.View>
  );
};

// ─── Touch feedback ──────────────────────────────────────────────────────────

interface PressableScaleProps {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Fires a selection tick on press. Off for destructive or noisy controls. */
  haptic?: boolean;
  accessibilityLabel?: string;
}

/**
 * A tap target that dips under the finger.
 *
 * `TouchableOpacity` fades, which on a dark surface is nearly invisible; a 2%
 * scale reads immediately without drawing attention to itself.
 */
export const PressableScale: React.FC<PressableScaleProps> = ({
  onPress,
  children,
  style,
  disabled,
  haptic = true,
  accessibilityLabel,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const to = (value: number) =>
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();

  return (
    <Pressable
      accessibilityRole="button"
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      disabled={disabled}
      onPressIn={() => to(0.975)}
      onPressOut={() => to(1)}
      onPress={() => {
        if (disabled) return;
        // Haptics is a no-op on web; guard anyway so a rejected promise never
        // reaches the console during the browser demo.
        if (haptic && Platform.OS !== 'web') {
          Haptics.selectionAsync().catch(() => undefined);
        }
        onPress?.();
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.45 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// ─── Numbers ─────────────────────────────────────────────────────────────────

/**
 * Count a figure up to its new value instead of swapping it.
 *
 * Only worth doing where the change is the story — the balance after a payment,
 * the jar after a top-up. On a static list it is noise, so it takes an explicit
 * `animate` prop rather than being the default everywhere.
 */
export function useCountUp(value: number, duration = 550): number {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const target = useRef(value);

  useEffect(() => {
    if (target.current === value) return;
    from.current = display;
    target.current = value;

    const start = Date.now();
    const startValue = from.current;
    const delta = value - startValue;
    let frame = 0;

    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / duration);
      // Cubic ease-out, written out rather than reused from Easing so this
      // hook stays independent of the Animated driver entirely.
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(startValue + delta * eased);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    /**
     * Land on the real figure even if no frames are delivered.
     *
     * `requestAnimationFrame` is suspended whenever the surface is not being
     * composited — a backgrounded tab, an app the user has switched away from.
     * A fade that stalls resumes harmlessly; a BALANCE that stalls keeps a
     * stale rupee figure on screen, which is the one thing on this screen that
     * must never be wrong. So the tween has a deadline.
     */
    const settle = setTimeout(() => setDisplay(value), duration + 80);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
    // `display` is deliberately excluded: it changes on every frame, and
    // depending on it would restart the tween against itself. The ref captures
    // the value it needs at the moment the target actually moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return display;
}

// ─── Progress ────────────────────────────────────────────────────────────────

interface ProgressBarProps {
  /** 0–1. Clamped. */
  progress: number;
  color?: string;
  trackColor?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color = t.warn,
  trackColor = t.surfaceHi,
  height = 8,
  style,
}) => {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const width = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    const animation = Animated.timing(width, {
      toValue: clamped,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      // Width is a layout property; the native driver cannot carry it.
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [clamped, width]);

  return (
    <View
      style={[
        { height, borderRadius: height / 2, backgroundColor: trackColor, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View
        style={{
          height,
          borderRadius: height / 2,
          backgroundColor: color,
          width: width.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
          }),
        }}
      />
    </View>
  );
};

// ─── Attention ───────────────────────────────────────────────────────────────

/**
 * A slow breathing halo, for the one element on a screen that is a warning.
 *
 * Used on the shortfall marker and nowhere else. A pulsing anything is a
 * budget of exactly one per screen.
 */
export const Pulse: React.FC<{ children: React.ReactNode; active?: boolean }> = ({
  children,
  active = true,
}) => {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
        Animated.timing(value, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, value]);

  if (!active) return <>{children}</>;

  return (
    <Animated.View
      style={{
        opacity: value.interpolate({ inputRange: [0, 1], outputRange: [1, 0.62] }),
        transform: [
          { scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
};

// ─── Placeholder text ────────────────────────────────────────────────────────

/**
 * What a screen says when the statement genuinely had nothing to show.
 *
 * Every screen in this app needs one, because the honest answer to "no
 * auto-debits found" is a sentence, not an empty list that reads as a bug. The
 * `hint` slot is for what the user can do about it.
 */
export const EmptyState: React.FC<{
  icon: string;
  title: string;
  body: string;
  hint?: string;
  action?: { label: string; onPress: () => void };
}> = ({ icon, title, body, hint, action }) => (
  <FadeIn style={emptyStyles.wrap}>
    <View style={emptyStyles.iconCircle}>
      <Text style={emptyStyles.icon}>{icon}</Text>
    </View>
    <Text style={emptyStyles.title}>{title}</Text>
    <Text style={emptyStyles.body}>{body}</Text>
    {hint ? <Text style={emptyStyles.hint}>{hint}</Text> : null}
    {action ? (
      <PressableScale style={emptyStyles.action} onPress={action.onPress}>
        <Text style={emptyStyles.actionText}>{action.label}</Text>
      </PressableScale>
    ) : null}
  </FadeIn>
);

const emptyStyles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 36 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  icon: { fontSize: 28 },
  title: { color: t.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  body: {
    color: t.textDim,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 300,
  },
  hint: {
    color: t.textFaint,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 300,
  },
  action: {
    marginTop: 18,
    backgroundColor: t.warn,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  actionText: { color: '#000000', fontSize: 14, fontWeight: '800' },
});

/** A tiny bar chart. Enough to read a trend, not enough to read a value. */
export const Sparkline: React.FC<{
  values: number[];
  color?: string;
  height?: number;
}> = ({ values, color = t.accent, height = 40 }) => {
  const max = useMemo(() => Math.max(1, ...values), [values]);
  return (
    <View style={[sparkStyles.row, { height }]}>
      {values.map((v, i) => (
        <View
          key={i}
          style={[
            sparkStyles.bar,
            {
              height: Math.max(2, (v / max) * height),
              backgroundColor: v > 0 ? color : t.border,
            },
          ]}
        />
      ))}
    </View>
  );
};

const sparkStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { flex: 1, borderRadius: 1.5, minWidth: 2 },
});

/** Money, formatted the Indian way, with the sign carried by colour not text. */
export const money = (n: number): string =>
  `₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`;

export const moneyStyle: TextStyle = { fontVariant: ['tabular-nums'] };
