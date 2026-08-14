/**
 * Qpay design tokens — mobileAppWorkflow.md §3, extended for the "alive"
 * pass (see src/theme/README.md for the full rationale).
 *
 * What is still fixed:
 *   1. Pure black `#000000` and pure white `#FFFFFF` are the two poles —
 *      dark-first, `paper` is `#000000` in dark mode. This does not change.
 *   2. Everything between the poles stays neutral grayscale EXCEPT the one
 *      accent below, and `success`/`danger`, which exist only for money
 *      direction and errors.
 *   3. Every screen still reads colors through `useTheme()` (the QR
 *      component is the sole, deliberate exception — it must stay
 *      literally black-on-white to scan).
 *
 * What changed from the original brutalist system: radius, elevation and a
 * single accent hue are now allowed, in careful, tokenized doses — see
 * `radii`, `elevation`, `accent` below. Nothing here is a "just this once"
 * magic number; every new value is a named export so screens can't invent
 * their own.
 */
import { Easing } from 'react-native';

/**
 * Legacy flat radius, kept exactly as-is (0) for any call site that already
 * imports it directly — several in-flight screens do. New UI-layer code
 * should prefer the `radii` scale below instead of this or a literal.
 */
export const radius = 0;

/**
 * New restrained radius scale. Four steps plus a pill — never introduce a
 * fifth. `none` exists so call sites can be explicit about opting out
 * rather than reaching for a literal `0`.
 */
export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 14,
  pill: 999,
} as const;

/** 1px, not hairline — a crisp rule reads better against a flat monochrome field. */
export const borderWidth = 1;
export const borderWidthStrong = 2;

/**
 * Shadow ramp for LIGHT-theme elevation only — on a pure-black dark theme a
 * shadow is invisible, so dark surfaces climb the `surface*` grey ramp
 * instead (see `lightTheme`/`darkTheme` below). Spread one of these into a
 * style array; `elevation` also sets the Android `elevation` property.
 */
export const elevation = {
  none: { shadowOpacity: 0, elevation: 0 },
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;

/**
 * The ONE accent. Electric indigo — chosen because it sits far enough from
 * both true blue and true violet to read as deliberate rather than
 * "default system blue", and its luminance keeps it legible on both poles:
 * ~4.9:1 against pure black, ~4.3:1 against pure white (WCAG AA for large
 * text/graphics on both, AA body-text on black). Use it sparingly — focus
 * rings, the active/selected state, progress, and interactive affordances
 * that want to say "tap me". It never carries money direction (that's
 * success/danger) and it never becomes a second neutral.
 */
export const accent = '#6C63FF';
/** Translucent wash of `accent` — selected-chip fills, progress track backgrounds, focus halos. */
export const accentMuted = 'rgba(108, 99, 255, 0.16)';
/** Slightly deeper than `accent` — for a pressed/active accent surface. */
export const accentStrong = '#5A4FE0';

export const lightTheme = {
  isDark: false,
  ink: '#000000',
  paper: '#FFFFFF',
  /** Base recessed fill for cards/blocks. */
  surface: '#F4F4F4',
  /** Deeper than `surface` — wells, inputs, anything pressed "into" the page. */
  surfaceSunken: '#ECECEC',
  /** Pure white, meant to sit ON TOP of `surface` with `elevation` — sheets, popovers, raised cards. */
  surfaceRaised: '#FFFFFF',
  /** Hairline dividers and idle input outlines. */
  border: '#E0E0E0',
  /** Secondary/disabled text. The only non-binary neutral tone. */
  muted: '#8A8A8A',
  overlay: 'rgba(0,0,0,0.6)',
  /** Money-in / positive / confirmed. Darkened from the dark-theme value to hold 4.5:1+ on white. */
  success: '#15803D',
  /** Money-out / negative / error. */
  danger: '#DC2626',
};

export const darkTheme = {
  isDark: true,
  ink: '#FFFFFF',
  paper: '#000000',
  /** Base fill, one step off pure black — cards, rows. */
  surface: '#0E0E0E',
  /** Recessed toward pure black — input wells sit flush with the page. */
  surfaceSunken: '#000000',
  /** Lighter grey — the dark-mode stand-in for a shadow. Raised = lighter, never darker. */
  surfaceRaised: '#1C1C1C',
  border: '#262626',
  muted: '#8A8A8A',
  overlay: 'rgba(0,0,0,0.75)',
  /** Brighter than the light-theme value — needs to read against near-black surfaces. */
  success: '#34D399',
  danger: '#FF5C5C',
};

export type Theme = typeof lightTheme;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

/**
 * Weight does the differentiating work, not size alone (§3.3). Amounts are the
 * largest thing on screen and carry negative tracking so big numbers stay tight;
 * caption is the all-caps tracked label used for section headers.
 */
export const typography = {
  display: { fontSize: 52, fontWeight: '700' as const, letterSpacing: -1.6 },
  amount: { fontSize: 42, fontWeight: '700' as const, letterSpacing: -1.2 },
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.4 },
  subtitle: { fontSize: 18, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, fontWeight: '600' as const },
  label: { fontSize: 13, fontWeight: '500' as const },
  /** Section labels: small, bold, widely tracked, always uppercased. */
  caption: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.6 },
  micro: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 1.2 },
};

/**
 * One motion system for the whole app — every animated component in
 * `src/component/**` should pull its duration/easing/spring from here
 * rather than hand-rolling a number, so the app reads as one coherent
 * material rather than a pile of individually-tuned widgets.
 *
 * `pressedOpacity` and `duration` are the original flat fields and are kept
 * exactly as they were (still consumed directly by Toast); everything else
 * is additive.
 */
export const motion = {
  /** Legacy — opacity fallback for press states that don't use PressableScale. */
  pressedOpacity: 0.85,
  /** Legacy flat duration (ms), equal to `durations.base`. Toast.tsx reads this directly. */
  duration: 140,

  durations: {
    /** Micro-feedback: key taps, ripples. */
    instant: 80,
    /** Press states, toggles. */
    fast: 140,
    /** Default — mount transitions, toasts, sheets. */
    base: 220,
    /** Sheet slide, larger layout changes. */
    slow: 320,
    /** Big, deliberate moments (empty states, success screens). */
    slower: 480,
  },

  /** Timing curves. `standard` is the app-wide default for timing-based animation. */
  easing: {
    standard: Easing.bezier(0.2, 0, 0, 1),
    accelerate: Easing.bezier(0.3, 0, 1, 1),
    decelerate: Easing.bezier(0, 0, 0.2, 1),
  },

  /** Spring presets for `Animated.spring` — used by PressableScale/Sheet. */
  spring: {
    /** Snappy tactile press-down. */
    press: { friction: 9, tension: 320, useNativeDriver: true as const },
    /** Sheets, slide-ins — a touch softer, still fast. */
    gentle: { friction: 10, tension: 160, useNativeDriver: true as const },
  },

  /** Default scale-down for PressableScale-driven components. */
  scalePressed: 0.96,
} as const;
