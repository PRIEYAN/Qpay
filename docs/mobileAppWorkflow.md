# Qpay Mobile — App Workflow & UI Spec

> Status: Draft v1.0 · Stack: React Native 0.86 + TypeScript, `mobile/Qpay/`
> Companion docs: `plan.md` (product/protocol), `contractPlan.md` (on-chain), `agent.md` (chain-selection agent)

## 1. Scope

This covers the mobile app end to end: screen inventory, navigation flow, state/data needs per screen, and the visual design system. The app is the "GPay experience" phase from `plan.md`'s build order — QR scan, balance, contacts, send, request, and the primary-chain picker — wrapped around the ledger/gateway contracts from `contractPlan.md`.

Existing screen folders under `mobile/Qpay/src/screens/`: `auth/` (`onBoarding`, `walletLogin`), `dashboard/` (`logs`, `qrScanner`), `Chains`, `profile`. This doc treats those as the given inventory and fills in the flow and states between them.

## 2. Screen inventory & flow

```
┌─────────────┐
│ onBoarding  │  first launch only — explains "primary chain" concept
└──────┬──────┘
       ▼
┌─────────────┐
│ walletLogin │  connect/create wallet (embedded or external signer)
└──────┬──────┘
       ▼
┌─────────────────────────────────────────────┐
│ Primary-chain picker (first login only)       │
│ [ XRP ]  [ Flare ]  [ USDT ]                  │  ← the one real chain decision, per plan.md §3
└──────┬────────────────────────────────────────┘
       ▼
┌─────────────────────────────────────────────────────────┐
│                        dashboard                          │
│  balance (primary-chain asset) · recent activity · CTA    │
└───┬─────────────┬──────────────┬──────────────┬──────────┘
    │              │              │              │
    ▼              ▼              ▼              ▼
qrScanner      Send / Pay     Request        Chains
(scan to pay)  (amount entry, (generate own   (per-chain balances,
               confirm, sign)  static/dynamic  ingress/egress,
                               QR)              redeem flow)
    │
    ▼
dashboard/logs   ← transaction history, filterable by chain/status
    │
    ▼
profile          ← identity, primary-chain change, signing-key mgmt, logout
```

### 2.1 Onboarding (`auth/onBoarding`)

- 2–3 swipeable panels, plain text + icon, no video/animation dependency.
- Copy should mirror `plan.md`'s framing: "pay in what you hold, get paid in what you want" — never surface the words "bridge," "relayer," or "gas" here. This screen sells the outcome, not the mechanism.
- Skippable after first view; never shown again once a wallet exists locally.

### 2.2 Wallet login (`auth/walletLogin`)

- Two paths, same visual weight: **Create wallet** (embedded key, custodied per `merchantVault.md`'s embedded-wallet model) and **Connect wallet** (external signer).
- On success, check whether a primary chain is already set (returning user) → skip straight to dashboard. If not (first login) → primary-chain picker.

### 2.3 Primary-chain picker

- Exactly three choices, per `plan.md` §3: **XRP**, **Flare**, **USDT**. Rendered as three equal-weight tappable cards, not a dropdown — this is the one decision the whole product asks the user to make, so it should not be buried in a settings menu.
- Selecting sets the FAssets-backed balance the user will hold and the default egress route. Changeable later from `profile`, but framed there as an occasional action, not a frequent one.

### 2.4 Dashboard (`dashboard/`)

- Primary content: current balance in the user's primary-chain asset, large and unambiguous. No multi-chain balance clutter on the main screen — that detail lives in `Chains`.
- Two primary actions, equally weighted: **Send** and **Request**, plus a scan-to-pay shortcut that opens `qrScanner` directly.
- Recent activity: last 3–5 transactions inline, "see all" → `dashboard/logs`.

### 2.5 QR scanner (`dashboard/qrScanner`)

- Camera view scanning a static merchant QR (`qpay:username`, per `plan.md` §"Static merchant QR") or a dynamic invoice QR (pre-filled amount).
- Static QR → amount entry screen. Dynamic QR → confirm screen directly, amount not editable.
- Torch toggle and manual username-entry fallback (typed lookup) for when scanning fails — camera permission or lighting issues shouldn't dead-end the flow.

### 2.6 Send / Pay

- Recipient (from scan, contact, or typed username) → amount → confirm → sign.
- Confirm screen shows: recipient, amount in sender's asset, amount receiver actually gets (post-conversion, if primary chains differ), and — if a route decision is involved (ingress/egress edge, not an internal transfer) — the chain-selection agent's recommended route with its one-line rationale (per `agent.md` §5), never auto-applied without this explicit confirm step.
- Sign step uses the gasless EIP-712 path (`payWithAuth`) by default; a wallet with zero native gas must still be able to complete this screen.

### 2.7 Request

- Generates the user's own QR: static (`qpay:username`, no amount, printable) or dynamic (specific amount, expires).
- Toggle between the two modes on one screen, not two separate flows.

### 2.8 Chains (`Chains`)

- Per-chain balance breakdown (the detail deliberately hidden from the main dashboard).
- Ingress entry point (deposit real XRP/other asset → credited as FAsset) and egress entry point (redeem FAsset → real asset out), each a clearly separate action given their different latency (instant internal vs. slow cross-chain, per `plan.md`'s zone model).
- Redemption partial-fill state must be representable here — a redemption can complete over multiple fills, and the UI needs a status that isn't just "done/not done."

### 2.9 Logs (`dashboard/logs`)

- Flat, reverse-chronological transaction list. Filters: chain, direction (sent/received/ingress/egress), status.
- Each row expands to a detail view with the on-chain reference (tx hash / explorer link) — this is the receipts screen, so it should always be able to prove itself, not just assert a status from the backend.

### 2.10 Profile

- Identity (username, avatar), primary-chain change (re-enters the picker flow with a clear warning about what changes), signing-key management (embedded vs. external, per wallet-login path taken), logout.

## 3. Visual design system

**Concept: minimalist, Google-Pay-inflected, strictly monochrome.** The product removes complexity from crypto payments (per `plan.md`'s whole thesis); the UI should look like it removed complexity too. No color-coded chains, no gradient branding, no chain logos as the primary visual language — one ink, one paper, everything else is typography and spacing.

### 3.1 Palette

| Token | Value | Usage |
|---|---|---|
| `color.primary` (ink) | `#000000` pure black | Primary text, primary buttons, icons, active states |
| `color.surface` (paper) | `#FFFFFF` pure white | Backgrounds, cards, primary button text |
| `color.border` | `#000000` at reduced opacity or a single neutral gray (e.g. `#E5E5E5`) | Dividers, input outlines — used sparingly, prefer whitespace over lines |
| `color.muted` | mid-gray (e.g. `#8A8A8A`) | Secondary/disabled text only — the *only* non-binary tone permitted |

No accent color. Status (success/error) is conveyed through icon shape, weight, and text — not through introducing red/green into an otherwise strictly black-and-white system. If a status color is truly unavoidable (e.g. a destructive confirm), it should be the narrowest possible use, not a UI-wide accent.

**Dark mode:** invert the two poles — pure black becomes the surface, pure white becomes the ink. Same monochrome rule holds in both directions; nothing else in the palette changes.

### 3.2 Shape language

- **Border radius: `0px`, everywhere.** Buttons, cards, inputs, modals, avatars (square, not circular), QR frame — no rounded corners anywhere in the system. This is a hard rule, not a default-with-exceptions.
- Flat fills, no drop shadows or blur — depth is conveyed by black/white contrast and spacing, not elevation effects. A card sitting on a white background is a black-bordered rectangle, not a shadowed one.
- Dividers are 1px hairlines, not soft gray bars.

### 3.3 Typography

- One typeface family, weight does the differentiating work (regular / medium / bold) rather than size doing all of it — keeps the Google-Pay-style density where numbers (balances, amounts) are large and confident, labels are small and quiet.
- Balance/amount figures: largest text on screen, bold, pure black-on-white (or inverse) — no smaller-caption-plus-big-number tricks, the number *is* the hierarchy.
- All-caps used sparingly, only for section labels (e.g. "RECENT ACTIVITY"), tracked slightly wider, small size, muted-gray color — this is the one place the Google-Pay reference is most direct.

### 3.4 Components

- **Buttons:** full-bleed rectangles (0 radius), pure black fill / pure white text for primary actions; pure white fill / black 1px border / black text for secondary. No ghost buttons with colored text.
- **Cards** (chain cards, transaction rows): white surface, black 1px border, square corners, generous internal padding. Selection state = filled black background, inverted text — not a colored highlight or checkmark badge.
- **Inputs:** underline or full-border rectangle, 0 radius, black text on white, placeholder in muted gray. Focus state = border weight increases (e.g. 1px → 2px), not a color change.
- **QR code:** rendered in pure black modules on pure white, no colored frame or logo overlay — keeps it scannable and on-theme.
- **Icons:** single-weight line icons, black (or white in dark mode), no multi-color icon sets. Prefer geometric, squared-off icon shapes over rounded ones to match the 0-radius rule visually, not just literally.
- **Navigation:** bottom tab bar (per `src/component/bottomNav`) in white with black icons/labels, active tab indicated by filled black icon + label rather than a colored underline or dot.

### 3.5 Motion

- Minimal. Screen transitions are simple slide/fade, no bouncy easing — the Google-Pay reference point is calm, fast, and a little boring on purpose. Loading states are a thin black progress bar or a simple pulsing square, never a colored spinner.

## 4. Cross-cutting states

- **Offline / RPC unreachable:** dashboard must degrade to "last known balance, timestamped" rather than a blank or error screen — users should never lose sight of their own numbers because a network call failed.
- **Agent-assisted route recommendation unavailable** (Groq/CoinMarketCap down, per `agent.md` §7): Send/Chains flows fall back to the static default route silently at the data layer, but the confirm screen should show the route it picked without implying the agent evaluated it — don't render a fake rationale.
- **Gasless relay unavailable:** Send screen must surface a clear fallback ("pay gas yourself") rather than silently failing the transaction — same dual-path principle as the wallet-login screen.

## 5. Out of scope for this doc

- Actual navigation library choice (React Navigation vs. other) and state-management library — implementation detail, not a workflow/UI decision. Current `package.json` has no navigation dependency yet; this should be resolved in phase 4 of `contractPlan.md`'s build order.
- Contract call signatures / ABI details — covered in `contractPlan.md` and `implementation.md`.
