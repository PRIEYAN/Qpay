# Qpay theme & motion system

Pure black (`#000000`) is still the primary color and dark-first identity of
this app. What changed from the original brutalist system is documented
here so screens stay consistent as they're built out.

## Token reference (`src/theme/theme.ts`)

### Poles & neutrals (unchanged)
- `lightTheme.ink` / `darkTheme.ink` — foreground. Black on light, white on dark.
- `lightTheme.paper` / `darkTheme.paper` — background. White on light, **pure
  black** on dark.
- `muted`, `border`, `overlay` — same as before.

### Surface ramp (new)
Three levels per theme, read through `useTheme()`:
- `surfaceSunken` — recessed (input wells, anything pressed "into" the
  page). Flush with `paper` on dark (`#000000` — you can't go darker than
  pure black), one step darker than `surface` on light.
- `surface` — base fill for cards/rows. Same value as the old single
  `surface` token.
- `surfaceRaised` — sits *above* `surface`. On dark this is a lighter grey
  (`#1C1C1C`) — a shadow is invisible on black, so "raised" means lighter,
  never darker. On light this is pure white, meant to be paired with
  `elevation` (see below).

`theme.isDark` is now on the theme object itself, so components can branch
between "use a real shadow" (light) and "use surfaceRaised" (dark) without
importing `useColorScheme` directly.

### Radius (new, restrained)
`radii = { none: 0, sm: 4, md: 8, lg: 14, pill: 999 }`. Four steps and a
pill, never a fifth. Rough guide:
- `sm` — list rows, avatars, small chips.
- `md` — buttons, inputs, cards, action tiles.
- `lg` — sheets (top corners only).
- `pill` — StatusTag.

The legacy flat `radius` export (`0`) still exists and still means what it
meant — some in-flight screens read it directly. New UI-layer work should
prefer `radii`.

### Elevation (new, light-theme only)
`elevation.sm/md/lg` are real shadow styles (`shadowColor/Offset/Opacity/
Radius` + Android `elevation`). Only apply them when `!theme.isDark` — on
black a shadow renders as nothing, so the dark-mode equivalent of "raised"
is `surfaceRaised`, not a shadow. See `Card`'s `raised` prop for the
reference implementation of this branch.

### The one accent
```
accent       = '#6C63FF'   // electric indigo
accentMuted  = 'rgba(108, 99, 255, 0.16)'
accentStrong = '#5A4FE0'
```
Chosen for contrast, not vibes: **4.87:1 against pure black, 4.32:1 against
pure white** (WCAG AA for large text/graphical UI in both directions, AA
body-text on black). It sits between blue and violet on purpose — far
enough from "default system blue" to read as a deliberate brand color.

Where it's allowed:
- Focus rings (`Input`, `SearchBar`)
- The active/selected indicator (`SegmentedControl`'s sliding pill)
- Progress (`ProgressRing`'s default `color`)
- Small interactive affordances that want to say "tap me"

Where it is **not** allowed: money direction (that's `success`/`danger`),
default button fills, backgrounds, icons, avatars, or anything decorative.
If you're reaching for `accent` a third time on the same screen, stop and
ask whether it should be `ink` instead. This is a one-hue system, not a
palette.

### success / danger (new, per-theme)
Unlike `accent`, these are tuned per theme because a flat green/red fails
AA against white:
```
lightTheme: success '#15803D'   danger '#DC2626'
darkTheme:  success '#34D399'   danger '#FF5C5C'
```
Use only for genuine money direction (`StatusTag`'s `tone` prop) or
errors. Never as a stand-in for "make this more visually interesting."

### Motion (`motion`)
One shared system so nothing feels hand-tuned in isolation:
- `durations.instant/fast/base/slow/slower` (80 / 140 / 220 / 320 / 480ms).
  `duration` (flat, 140ms) is the pre-existing field, kept for the one call
  site (`Toast`) that already read it directly — equal to `durations.fast`.
- `easing.standard/accelerate/decelerate` — `Easing.bezier` curves. Use
  `standard` by default; `accelerate`/`decelerate` for exits/entrances that
  should feel asymmetric (e.g. a toast that snaps out faster than it eased in).
- `spring.press` — the snap for `PressableScale`.
- `spring.gentle` — sheets, sliding indicators; a touch softer.
- `scalePressed` (0.96) — default press-down scale.

## Motion primitives (`src/component/motion/`)

| Component | Props | Use for |
|---|---|---|
| `PressableScale` | same as `Pressable`, plus `scaleTo?` | The base of every pressable in `ui/` — Button, Card, ListRow, ActionTile, ContactChip, Row, icon buttons. |
| `FadeIn` | `delay?, duration?, style?` | Opacity-only mount transition. |
| `SlideIn` | `delay?, duration?, direction?, distance?, style?` | Fade + short directional travel; the default mount transition (Sheet content style, EmptyState, ListRow's `index` stagger). |
| `Stagger` | `interval?, initialDelay?, direction?, distance?, duration?, itemStyle?` | Wraps each direct child in `SlideIn` with an incrementing delay — cascades a short list in. |
| `AnimatedNumber` | `value, formatter?, duration?, animateOnMount?, style?` | Renders a number that rolls to a new value instead of snapping. |
| `useAnimatedNumber` | `(value, { duration?, animateOnMount? })` → `number` | The mechanism behind `AnimatedNumber`; use directly when you need the raw in-flight number for custom rendering (see `AmountDisplay`, which splits whole/fraction into two styles). |
| `Shimmer` | `style?` | Moving highlight sweep for skeletons — sizes itself to its parent via `onLayout`, so drop it inside an `overflow: hidden` box. |
| `ProgressRing` | `progress?, indeterminate?, size?, strokeWidth?, color?, trackColor?` | SVG progress ring; `indeterminate` spins a fixed arc for unbounded waits (e.g. around a QR scan target). Defaults to `accent`. |
| `Pulse` | `active?, minScale?, maxScale?, style?` | Gentle breathing loop for "waiting" states — a scanning target, a live dot. |
| `haptic(event)` | `'tap' \| 'select' \| 'scan' \| 'success' \| 'warning'` | Thin `Vibration` wrapper, named by intent. Used today in `KeypadNumeric`; call it from screens on scan-success / payment-success. |

All mount/transition primitives use `useNativeDriver: true` except
`AnimatedNumber`/`useAnimatedNumber` (has to read the value back out to
render text — there's no way to do that off the JS thread) and color
interpolations (`SearchBar`/`Input` focus ring — color isn't a
native-driver-eligible style property).

## Upgraded components (`src/component/ui/`)

Every existing prop signature still works; changes below are internal or
additive (new optional props only):

- **Button** — `radii.md` corners, `PressableScale` spring, label↔spinner
  now crossfades on `loading` instead of popping.
- **Card** — `radii.md`, `PressableScale` spring, new optional `raised`
  prop (flat cards only) using the surface ramp / `elevation`.
- **ListRow** — `PressableScale`, new optional `index` prop to stagger a
  list's mount via `SlideIn`.
- **Row** — same press treatment as ListRow (`PressableScale` + `radii.sm`)
  for consistency; no prop changes.
- **KeypadNumeric** — `PressableScale` (`scaleTo={0.94}`, a firmer snap
  since keys are small), `haptic('tap')` per key, Android ripple.
- **SegmentedControl** — the selected state is now a single pill that
  springs (`motion.spring.gentle`) to the active segment instead of an
  instant per-cell color flip.
- **Sheet** — manual spring slide-up + backdrop fade (`animationType="none"`
  on the underlying `Modal`, driven by `Animated`) instead of the OS's
  linear slide; rounded top corners (`radii.lg`); close button uses
  `PressableScale`.
- **Toast** — slide-up + fade in both directions (was fade-only).
- **Skeleton** — now layers a `Shimmer` sweep instead of a flat opacity
  pulse; `radii.sm`.
- **Avatar** — subtle two-stop monochrome gradient (angle + mix ratio
  derived from a hash of `name`) instead of a flat fill, so a list of
  avatars reads as distinct people. Still strictly `ink`/`paper` mixes —
  never the accent.
- **AmountDisplay** — value rolls via `useAnimatedNumber` instead of
  snapping; whole/fraction split and styling unchanged.
- **SearchBar** / **Input** — focus now animates the border color toward
  `accent` (was: instant border-weight change to `ink`); clear/icon buttons
  use `PressableScale`.
- **EmptyState** — fades + rises in (`SlideIn`) instead of appearing instantly.
- **StatusTag** — new optional `tone?: 'neutral' | 'success' | 'danger'`
  (defaults to `'neutral'`, which renders pixel-identical to before); now
  pill-shaped (`radii.pill`).
- **Screen** — back button uses `PressableScale`.

## Coherence checklist for new screens

- Read all color from `useTheme()`. The QR component is the only exception.
- Reach for `PressableScale` under any custom pressable rather than a bare
  `Pressable` with an opacity/color flip.
- Use `motion.durations` / `motion.easing` / `motion.spring` — don't invent
  a new duration or curve inline.
- `accent` sparingly, per the table above. If in doubt, don't.
- `radii` from the scale — never a literal number.
