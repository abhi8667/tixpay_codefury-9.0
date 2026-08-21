import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { t, space } from '../theme';

export type TabName = 'Home' | 'Pay' | 'Insights' | 'Card' | 'More';

interface BottomTabBarProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onTabChange,
}) => {
  const tabs: { name: TabName; icon: string }[] = [
    { name: 'Home', icon: '🏠' },
    { name: 'Pay', icon: '💳' },
    { name: 'Insights', icon: '📊' },
    { name: 'Card', icon: '💳' },
    { name: 'More', icon: '⣿' },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabItem}
            onPress={() => onTabChange(tab.name)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabIcon, isActive && styles.activeIcon]}>
              {tab.icon}
            </Text>
            <Text style={[styles.tabLabel, isActive && styles.activeLabel]}>
              {tab.name}
            </Text>
            {isActive && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
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
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
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
  activeIndicator: {
    position: 'absolute',
    bottom: 2,
    width: 24,
    height: 3,
    backgroundColor: t.warn,
    borderRadius: 1.5,
  },
});
