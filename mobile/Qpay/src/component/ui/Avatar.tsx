import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { borderWidth, radii, typography } from '../../theme/theme';

type Props = {
  name: string;
  size?: number;
  inverted?: boolean;
};

/** Simple string hash — deterministic, no crypto needed, just enough entropy to pick a gradient. */
function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0; // >>> 0 keeps this a bounded uint32 for long names
  }
  return hash;
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

/** Blends two hex colors (opaque RGB mix, not alpha) so the result is correct over any backdrop. */
function mix(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

const ANGLES = [
  { x1: '0', y1: '0', x2: '1', y2: '1' },
  { x1: '1', y1: '0', x2: '0', y2: '1' },
  { x1: '0', y1: '1', x2: '1', y2: '0' },
  { x1: '0', y1: '0', x2: '1', y2: '0' },
];

/**
 * Square-cornered (never circular), filled ink with a paper initial — now
 * with a subtle two-stop gradient (angle + mix ratio derived from the name)
 * instead of a flat fill, so a list of avatars reads as distinct people
 * rather than identical tiles. Still strictly monochrome: both gradient
 * stops are mixes of `ink`/`paper`, never the accent — avatars are too much
 * surface area to spend the app's one accent color on.
 */
export function Avatar({ name, size = 44, inverted }: Props) {
  const theme = useTheme();
  const base = inverted ? theme.paper : theme.ink;
  const opposite = inverted ? theme.ink : theme.paper;
  const fg = inverted ? theme.ink : theme.paper;

  const hash = hashName(name || '?');
  const angle = ANGLES[hash % ANGLES.length];
  // eslint-disable-next-line no-bitwise
  const mixRatio = 0.14 + ((hash >> 4) % 17) / 100; // ~0.14–0.30, subtle either way
  const gradientId = `avatarGradient-${hash}`;

  return (
    <View
      style={[styles.base, { width: size, height: size, borderColor: theme.ink }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradientId} x1={angle.x1} y1={angle.y1} x2={angle.x2} y2={angle.y2}>
            <Stop offset="0" stopColor={base} />
            <Stop offset="1" stopColor={mix(base, opposite, mixRatio)} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      <Text style={[typography.bodyMedium, { color: fg, fontSize: size * 0.4 }]}>
        {(name || '?').slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.sm,
    borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
