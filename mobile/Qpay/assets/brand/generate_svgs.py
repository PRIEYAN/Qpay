#!/usr/bin/env python3
"""
Qpay brand asset generator.
Builds the Q monogram + 'pay' wordmark (text converted to real vector paths,
no runtime font dependency) as hand-computed / fontTools-extracted SVG paths,
then emits every required source SVG into assets/brand/.

Strict brand rules enforced here:
  - only #000000 and #FFFFFF are ever used as fill/background colors
  - no rounded corners on any canvas / background shape
  - the Q monogram is built from two geometric primitives only: a ring
    (circle minus circle, true transparent counter) and a straight-edged
    diagonal tail (parallelogram, sharp perpendicular-cut ends)
"""
import math, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

OUT = "/home/prieyan/weeb/Qpay/mobile/Qpay/assets/brand"
os.makedirs(OUT, exist_ok=True)

BLACK = "#000000"
WHITE = "#FFFFFF"

# ---------------------------------------------------------------------------
# 1. THE Q MARK -- defined once, in local coordinates centered on its own
#    visual centroid (origin = optical center of the mark, NOT the ring
#    center, so it drops into any canvas already centered).
# ---------------------------------------------------------------------------
# Ring (the "O" body of the Q): outer radius R, inner (counter) radius r,
# ring geometric center RC (before recentering the whole mark on origin).
R = 32.0
r_in = 16.0
RC = (0.0, 0.0)  # ring center, pre-recentering

# Tail: a straight bar at 45 degrees exiting the ring at bottom-right,
# starting inside the ring band (distance d1 from ring center) and ending
# outside it (distance d2 from ring center), with half-width hw and sharp
# (perpendicular-cut) ends.
d1, d2, hw = 20.0, 46.0, 8.0
ang = math.radians(45)
dirv = (math.cos(ang), math.sin(ang))
perp = (-math.sin(ang), math.cos(ang))

def pt_along(d):
    return (RC[0] + d * dirv[0], RC[1] + d * dirv[1])

A = pt_along(d1)
B = pt_along(d2)

def offset(p, s):
    return (p[0] + s * hw * perp[0], p[1] + s * hw * perp[1])

A1, A2 = offset(A, 1), offset(A, -1)
B1, B2 = offset(B, 1), offset(B, -1)

# Whole-mark bounding box (ring + tail), in pre-recentered coordinates.
xs = [RC[0] - R, RC[0] + R, A1[0], A2[0], B1[0], B2[0]]
ys = [RC[1] - R, RC[1] + R, A1[1], A2[1], B1[1], B2[1]]
bbox_cx = (min(xs) + max(xs)) / 2
bbox_cy = (min(ys) + max(ys)) / 2

def recenter(p):
    return (p[0] - bbox_cx, p[1] - bbox_cy)

RC2 = recenter(RC)
A1, A2, B1, B2 = [recenter(p) for p in (A1, A2, B1, B2)]

xs = [RC2[0] - R, RC2[0] + R, A1[0], A2[0], B1[0], B2[0]]
ys = [RC2[1] - R, RC2[1] + R, A1[1], A2[1], B1[1], B2[1]]
MARK_W = max(xs) - min(xs)
MARK_H = max(ys) - min(ys)
assert abs(MARK_W - MARK_H) < 1e-6, "mark bbox must be square"
print(f"[mark] bbox = {MARK_W:.3f} x {MARK_H:.3f}, centered on origin, ring center={RC2}")

# Farthest distance from the origin (used to size Android adaptive safe-zone).
def circle_far(cx, cy, rad):
    return math.hypot(cx, cy) + rad

reach_candidates = [
    circle_far(RC2[0], RC2[1], R),
    math.hypot(*A1), math.hypot(*A2), math.hypot(*B1), math.hypot(*B2),
]
MARK_REACH = max(reach_candidates)
print(f"[mark] max reach from origin = {MARK_REACH:.3f}")

def fmt(v):
    return f"{v:.3f}".rstrip("0").rstrip(".")

def ring_path_d(cx, cy):
    ox1, oy1 = cx - R, cy
    ox2, oy2 = cx + R, cy
    ix1, iy1 = cx - r_in, cy
    ix2, iy2 = cx + r_in, cy
    return (
        f"M {fmt(ox1)},{fmt(oy1)} A {fmt(R)},{fmt(R)} 0 1,0 {fmt(ox2)},{fmt(oy2)} "
        f"A {fmt(R)},{fmt(R)} 0 1,0 {fmt(ox1)},{fmt(oy1)} "
        f"M {fmt(ix1)},{fmt(iy1)} A {fmt(r_in)},{fmt(r_in)} 0 1,0 {fmt(ix2)},{fmt(iy2)} "
        f"A {fmt(r_in)},{fmt(r_in)} 0 1,0 {fmt(ix1)},{fmt(iy1)} Z"
    )

RING_D = ring_path_d(*RC2)
TAIL_POINTS = " ".join(f"{fmt(x)},{fmt(y)}" for x, y in (A1, B1, B2, A2))

def mark_group(fill, transform=None):
    t = f' transform="{transform}"' if transform else ""
    return (
        f'<g{t}>\n'
        f'    <path fill-rule="evenodd" fill="{fill}" d="{RING_D}"/>\n'
        f'    <polygon fill="{fill}" points="{TAIL_POINTS}"/>\n'
        f'  </g>'
    )

# ---------------------------------------------------------------------------
# 2. "pay" wordmark -- real glyph outlines extracted from URW Gothic Demi
#    (a Century-Gothic-style geometric sans already installed on this
#    machine) via fontTools, so the SVG needs no installed font at all.
# ---------------------------------------------------------------------------
FONT_PATH = "/usr/share/fonts/gsfonts/URWGothic-Demi.otf"
font = TTFont(FONT_PATH)
upm = font["head"].unitsPerEm
glyph_set = font.getGlyphSet()
cmap = font.getBestCmap()
hmtx = font["hmtx"]

def glyph_path_and_advance(ch):
    gname = cmap[ord(ch)]
    pen = SVGPathPen(glyph_set)
    glyph_set[gname].draw(pen)
    d = pen.getCommands()
    adv = hmtx[gname][0]
    return d, adv

TRACKING = 40  # extra font-units of tracking between letters (upm=1000)
letters = []
x_cursor = 0
for ch in "pay":
    d, adv = glyph_path_and_advance(ch)
    letters.append((d, x_cursor))
    x_cursor += adv + TRACKING
TEXT_ADVANCE = x_cursor - TRACKING  # total width in font units, no trailing tracking

def word_paths_svg(fill, scale, tx, ty):
    """
    Font glyph space is y-up with origin on the baseline; SVG is y-down.
    transform: translate(tx,ty) scale(scale,-scale)  flips y and places
    the baseline at (tx,ty) in the parent coordinate system.
    """
    out = [f'<g fill="{fill}" transform="translate({fmt(tx)},{fmt(ty)}) scale({fmt(scale)},{fmt(-scale)})">']
    for d, x0 in letters:
        out.append(f'    <path transform="translate({fmt(x0)},0)" d="{d}"/>')
    out.append("  </g>")
    return "\n".join(out)

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
SVG_HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n'

def svg(viewbox, body, title):
    return (
        SVG_HEAD
        + f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}">\n'
        + f"  <title>{title}</title>\n"
        + body
        + "\n</svg>\n"
    )

def write(name, content):
    path = os.path.join(OUT, name)
    with open(path, "w") as f:
        f.write(content)
    print(f"wrote {path} ({len(content)} bytes)")

# ---------------------------------------------------------------------------
# 3. logo-mark.svg  -- black Q, transparent background, 100x100 viewBox
# ---------------------------------------------------------------------------
write(
    "logo-mark.svg",
    svg("-50 -50 100 100", "  " + mark_group(BLACK), "Qpay Q Mark"),
)

# ---------------------------------------------------------------------------
# 4. logo-mark-inverse.svg -- white Q on solid black square, 100x100 viewBox
# ---------------------------------------------------------------------------
inv_body = (
    f'  <rect x="-50" y="-50" width="100" height="100" fill="{BLACK}"/>\n'
    "  " + mark_group(WHITE)
)
write("logo-mark-inverse.svg", svg("-50 -50 100 100", inv_body, "Qpay Q Mark (Inverse)"))

# ---------------------------------------------------------------------------
# 5. logo-lockup.svg -- mark + "Qpay" wordmark, horizontal, transparent bg
#    "Q" is the monogram itself (scaled to match text cap-height rhythm),
#    "pay" is real vector paths from URW Gothic Demi.
# ---------------------------------------------------------------------------
capH = font["OS/2"].sCapHeight  # 739
# Scale the mark so its full height equals capHeight * MARK_TO_CAP, giving
# the monogram a bit more visual weight than the lowercase letters (as is
# conventional for a mark-led lockup).
MARK_TO_CAP = 1.28
mark_scale = (capH * MARK_TO_CAP) / MARK_H
mark_h_final = MARK_H * mark_scale
mark_w_final = MARK_W * mark_scale

GAP = capH * 0.32  # visual gap between mark and wordmark
text_scale = 1.0 / upm  # will be multiplied by a font-size factor below
FONT_SIZE = capH  # render font at capHeight-equivalent size (1 unit = 1 font unit)
text_w_final = TEXT_ADVANCE * (FONT_SIZE / upm)

# Baseline placement: text baseline sits so the lowercase x-height block is
# vertically centered on the mark's optical center (y=0 in mark space).
xh = font["OS/2"].sxHeight
xh_final = xh * (FONT_SIZE / upm)
baseline_y = xh_final / 2  # since mark center is y=0 and text grows upward from baseline

total_w = mark_w_final + GAP + text_w_final
pad = capH * 0.22
canvas_w = total_w + 2 * pad
canvas_h = mark_h_final + 2 * pad
# mark center placed at (pad + mark_w_final/2, canvas_h/2)
mark_cx = pad + mark_w_final / 2
mark_cy = canvas_h / 2
text_x0 = pad + mark_w_final + GAP
text_baseline_y = mark_cy + baseline_y

lockup_body = (
    "  "
    + mark_group(BLACK, transform=f"translate({fmt(mark_cx)},{fmt(mark_cy)}) scale({fmt(mark_scale)})")
    + "\n  "
    + word_paths_svg(BLACK, FONT_SIZE / upm, text_x0, text_baseline_y)
)
write(
    "logo-lockup.svg",
    svg(f"0 0 {fmt(canvas_w)} {fmt(canvas_h)}", lockup_body, "Qpay Logotype"),
)

# dark/inverse lockup bonus variant (white on black, full-bleed square-corner tile)
lockup_dark_body = (
    f'  <rect x="0" y="0" width="{fmt(canvas_w)}" height="{fmt(canvas_h)}" fill="{BLACK}"/>\n'
    "  "
    + mark_group(WHITE, transform=f"translate({fmt(mark_cx)},{fmt(mark_cy)}) scale({fmt(mark_scale)})")
    + "\n  "
    + word_paths_svg(WHITE, FONT_SIZE / upm, text_x0, text_baseline_y)
)
write(
    "logo-lockup-inverse.svg",
    svg(f"0 0 {fmt(canvas_w)} {fmt(canvas_h)}", lockup_dark_body, "Qpay Logotype (Inverse)"),
)

# ---------------------------------------------------------------------------
# 6. app-icon.svg (light) / app-icon-dark.svg (dark)
#    Full-bleed square, sharp corners (OS applies its own mask at runtime).
#    Mark is scaled so total mark bbox spans 60% of the canvas (20% margin
#    each side) -- safe under both iOS squircle masking and a full inscribed
#    circular mask (legacy Android round icons), per calc in README.
# ---------------------------------------------------------------------------
ICON_SIZE = 1024
MARGIN_FRACTION = 0.20  # each side
icon_mark_scale = (ICON_SIZE * (1 - 2 * MARGIN_FRACTION)) / MARK_H
icon_cx = icon_cy = ICON_SIZE / 2

def icon_svg(bg, fg):
    body = (
        f'  <rect x="0" y="0" width="{ICON_SIZE}" height="{ICON_SIZE}" fill="{bg}"/>\n'
        "  "
        + mark_group(fg, transform=f"translate({fmt(icon_cx)},{fmt(icon_cy)}) scale({fmt(icon_mark_scale)})")
    )
    return svg(f"0 0 {ICON_SIZE} {ICON_SIZE}", body, "Qpay App Icon")

write("app-icon.svg", icon_svg(WHITE, BLACK))
write("app-icon-dark.svg", icon_svg(BLACK, WHITE))

# ---------------------------------------------------------------------------
# 7. Android adaptive icon foreground -- transparent bg, mark only, scaled
#    to fit inside the 66dp safe zone of a 108dp tile with buffer.
# ---------------------------------------------------------------------------
TILE = 108.0
SAFE_RADIUS = 33.0  # 66dp / 2
BUFFER = 3.0
target_reach = SAFE_RADIUS - BUFFER  # 30.0
fg_scale = target_reach / MARK_REACH
fg_cx = fg_cy = TILE / 2
fg_body = "  " + mark_group(BLACK, transform=f"translate({fmt(fg_cx)},{fmt(fg_cy)}) scale({fmt(fg_scale)})")
write("ic_launcher_foreground.svg", svg(f"0 0 {TILE} {TILE}", fg_body, "Qpay Adaptive Icon Foreground"))
print(f"[adaptive] fg_scale={fg_scale:.4f} effective reach={target_reach:.2f} of safe radius {SAFE_RADIUS}")

# ---------------------------------------------------------------------------
# 8. dump raw path data for README / in-app component use
# ---------------------------------------------------------------------------
with open(os.path.join(OUT, "_mark_path_dump.txt"), "w") as f:
    f.write("RING_D=\n" + RING_D + "\n\nTAIL_POINTS=\n" + TAIL_POINTS + "\n")
print("RING_D:", RING_D)
print("TAIL_POINTS:", TAIL_POINTS)
print("MARK_W", MARK_W, "MARK_H", MARK_H)
