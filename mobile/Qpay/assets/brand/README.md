# Qpay Brand Assets

Source-of-truth vector artwork for the Qpay app icon, logo, and splash. All
raster outputs shipped to Android/iOS are generated from the SVGs in this
folder — never hand-edit a PNG, regenerate it from the SVG instead.

## Brand rules (non-negotiable)

1. **Strictly monochrome.** Only `#000000` and `#FFFFFF` appear anywhere in
   this artwork. No gradients, no third color, no gray — antialiasing at
   raster edges is the renderer's job, not something baked into the vectors.
2. **Zero border radius.** Every canvas/background in this folder is a
   sharp-cornered square. The Q monogram itself is built from exactly two
   geometric primitives: a **ring** (circle minus circle — a true cut
   counter, not a filled disc) and a **tail** (a straight-sided
   parallelogram with perpendicular, sharp-cut ends — no rounded caps
   anywhere). OS-level icon masking (squircle on iOS, circle/squircle/rounded
   square on Android adaptive icons) is applied at runtime outside our
   control; the artwork is padded so that masking never clips the mark (see
   "Safe zones" below).
3. **Geometric Q monogram.** The mark is an original construction, not a
   glyph from any font: a bold circular ring (the "O" body of the Q) with a
   diagonal tail exiting at 45° from the bottom-right, cut off flush. It
   reads clearly down to 48px because it has exactly two visual parts and
   one clear counter (negative-space hole).
4. **Light + dark variants** exist for both the mark alone and the full
   icon tile.

## Files

| File | Description |
|---|---|
| `logo-mark.svg` | The Q monogram alone. Black fill, **transparent** background, `viewBox="-50 -50 100 100"` (square, origin-centered on the mark's own optical center). Drop this into any surface/color. |
| `logo-mark-inverse.svg` | Same monogram, white fill, on an opaque **black** square background (same viewBox). Ready-to-use dark tile. |
| `logo-lockup.svg` | Mark + "Qpay" wordmark, horizontal, black on transparent. The "pay" letters are **real vector paths** (not `<text>`) extracted from a heavy geometric sans (see "Wordmark typeface" below), so the file has zero runtime font dependency. |
| `logo-lockup-inverse.svg` | Same lockup, white on solid black tile. Bonus dark-mode variant (not required by spec, included for completeness). |
| `app-icon.svg` | The **light** full-bleed app icon: solid `#FFFFFF` square, black Q centered with icon safe-zone padding. This is the canonical source rasterized for every OS icon size (iOS, Android legacy + Play Store). |
| `app-icon-dark.svg` | The **dark** counterpart: solid `#000000` square, white Q. Not currently wired into any OS config (see "Why only the light icon ships" below); kept as source for a future iOS dark/tinted alternate-icon or marketing use. |
| `ic_launcher_foreground.svg` | Android adaptive-icon foreground layer only: transparent background, black Q, scaled to sit inside the 66dp safe zone of a 108dp tile (see "Safe zones"). Paired at runtime with `@color/ic_launcher_background` (`#FFFFFF`). |
| `playstore-icon.png` | 512×512 flattened raster of `app-icon.svg`, for Play Console store listing upload. |
| `generate_svgs.py` | The exact script that derives every shape above from first principles (ring radius, tail geometry, wordmark glyph extraction) and writes all the `.svg` files. Re-run it any time the geometry needs to change — see "Regeneration". |

## The Q mark geometry (raw, reusable)

Defined in a local coordinate space centered on the mark's own visual
center (so it drops into any square viewBox via `translate`+`scale`).
Two shapes, both filled with the same single color:

```
Ring (fill-rule="evenodd", so the inner circle is a true transparent hole):
  d="M -35.092,-3.092 A 32,32 0 1,0 28.908,-3.092 A 32,32 0 1,0 -35.092,-3.092
     M -19.092,-3.092 A 16,16 0 1,0 12.908,-3.092 A 16,16 0 1,0 -19.092,-3.092 Z"

Tail (polygon, sharp perpendicular-cut ends):
  points="5.393,16.707 23.778,35.092 35.092,23.778 16.707,5.393"
```

Outer ring radius 32, inner counter radius 16 (16-unit ring thickness),
ring center at (-3.092, -3.092). Full mark bounding box is 70.184 × 70.184,
centered on the origin. Max reach of any point from the origin is 42.389
units — this number is what the Android adaptive-icon safe-zone scale is
derived from.

### Drop-in `react-native-svg` component

`react-native-svg` is already a project dependency. A `QMark` component
using this exact path data (another agent can place this under
`src/components/` or wherever the design-system lives — this repo entry is
intentionally *not* touching `src/`):

```tsx
import Svg, { Path, Polygon } from 'react-native-svg';

type QMarkProps = {
  size?: number;
  color?: string; // must stay '#000000' or '#FFFFFF' per brand rules
};

export function QMark({ size = 24, color = '#000000' }: QMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="-50 -50 100 100">
      <Path
        fillRule="evenodd"
        fill={color}
        d="M -35.092,-3.092 A 32,32 0 1,0 28.908,-3.092 A 32,32 0 1,0 -35.092,-3.092 M -19.092,-3.092 A 16,16 0 1,0 12.908,-3.092 A 16,16 0 1,0 -19.092,-3.092 Z"
      />
      <Polygon
        fill={color}
        points="5.393,16.707 23.778,35.092 35.092,23.778 16.707,5.393"
      />
    </Svg>
  );
}
```

For the full lockup (mark + "pay" wordmark), just import
`assets/brand/logo-lockup.svg` with `react-native-svg`'s `SvgXml`/`SvgUri`,
or run it through `react-native-svg-transformer` if the project adopts one —
the file is a plain static SVG, no special handling required.

## Wordmark typeface

"pay" in `logo-lockup.svg` is set in **URW Gothic Demi** (a Century-Gothic
/ ITC Avant Garde Gothic–style geometric sans, `/usr/share/fonts/gsfonts/
URWGothic-Demi.otf` on the machine this was generated on) — chosen because
it is a genuinely geometric sans (perfect circular bowls, monolinear
strokes) matching the Swiss/International brief, and it was already
installed so no network font-fetch was needed. The glyphs were extracted to
raw cubic/quadratic path data with `fontTools` (`SVGPathPen`) at generation
time, so **`logo-lockup.svg` has no runtime font dependency** — it will
render identically on any machine, with or without that font installed.
The "Q" in the lockup is the custom monogram (not the font's own Q glyph),
scaled to `capHeight × 1.28` so it reads as the dominant mark.

## Safe zones

- **`app-icon.svg` (and everything rasterized from it: iOS icon, Android
  legacy `ic_launcher`/`ic_launcher_round`, Play Store icon):** mark is
  scaled so its full bounding box spans **60% of the canvas** (20% margin
  each side). This is safe under both iOS's squircle mask and a full
  inscribed-circle mask (worst case for old Android round icons): the
  mark's half-height (30% of canvas) is well inside a 50%-radius inscribed
  circle.
- **`ic_launcher_foreground.svg` (Android adaptive icon):** Android
  guarantees only the central 66dp of a 108dp foreground tile survives every
  possible mask shape. The mark's own max-reach-from-center (42.389 local
  units, computed above) is scaled down to an effective reach of **30 units
  within a 33-unit safe radius** (66dp / 2), i.e. a 3-unit / ~9% buffer past
  the guaranteed-safe boundary.

## Why only the light icon ships

`app-icon-dark.svg` and `logo-mark-inverse.svg` exist as source so a dark
variant can be wired up later (e.g. iOS 18's alternate dark/tinted icon
appearances, which need extra `"appearances"` entries per image in
`Contents.json`), but:
- The existing `ios/Qpay/Images.xcassets/AppIcon.appiconset/Contents.json`
  was already in the **older single-appearance, multi-size iphone format**
  (no `"appearances"` key on any entry) before this change, so per the task
  brief ("match whatever format is already there rather than switching it")
  it was kept in that format — light icon only.
- Android adaptive icons take exactly one foreground + one background per
  `mipmap-anydpi-v26/ic_launcher*.xml`; there's no dark-mode icon switch
  without a separate resource-qualifier setup (`-night` mipmap variants),
  which wasn't part of the ask.

## Android splash / launch screen

No splash screen is currently configured anywhere in this project: no
`windowBackground`/theme splash in `android/app/src/main/res/values/
styles.xml`, no `react-native-bootsplash` (or similar) in `package.json`,
no splash-related code in `MainActivity`. Per the task brief ("if a splash
is configured, supply matching assets"), nothing was added here to avoid
inventing app-behavior wiring outside this task's ownership. If/when a
splash is introduced, `app-icon.svg` (mark-on-white) or
`app-icon-dark.svg` (mark-on-black) are both already exactly what a
"mark centered on a solid field" splash needs — just point the new splash
config at a raster of one of those.

## iOS launch screen

`ios/Qpay/LaunchScreen.storyboard` was inspected and left untouched: it
only contains two `UILabel`s ("Qpay" / "Powered by React Native") — it does
not reference any `UIImageView` or image asset, so there was nothing missing
to supply and no risk of a broken reference.

## Regeneration

All SVGs are derived by `generate_svgs.py` (requires `fontTools`:
`pip install fonttools`). Run it from anywhere; it writes directly into this
folder:

```bash
python3 assets/brand/generate_svgs.py
```

Rasterization commands actually used (run from the `mobile/Qpay` project
root; `magick` = ImageMagick 7, `rsvg-convert` 2.62):

### Android legacy launcher icons (`ic_launcher` / `ic_launcher_round`)

```bash
# mdpi 48, hdpi 72, xhdpi 96, xxhdpi 144, xxxhdpi 192
for pair in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  d=${pair%%:*}; sz=${pair##*:}
  rsvg-convert -w "$sz" -h "$sz" assets/brand/app-icon.svg \
    -o "android/app/src/main/res/mipmap-$d/ic_launcher.png"
  rsvg-convert -w "$sz" -h "$sz" assets/brand/app-icon.svg \
    -o "android/app/src/main/res/mipmap-$d/ic_launcher_round.png"
done
```

### Android adaptive icon foreground (108dp-equivalent per density)

```bash
# mdpi 108, hdpi 162, xhdpi 216, xxhdpi 324, xxxhdpi 432
for pair in mdpi:108 hdpi:162 xhdpi:216 xxhdpi:324 xxxhdpi:432; do
  d=${pair%%:*}; sz=${pair##*:}
  rsvg-convert -w "$sz" -h "$sz" --background-color=none \
    assets/brand/ic_launcher_foreground.svg \
    -o "android/app/src/main/res/mipmap-$d/ic_launcher_foreground.png"
done
```

### Play Store icon

```bash
rsvg-convert -w 512 -h 512 assets/brand/app-icon.svg -o assets/brand/playstore-icon.png
```

### iOS AppIcon.appiconset (matches the project's existing multi-size Contents.json)

```bash
# name:px — px values are size×scale from Contents.json
# 20x20@2x=40, 20x20@3x=60, 29x29@2x=58, 29x29@3x=87,
# 40x40@2x=80, 40x40@3x=120, 60x60@2x=120, 60x60@3x=180, 1024x1024@1x=1024
pairs="AppIcon-20@2x:40 AppIcon-20@3x:60 AppIcon-29@2x:58 AppIcon-29@3x:87 \
       AppIcon-40@2x:80 AppIcon-40@3x:120 AppIcon-60@2x:120 AppIcon-60@3x:180 \
       AppIcon-1024:1024"
IOS=ios/Qpay/Images.xcassets/AppIcon.appiconset
for pair in $pairs; do
  name="${pair%%:*}"; sz="${pair##*:}"
  rsvg-convert -w "$sz" -h "$sz" assets/brand/app-icon.svg -o "/tmp/${name}.png"
  # Apple requires the App Store icon (and all icons, in practice) to have
  # NO alpha channel. -alpha off strips it entirely (not just flattens).
  magick "/tmp/${name}.png" -alpha off -background white -flatten "PNG24:$IOS/${name}.png"
done
```

Verify no alpha channel made it through:

```bash
magick identify -format '%[channels]\n' ios/Qpay/Images.xcassets/AppIcon.appiconset/AppIcon-1024.png
# -> srgb   (not srgba — confirms no alpha)
```
