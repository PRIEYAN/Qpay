# Qpay — web frontend

The Qpay mobile app (`mobile/Qpay`, React Native) ported to the browser with
Vite + React + TypeScript. Same product, same design system, same on-chain
behaviour — every screen and the full payment flow, plus a new landing page.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle into dist/
npm run typecheck
```

## What talks to what

```
src/
  config/network.ts     Coston2 RPC, contract addresses, tokens  (copied verbatim)
  contracts/            ABIs + typed accessors, decimals, lots   (copied verbatim)
  services/             the whole domain layer                   (copied verbatim
                        except storage.ts, rewritten for localStorage)
  web3/                 NEW — EIP-1193/EIP-6963 wallet layer
  context/QpayProvider  one shared snapshot for every screen
  hooks/                useProfile / useBalances / useTransactions / …
  components/           UI primitives, motion, icons, QR
  screens/              13 screens + the landing page
  theme/                design tokens as CSS custom properties
```

The service, contract and utility layers were **copied unchanged** from the
mobile app — they are plain TypeScript over `ethers`, with no React Native
dependency, so all the on-chain logic is shared rather than reimplemented.
Only three things genuinely needed rewriting for the web:

| Mobile | Web |
| --- | --- |
| `@react-native-async-storage/async-storage` | `localStorage` (`services/storage.ts`, same async API) |
| Reown AppKit + WalletConnect | injected wallets via EIP-6963/EIP-1193 (`web3/`) |
| `react-native-camera-kit`, `react-native-qrcode-svg` | `getUserMedia` + `jsQR`, `qrcode` |

Navigation moved from React Navigation to React Router. Route params replace
the two places mobile needed workarounds: `ContactPicker` → `Request` used a
module-level variable because its route took no params, and that bridge is
gone — the URL carries the recipient.

## Wallet

There is no WalletConnect project id to configure. The app discovers
installed browser wallets over EIP-6963 (with a `window.ethereum` fallback),
lists them in the connect sheet, and reconnects silently on reload via
`eth_accounts`. Reads always run against the fixed Coston2 RPC, so balances
and history stay correct even while the wallet sits on the wrong chain; only
signing needs the switch.

## Theme

Light and dark are two sets of CSS custom properties in `theme/tokens.css`,
switched by a `data-theme` attribute on `<html>`. It follows the OS by
default and persists an explicit choice from Settings.

**The palette is three things and nothing else:**

- **Pure black `#000000`** and **pure white `#FFFFFF`** are literal poles —
  `--ink` / `--paper` swap between them per theme. Nothing in between
  pretends to be either.
- **Violet** (`--violet: #7c5cff`) is the single accent, used sparingly:
  focus rings, hover borders, hover tints, and the active tab. It never
  carries money direction — that stays `--success` / `--danger` — and never
  becomes a second neutral or a glow.
- Everything else is neutral.

**Glassmorphism** is the surface language. Elevated surfaces are frosted,
not filled: a translucent ground, a backdrop blur, a hairline top highlight,
and a soft shadow. The `--glass-*` tokens are the whole vocabulary, in three
weights — `--sunken` for input wells, the default for cards and rows,
`--strong` for sheets, the footer and the nav bars. Components compose them
(or the `.glass` class in `global.css`) rather than each inventing its own
rgba value, so every pane shares one focal depth.

Depth comes from the panes themselves — translucency, blur, a hairline lit
rim, and a small neutral shadow. There is deliberately **no coloured haze
behind the UI and no violet glow on any element**: shadows are neutral
black at low alpha, and the accent appears only as borders, focus rings,
hover tints and the active tab.

Glass fills are defined *per theme*, not once: a white wash over black reads
nothing like a white wash over white, so dark mode runs much lower alpha
(~5%) than light (~62%).

Three deliberate exceptions stay opaque:

- **Selected cards** invert to solid ink. A chosen option must be
  unmistakable, and glass-on-glass never is.
- **The QR code** is hardcoded black-on-white. It has to scan.
- **Browsers without `backdrop-filter`** get opaque surfaces via
  `@supports not` — translucent fills over a busy ground are unreadable
  without the blur.

The landing page opts out of the app shell and owns its own field — flat
black ground, white display type, frosted panes — because it's a brand
surface, not app chrome.

## Notes on behaviour that differs from mobile

Two pre-existing bugs were fixed rather than faithfully ported:

- **Cross-asset quotes were always zero.** `quoteConversion()` is synchronous
  (it runs during render) and reads a cache that `refreshPriceCache()` fills —
  but nothing ever called it, so every cross-asset send displayed
  "They receive 0.00". `QpayProvider` now primes and refreshes that cache, and
  `SendScreen` shows "Rate unavailable" instead of a fabricated `0.00` when the
  oracle genuinely can't be read.
- **The redeem screen hardcoded a 10 FXRP lot size** despite its own comments
  saying never to. The web build reads `AssetManager.lotSize()` live
  (`getFxrpLotSize()`), so the lot breakdown always matches what the chain
  will accept.

`QpayProvider` also calls `setWalletContext()`, which mobile never did — the
service layer keeps no wallet state of its own, so without it every read
would report as disconnected.
