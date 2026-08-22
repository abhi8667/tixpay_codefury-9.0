import { Platform } from 'react-native';

export const t = {
  bg: '#0A0C10',
  surface: '#141820',
  surfaceHi: '#1D2330',
  border: '#252C3A',

  text: '#E8ECF2',
  textDim: '#8792A6',
  textFaint: '#5A6478',

  danger: '#F0553D', // shortfall, penalty
  warn: '#F5A524', // gold/amber warning, active tab accent, primary buttons
  ok: '#2DD4A0', // emerald safe state, resolved curve
  accent: '#5B8DEF', // interactive blue
};

export const radius = { sm: 8, md: 14, lg: 22, sheet: 28 };
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 };

export const font = {
  family: Platform.select({
    android: 'Roboto',
    ios: 'Roboto',
    web: 'Roboto, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    default: 'Roboto',
  }),
};

export const typography = {
  display: { fontFamily: font.family, fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.8, color: t.text },
  title: { fontFamily: font.family, fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.3, color: t.text },
  body: { fontFamily: font.family, fontSize: 15, fontWeight: '400' as const, color: t.text },
  caption: { fontFamily: font.family, fontSize: 12, fontWeight: '500' as const, color: t.textDim },
};
