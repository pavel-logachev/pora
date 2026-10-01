import { useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

/**
 * One palette for the whole app, in a light and a dark variant that follow the system setting. The light theme
 * is warm paper with a deep green accent; the dark theme is a near-black green with a luminous mint accent.
 * Screens never hard-code colours: they take them from useTheme() so both variants stay in step.
 */
export interface Theme {
  scheme: 'light' | 'dark';
  /** App background. */
  bg: string;
  /** Cards and sheets. */
  surface: string;
  /** Inputs and quiet fills inside a card. */
  surfaceAlt: string;
  ink: string;
  muted: string;
  line: string;
  /** Main accent: buttons, active tab, the next-dose card. */
  primary: string;
  /** Text and icons placed on `primary`. */
  onPrimary: string;
  /** Tinted background for accent chips and icon tiles. */
  primarySoft: string;
  /** Accent text on a neutral surface. */
  primaryInk: string;
  /** The next-dose hero card. */
  hero: string;
  onHero: string;
  onHeroMuted: string;
  heroLine: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  /** Bottom navigation. */
  floating: string;
  /** Toasts: a contrasting bar with its own text and accent colours. */
  inverse: string;
  onInverse: string;
  inverseAccent: string;
  shadow: string;
  placeholder: string;
}

export const lightTheme: Theme = {
  scheme: 'light',
  bg: '#F5F2EA',
  surface: '#FFFFFF',
  surfaceAlt: '#F0EDE4',
  ink: '#15201C',
  muted: '#5C6A64',
  line: '#E2DDCF',
  primary: '#0F6B58',
  onPrimary: '#FFFFFF',
  primarySoft: '#DCEEE8',
  primaryInk: '#0B5444',
  hero: '#0E3B31',
  onHero: '#F4FBF8',
  onHeroMuted: 'rgba(244,251,248,0.72)',
  heroLine: 'rgba(244,251,248,0.16)',
  success: '#1B7B4D',
  successSoft: '#DDF1E4',
  warning: '#9A5B0B',
  warningSoft: '#FBEACB',
  danger: '#B93F32',
  dangerSoft: '#F8E0DB',
  floating: '#FFFFFF',
  inverse: '#15201C',
  onInverse: '#F5F2EA',
  inverseAccent: '#7EE3C6',
  shadow: 'rgba(21, 32, 28, 0.14)',
  placeholder: '#8B968F',
};

export const darkTheme: Theme = {
  scheme: 'dark',
  bg: '#0C1311',
  surface: '#151F1C',
  surfaceAlt: '#1C2824',
  ink: '#E8F0EC',
  muted: '#92A39C',
  line: '#26352F',
  primary: '#4FD1AE',
  onPrimary: '#05211A',
  primarySoft: '#173A32',
  primaryInk: '#7EE3C6',
  hero: '#12332B',
  onHero: '#F1FBF7',
  onHeroMuted: 'rgba(241,251,247,0.70)',
  heroLine: 'rgba(241,251,247,0.14)',
  success: '#6FD79B',
  successSoft: '#17362A',
  warning: '#F0B957',
  warningSoft: '#3A2D12',
  danger: '#FF8D7C',
  dangerSoft: '#3F1F1B',
  floating: '#1B2824',
  inverse: '#E8F0EC',
  onInverse: '#0C1311',
  inverseAccent: '#0B5444',
  shadow: 'rgba(0, 0, 0, 0.5)',
  placeholder: '#6E7F78',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

/** Builds a StyleSheet once per theme: `const styles = useStyles(createStyles)`. */
export function useStyles<T extends StyleSheet.NamedStyles<T>>(
  create: (theme: Theme) => T,
): T {
  const theme = useTheme();
  // The factory is a module-level function, so it is stable between renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => StyleSheet.create(create(theme)), [theme]);
}

export const radius = { sm: 12, md: 16, lg: 22, xl: 30 } as const;

/** Type scale. Nothing smaller than 12 is used for text a person has to read. */
export const type = {
  caption: { fontSize: 12, lineHeight: 16 },
  small: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '700' as const },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '800' as const },
  display: { fontSize: 32, lineHeight: 36, fontWeight: '800' as const },
};

export const minTouchTarget = 48;
