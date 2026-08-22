import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { t, space } from '../theme';
import { PressableScale } from './motion';

export type TabName = 'Insights' | 'Pay' | 'Keeper' | 'Mandates';

/** Display label per tab — the 'Keeper' identifier stays internal so the rest
 *  of the app's plumbing (ScreenMode, store) doesn't need to change with it. */
const TAB_LABELS: Record<TabName, string> = {
  Insights: 'Insights',
  Pay: 'Pay',
  Keeper: 'Goals',
  Mandates: 'Mandates',
};

interface BottomTabBarProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
}

// Four tabs, each landing on a screen that works. A fifth that opened a static
// mockup was worse than not having it.
const TABS: { name: TabName; icon: string }[] = [
  { name: 'Insights', icon: '📊' },
  { name: 'Pay', icon: '💳' },
  { name: 'Keeper', icon: '🎯' },
  { name: 'Mandates', icon: '🛡️' },
];

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onTabChange }) => {
  const index = Math.max(
    0,
    TABS.findIndex((tab) => tab.name === activeTab),
  );

  /**
   * One indicator that slides, rather than four that blink.
   *
   * A per-tab indicator appearing and disappearing reads as two unrelated
   * events. A single bar travelling between them says the two tabs are places
   * in the same row, which is the whole point of a tab bar.
   */
  const slide = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    const animation = Animated.timing(slide, {
      toValue: index,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      // Interpolating to a percentage string is a layout value.
      useNativeDriver: false,
    });
    animation.start();
    // Frames are not delivered while the app is backgrounded; land the bar
    // under the right tab regardless.
    const settle = setTimeout(() => slide.setValue(index), 300);
    return () => {
      animation.stop();
      clearTimeout(settle);
    };
  }, [index, slide]);

  const width = `${100 / TABS.length}%`;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.indicatorTrack,
          {
            width: width as `${number}%`,
            transform: [
              {
                translateX: slide.interpolate({
                  inputRange: TABS.map((_, i) => i),
                  outputRange: TABS.map((_, i) => `${i * 100}%`),
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.indicator} />
      </Animated.View>

      {TABS.map((tab) => {
        const isActive = activeTab === tab.name;
        return (
          <PressableScale
            key={tab.name}
            style={styles.tabItem}
            onPress={() => onTabChange(tab.name)}
            accessibilityLabel={TAB_LABELS[tab.name]}
          >
            <Text style={[styles.tabIcon, isActive && styles.activeIcon]}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, isActive && styles.activeLabel]}>
              {TAB_LABELS[tab.name]}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 64,
    backgroundColor: '#0A0C10',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#1A202C',
    paddingBottom: 4,
  },
  indicatorTrack: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    alignItems: 'center',
  },
  indicator: {
    width: 24,
    height: 3,
    backgroundColor: t.warn,
    borderRadius: 1.5,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: space.xs,
  },
  tabIcon: {
    fontSize: 18,
    opacity: 0.5,
    marginBottom: 2,
  },
  activeIcon: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: t.textDim,
  },
  activeLabel: {
    color: t.warn, // Gold accent for active tab label
    fontWeight: '700',
  },
});
