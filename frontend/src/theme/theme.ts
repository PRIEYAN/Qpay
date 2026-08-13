/**
 * TS mirror of `tokens.css`, for the handful of places that genuinely need a
 * token as a JS value rather than a CSS variable — canvas/SVG fills, inline
 * `style` objects computed from data, and animation timings passed to the
 * Web Animations API.
 *
 * Anything that can be expressed in CSS should read `var(--token)` from
 * `tokens.css` instead of importing from here: duplicating a value in two
 * places is how a design system drifts. The values below are the same ones
 * the CSS file defines.
 */

export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 14,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const accent = '#6C63FF';
export const accentMuted = 'rgba(108, 99, 255, 0.16)';
export const accentStrong = '#5A4FE0';

export const durations = {
  instant: 80,
  fast: 140,
  base: 220,
  slow: 320,
  slower: 480,
} as const;

export const easing = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export type ThemeMode = 'light' | 'dark';

/**
 * A resolved colour set. Declared before `palettes` so both entries widen to
 * the same type — without it, `as const` narrows `isDark` to the literals
 * `true`/`false` and the two palettes become mutually unassignable.
 */
export type Palette = {
  isDark: boolean;
  ink: string;
  paper: string;
  surface: string;
  surfaceSunken: string;
  surfaceRaised: string;
  border: string;
  muted: string;
  overlay: string;
  success: string;
  danger: string;
};

/**
 * The two palettes as JS values. Only for non-CSS consumers (the avatar
 * gradient, the QR renderer). Screens read CSS variables.
 */
export const palettes: Record<ThemeMode, Palette> = {
  light: {
    isDark: false,
    ink: '#000000',
    paper: '#FFFFFF',
    surface: '#F4F4F4',
    surfaceSunken: '#ECECEC',
    surfaceRaised: '#FFFFFF',
    border: '#E0E0E0',
    muted: '#8A8A8A',
    overlay: 'rgba(0,0,0,0.6)',
    success: '#15803D',
    danger: '#DC2626',
  },
  dark: {
    isDark: true,
    ink: '#FFFFFF',
    paper: '#000000',
    surface: '#0E0E0E',
    surfaceSunken: '#000000',
    surfaceRaised: '#1C1C1C',
    border: '#262626',
    muted: '#8A8A8A',
    overlay: 'rgba(0,0,0,0.75)',
    success: '#34D399',
    danger: '#FF5C5C',
  },
};
