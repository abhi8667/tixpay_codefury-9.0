import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { t, radius, space } from '../theme';

import Svg, { Path } from 'react-native-svg';

interface HeaderProps {
  showBack?: boolean;
  onBackPress?: () => void;
  title?: string;
  onMenuPress?: () => void;
  onNotificationPress?: () => void;
  onChatPress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  showBack = false,
  onBackPress,
  title,
  onMenuPress,
  onNotificationPress,
  onChatPress,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity onPress={onBackPress} style={styles.iconBtn}>
            <Text style={styles.iconText}>←</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onMenuPress} style={styles.iconBtn}>
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.center}>
        {title ? (
          <Text style={styles.titleText}>{title}</Text>
        ) : (
          <View style={styles.logoContainer}>
            <Text style={styles.logoWhite}>Tix</Text>
            <Text style={styles.logoGold}>Pay</Text>
          </View>
        )}
      </View>

      <View style={styles.right}>
        {onChatPress && (
          <TouchableOpacity onPress={onChatPress} style={styles.iconBtn}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={t.warn} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </Svg>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onNotificationPress} style={styles.iconBtn}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#E8ECF2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </Svg>
          <View style={styles.badgeDot} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    backgroundColor: t.bg,
  },
  left: {
    width: 40,
    alignItems: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  right: {
    minWidth: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconText: {
    color: t.text,
    fontSize: 22,
    fontWeight: '600',
  },
  menuLine: {
    width: 20,
    height: 2,
    backgroundColor: t.text,
    marginVertical: 2,
    borderRadius: 1,
  },
  titleText: {
    color: t.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWhite: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: -0.5,
  },
  logoGold: {
    color: t.warn, // #F5A524 Gold
    fontSize: 24,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: -0.5,
  },
  bellIcon: {
    fontSize: 18,
  },
  badgeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: t.warn,
  },
});
