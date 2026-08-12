# Qpay — Start Here

Setup, environment variables, and deployment for both halves of the repo:
`contract/` (Hardhat 3 + Solidity) and `mobile/Qpay/` (React Native).

Companion docs: [docs/plan.md](docs/plan.md) (product), [docs/implementation.md](docs/implementation.md)
(verified addresses/signatures), [docs/contractPlan.md](docs/contractPlan.md) (build order),
[docs/mobileAppWorkflow.md](docs/mobileAppWorkflow.md) (screens/UI).

---

## 0. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 22.11.0 | Required by `mobile/Qpay/package.json` `engines`; also fine for `contract/` |
| npm | ≥ 10 | Shipped with Node 22 |
| A Coston2 test wallet | — | Get a private key from any wallet (MetaMask export, etc.) — **never reuse a mainnet key for testnet** |
| Xcode / Android Studio | latest | Only needed to run the mobile app on a simulator/device — see §4 |

---

## 1. Contracts — `contract/`

### 1.1 Install

```bash
cd contract
npm install
```

This pulls Hardhat 3, the mocha/ethers toolbox, and `@openzeppelin/contracts`. No `@flarenetwork/flare-periphery-contracts` dependency is required to build or test — `QpayOracle` and `QpayGateway` take the FTSOv2 / AssetManager addresses as constructor/setter arguments instead of resolving them via `ContractRegistry` inline, so the same bytecode works against a mock in tests and a real Flare address in deployment.

### 1.2 Compile and test

```bash
npx hardhat compile
npx hardhat test              # Solidity .t.sol unit tests + TypeScript integration tests
npx hardhat test solidity     # ConversionMath decimal-vector tests only
npx hardhat test mocha        # QpayLedger / QpayGateway integration tests only
```

Expect 12 passing tests: 3 Solidity (`ConversionMath` decimal pairs — 6→6, 6→18, 18→6) and 9 Mocha (instant same-asset payment, cross-asset conversion payment, insufficient-balance revert, gasless `payWithAuth` + replay rejection, solvency invariant, lot-granular redemption, below-one-lot revert, partial-fill refund).

### 1.3 Environment — private keys via `hardhat-keystore`

Hardhat 3's `configVariable()` (already wired in `hardhat.config.ts`) reads secrets from its encrypted keystore, not a plaintext `.env`. Set them once per machine:

```bash
npx hardhat keystore set COSTON2_PRIVATE_KEY
npx hardhat keystore set FLARE_PRIVATE_KEY     # only needed for a mainnet deploy
```

Each prompts for the value interactively and stores it encrypted — nothing is written to a file you could accidentally commit. If you'd rather use plain environment variables during CI, `configVariable` also reads from `process.env` when the keystore has no entry for that name — export `COSTON2_PRIVATE_KEY=0x...` in that case, and treat it with the same care as any funded key (never commit it, never put it in `contract/.env` without confirming `.gitignore` covers it — it already does, see the repo's root `.gitignore`).

### 1.4 Get Coston2 test funds

1. Claim from the faucet: **https://faucet.flare.network/coston2** — 100 C2FLR + 10 USDT0 + 10 FXRP per address, every 24h. Claim for every address you'll use in a demo; the cooldown means "claim early."
2. Confirm the funds landed by checking the address on **https://coston2-explorer.flare.network**.

### 1.5 Verified network config (already in `hardhat.config.ts`)

| | Coston2 (dev) | Flare mainnet (prod) |
|---|---|---|
| Chain ID | 114 | 14 |
| RPC | `https://coston2-api.flare.network/ext/C/rpc` | `https://flare-api.flare.network/ext/C/rpc` |
| Explorer | `https://coston2-explorer.flare.network` | `https://flare-explorer.flare.network` |

### 1.6 Deploy

The Ignition module (`ignition/modules/Qpay.ts`) deploys `QpayOracle`, `QpaySwap`, `QpayLedger`, `QpayGateway` and wires them together. It needs three live addresses passed as parameters — **read these from the Flare contract registry at deploy time, never hardcode them**, since they can change (`implementation.md` §0):

| Parameter | What it is | Coston2 address (verify before relying on it) |
|---|---|---|
| `fxrp` | FXRP ERC-20 | `0x0b6a3645c240605887a5532109323a3e12273dc7` |
| `ftso` | `FtsoV2` | `0xc4e9c78ea53db782e28f28fdf80baf59336b304d` |
| `assetManager` | `AssetManagerFXRP` | `0xc1ca88b937d0b528842f95d5731ffb586f4fbdfa` |

Create a parameters file (don't commit real mainnet values without checking they're current):

```bash
cat > ignition/parameters/coston2.json <<'EOF'
{
  "QpayModule": {
    "fxrp": "0x0b6a3645c240605887a5532109323a3e12273dc7",
    "ftso": "0xc4e9c78ea53db782e28f28fdf80baf59336b304d",
    "assetManager": "0xc1ca88b937d0b528842f95d5731ffb586f4fbdfa"
  }
}
EOF

npx hardhat ignition deploy ignition/modules/Qpay.ts \
  --network coston2 \
  --parameters ignition/parameters/coston2.json
```

For a mainnet deploy, swap in the mainnet addresses (`implementation.md` §0 table) and run with `--network flare`. **Before a mainnet deploy**, re-read `getSettings()` live against the deployed `AssetManagerFXRP` — mainnet fee/lot-size parameters differ materially from Coston2 and must never be assumed equal.

After deploying, two configuration calls are not yet wired into the Ignition module because they depend on values only known post-deploy or by policy decision — run them once manually:

```bash
# Configure QpaySwap's FTSOv2 feed IDs for each asset you support (implementation.md §2):
npx hardhat console --network coston2
> const swap = await ethers.getContractAt("QpaySwap", "<deployed QpaySwap address>")
> await swap.configureAsset("<FXRP address>", "0x015852502f55534400000000000000000000000000", 6)
> await swap.configureAsset("<USDT0 address>", "0x01555344542f555344000000000000000000000000", 6)
> await swap.configureAsset("<WFLR address>", "0x01464c522f55534400000000000000000000000000", 18)

# Set the ledger's relayer once you have a funded gasless-relay wallet (§1.7):
> const ledger = await ethers.getContractAt("QpayLedger", "<deployed QpayLedger address>")
> await ledger.setRelayer("<relayer address>")
```

### 1.7 The gasless relayer (for `payWithAuth`)

`QpayLedger.payWithAuth` requires `msg.sender == relayer`. Stand up a small backend service (or a throwaway EOA for a demo) that:
1. Holds C2FLR to pay gas.
2. Receives signed `PaymentAuth` EIP-712 payloads from the mobile app.
3. Calls `payWithAuth` on their behalf.

Fund and monitor this wallet before any demo — a relayer with zero C2FLR silently breaks every gasless payment (`contractPlan.md` §5 checklist).

### 1.8 Pre-demo checklist

Full checklist in [docs/contractPlan.md](docs/contractPlan.md) §5. The essentials:
- [ ] Faucet claimed for every demo address, within the last 24h
- [ ] `getSettings()` on `AssetManagerFXRP` read live, not assumed from this doc
- [ ] Relayer wallet funded with C2FLR
- [ ] Every demo transaction linked to the Coston2 explorer

---

## 2. Mobile app — `mobile/Qpay/`

**The app is fully working today, with no deployed contracts.** Every feature — payments, contacts, QR scanning, redemption, history — runs against a persistent local data layer (`src/services/`, AsyncStorage-backed). That is deliberate: the contracts are written but not deployed, so the whole product is demoable now, and going live later touches only the service layer. See §2.4.

### 2.1 Install

```bash
cd mobile/Qpay
npm install
```

Installs React Native 0.86, React Navigation (native-stack + bottom-tabs), `react-native-screens`, `react-native-gesture-handler`, `@react-native-async-storage/async-storage`, `react-native-svg`, `react-native-qrcode-svg` (QR generation), and `react-native-camera-kit` (QR scanning).

> **Why camera-kit and not vision-camera:** `react-native-vision-camera` 5.x has **no Android implementation** of its QR/barcode output — `HybridCameraFactory.kt` throws `"CameraObjectOutput is not available on Android!"`. `react-native-camera-kit` v18 implements `scanBarcode`/`onReadCode` natively on both platforms and ships New Architecture support, which RN 0.86 requires. Don't swap it back.

Camera permissions are already configured: `CAMERA` + camera `uses-feature` in `android/app/src/main/AndroidManifest.xml`, and `NSCameraUsageDescription` in `ios/Qpay/Info.plist`.

**iOS only** — install CocoaPods dependencies once, and again after any native dependency change:

```bash
bundle install
cd ios && bundle exec pod install && cd ..
```

### 2.2 Run

```bash
npx react-native start          # Metro bundler, keep running in its own terminal
npx react-native run-ios        # or: npx react-native run-android
```

The app boots into onboarding → wallet login → primary-chain picker → the tabbed dashboard (`src/navigation/RootNavigator.tsx`).

**QR scanning needs a real device or an emulator with a virtual camera.** On an emulator with no camera the scanner degrades to a "camera unavailable" panel plus manual Qpay-ID entry rather than crashing — that fallback is always available, so a permission denial never dead-ends the flow.

### 2.2a Troubleshooting: `Unable to resolve module ...` after installing a dependency

If Metro fails with something like:

```
Error: Unable to resolve module ./generated/decode-data-xml.js
from node_modules/entities/lib/esm/decode.js
```

…and the file **does** exist on disk, it's a **stale Metro cache**, not a broken package. Metro caches a module map of `node_modules`; if a package is installed while Metro is running (or after it cached), Metro keeps resolving against the old filesystem snapshot.

Fix — restart Metro with a cache reset:

```bash
npx react-native start --reset-cache
```

Verify without a device by bundling directly:

```bash
npx react-native bundle --platform android --dev false \
  --entry-file index.js --bundle-output /tmp/test.bundle --reset-cache
```

**Always `--reset-cache` after installing or removing a native dependency.** Deleting `node_modules` is not necessary and usually isn't the problem.

### 2.3 Verify

```bash
npx tsc --noEmit     # typecheck — expect zero errors
npx eslint src App.tsx
npx jest             # 25 tests: conversion math, lot-granular redemption,
                     # insufficient-balance rejection, URI round-trip, app render
```

### 2.3a Architecture

| Path | What lives there |
|---|---|
| `src/theme/` | Design tokens + `useTheme()`. **Pure black/white, `radius = 0`, no accent color** — enforced here, not per-screen |
| `src/component/ui/` | 21 components (Button, Card, KeypadNumeric, Sheet, SegmentedControl, SearchBar, …) |
| `src/component/icons/` | 34-glyph monochrome SVG icon set, square-terminal geometry |
| `src/component/qr/` | QR generation (always literal black-on-white so it stays scannable in dark mode) |
| `src/services/` | The mock-but-persistent data layer + typed errors + pricing |
| `src/context/`, `src/hooks/` | `QpayProvider` + `useProfile`/`useBalances`/`useTransactions`/`useContacts`/`usePay` |
| `src/screens/` | 14 screens |
| `assets/brand/` | Source SVGs for the Q monogram + regeneration script |

Design rules are auditable, not just aspirational:

```bash
grep -rnE "borderRadius:\s*[^0r]" src/ | grep -v "borderRadius: radius"   # must be empty
grep -rnE "#[0-9a-fA-F]{3,6}" src/ | grep -v theme.ts | grep -v component/qr/   # must be empty
```

### 2.4 Connecting to a live `QpayLedger` deployment (do this AFTER §1.6)

No screen or hook touches the chain — everything goes through `src/services/qpayService.ts`. That file is the only seam you need to change. Each function is commented with the contract call it stands in for:

| Service function | Becomes |
|---|---|
| `pay()` | `QpayLedger.pay` / `payWithAuth` (EIP-712 gasless path) |
| `redeemFxrp()` | `QpayGateway.withdrawToXRPL` |
| `getBalance()` / `getChainBalances()` | `QpayLedger.balances(user, asset)` |
| `setPrimaryAsset()` | `QpayLedger.setPrimaryAsset` |
| `quoteConversion()` | `QpaySwap.convert` priced off FTSOv2 |
| `getContacts()` / `getBusinesses()` / `getProfile()` | **stay local** — no on-chain analogue |

Steps:
1. Add a signer/RPC library (`ethers` + WalletConnect, or an embedded-wallet SDK per the create/connect split in `WalletLoginScreen`).
2. Swap the internals of the functions above to real calls, keeping the exported signatures identical.
3. Put deployed addresses + RPC URL in a new `src/config/network.ts` so switching Coston2 ↔ mainnet is a one-file change.

Two things to keep when you do this:
- **The mock enforces real constraints** — 10-FXRP lot granularity, sub-lot remainders staying spendable, partial fills, and typed `InsufficientBalanceError`/`BelowLotSizeError`. The UI already handles all of those honestly. Don't drop them when swapping in real calls.
- `SettingsScreen` currently states plainly that balances are local demo data. **Update that copy when you go live** so it never overstates what's real.

---

## 3. Repo-wide environment variable summary

| Variable | Where | Purpose | Set via |
|---|---|---|---|
| `COSTON2_PRIVATE_KEY` | `contract/` | Deploys/signs on Coston2 | `npx hardhat keystore set COSTON2_PRIVATE_KEY` |
| `FLARE_PRIVATE_KEY` | `contract/` | Deploys/signs on Flare mainnet | `npx hardhat keystore set FLARE_PRIVATE_KEY` |
| `SEPOLIA_RPC_URL` / `SEPOLIA_PRIVATE_KEY` | `contract/` | Only relevant if you keep the sample Sepolia network in `hardhat.config.ts` | `npx hardhat keystore set <name>` |

No mobile-side environment variables exist yet — §2.4 introduces the one config point (contract addresses + RPC URL) once real chain integration is wired up. Never commit a private key in plaintext anywhere in this repo; the root `.gitignore` already excludes `.env*`, `*.key`, and `*.keystore` — keep it that way.
