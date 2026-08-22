import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { t } from '../theme';
import { PressableScale } from './motion';

export type TabName = 'Insights' | 'Bank' | 'Home' | 'Pay' | 'Keeper';

const TAB_LABELS: Record<TabName, string> = {
  Insights: 'Insights',
  Bank: 'Bank',
  Home: 'Home',
  Pay: 'Pay',
  Keeper: 'Keeper',
};

const TABS: TabName[] = ['Insights', 'Bank', 'Home', 'Pay', 'Keeper'];

interface BottomTabBarProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
}

const TabIcon: React.FC<{ tab: TabName; color: string; isCenter?: boolean }> = ({ tab, color, isCenter }) => {
  const size = isCenter ? 26 : 22;
  const strokeWidth = 1.8;

  switch (tab) {
    case 'Insights':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M18 20V10" />
          <Path d="M12 20V4" />
          <Path d="M6 20v-6" />
        </Svg>
      );
    case 'Bank':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M3 21h18" />
          <Path d="M3 10h18" />
          <Path d="M5 6l7-3 7 3" />
          <Path d="M4 10v11" />
          <Path d="M20 10v11" />
          <Path d="M8 10v7" />
          <Path d="M12 10v7" />
          <Path d="M16 10v7" />
        </Svg>
      );
    case 'Home':
      // Stylized X brand logo icon
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M6 4L18 20" />
          <Path d="M18 4L6 20" />
          <Path d="M12 9l3-3" strokeWidth={1.5} />
          <Path d="M12 15l-3 3" strokeWidth={1.5} />
        </Svg>
      );
    case 'Pay':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Rect x="2" y="5" width="20" height="14" rx="2" />
          <Path d="M2 10h20" />
        </Svg>
      );
    case 'Keeper':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M6 3h12v2H6z" />
          <Path d="M5 5v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5" />
          <Path d="M9 11h6" />
          <Path d="M9 15h6" />
        </Svg>
      );
  }
};

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onTabChange }) => {
  const activeColor = t.warn; // Gold accent #E69C24
  const inactiveColor = 'rgba(255, 255, 255, 0.45)';

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab;
        const color = isActive ? activeColor : inactiveColor;
        const isCenter = tab === 'Home';

        return (
          <PressableScale
            key={tab}
            style={styles.tabItem}
            onPress={() => onTabChange(tab)}
            accessibilityLabel={TAB_LABELS[tab]}
          >
            <View style={[styles.iconWrapper, isCenter && styles.centerIconWrapper]}>
              <TabIcon tab={tab} color={color} isCenter={isCenter} />
            </View>
            <Text style={[styles.tabLabel, isActive && styles.activeLabel]}>
              {TAB_LABELS[tab]}
            </Text>
            {isActive ? <View style={styles.activeDot} /> : <View style={styles.dotPlaceholder} />}
          </PressableScale>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: Platform.OS === 'ios' ? 72 : 66,
    backgroundColor: '#0A0C10',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#1A202C',
    paddingBottom: Platform.OS === 'ios' ? 12 : 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  iconWrapper: {
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  centerIconWrapper: {
    transform: [{ scale: 1.1 }],
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.45)',
  },
  activeLabel: {
    color: t.warn,
    fontWeight: '700',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.warn,
    marginTop: 3,
  },
  dotPlaceholder: {
    width: 4,
    height: 4,
    marginTop: 3,
  },
});
