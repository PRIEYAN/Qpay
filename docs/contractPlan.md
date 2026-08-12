# Qpay Contracts — Build Plan

> Status: Draft v1.0 · Target: Flare Coston2 (chainId 114) for dev, Flare mainnet (chainId 14) for prod
> Scope: everything under `contract/` — Hardhat 3 + TypeScript + `.t.sol` tests

This is the execution plan for the on-chain layer described in `plan.md` and `implementation.md`. Those two documents are the "what and why"; this one is the "in what order, with what exit criteria" — the checklist to actually drive the `contract/` workspace to a demoable state.

## 1. Contracts to ship

| Contract | Responsibility | Depends on |
|---|---|---|
| `QpayLedger` | Core internal balance ledger. Instant off-chain-cost transfers between users. The single write authority for balances. | — |
| `QpayOracle` | Thin wrapper around FTSOv2 feed reads, isolates feed-ID plumbing from the rest of the contracts. | FTSOv2 (`FtsoV2Interface`) |
| `ConversionMath` | Pure library: decimal-safe cross-asset conversion math (e.g. USDT0 → FXRP at a given price). No state, fully unit-testable in isolation. | — |
| `QpaySwap` | `payWithConversion` — same-transaction local swap using `QpayOracle` + `ConversionMath`, so a sender holding asset A can pay a receiver who wants asset B. | `QpayLedger`, `QpayOracle`, `ConversionMath` |
| `QpayGateway` | Ingress/egress edges only: FAssets minting/redemption entry points, FDC-proof verification for XRPL deposits. | FAssets `IAssetManager`, FDC verifier/DA layer |
| EIP-712 `payWithAuth` | Gasless payment path — user signs, a relayer submits, contract enforces signature + nonce + chainId. | `QpayLedger` |
| `QpayRegistry` *(optional, can start as Postgres)* | `username → address` mapping, merchant flags. Never authorizes fund movement — read-only convenience. | — |

**Non-negotiable invariant carried over from `merchantVault.md` §8:** the database is a read replica, never a write authority. Every balance change is authorized either by the user's own transaction or by a contract-verified EIP-712 signature. A fully compromised backend must not be able to move a cent — this is the property every test in §4 below is ultimately trying to prove.

## 2. Environment already verified (from `implementation.md` §0)

- Coston2 added to `hardhat.config.ts`, live XRP/USD read confirmed, faucet FXRP balance read confirmed.
- Contract addresses for FAssets `AssetManager`, FTSOv2, FDC verifier/DA layer read live from the registry rather than hardcoded — they can change.
- FXRP decimals = `6` (Coston2) — must be asserted in a test that fails loudly if it changes, not assumed.

Nothing below should re-derive these; treat them as given inputs.

## 3. Build order

Same phase sequence as `implementation.md` §7, expanded with explicit exit tests. Each phase must end with something that can be demoed standalone — no phase should require the next one to prove it works.

| # | Phase | Est. | Deliverable | Exit test |
|---|---|---|---|---|
| 0 | Spike | 0.5d | Coston2 network config; live XRP/USD read; live faucet FXRP balance read | Script prints a live price and a nonzero balance |
| 1 | Ledger | 1.5d | `QpayLedger` + unit tests + invariant fuzz | Instant transfer A→B settles in one tx; solvency invariant (`sum(balances) == totalDeposited - totalWithdrawn`) holds under Foundry/Hardhat fuzzing |
| 2 | Conversion | 1d | `QpayOracle`, `ConversionMath`, `QpaySwap`, `payWithConversion` | USDT0 in → FXRP out in one tx; decimal-conversion test vectors pass, including the 6-decimal FXRP edge case |
| 3 | Gasless | 1d | EIP-712 `payWithAuth` + relayer service | A wallet holding 0 FLR completes a full payment; nonce replay attempt reverts; cross-chain replay attempt reverts (chainId bound in domain separator) |
| 4 | *(Mobile — tracked in `mobileAppWorkflow.md`, not this plan)* | 2d | — | — |
| 5 | FDC ingress | 1.5d | Verifier → DA layer → `verifyPayment` → credit | Real testXRP sent on XRPL appears as FXRP balance in-app, proof-verified on-chain, not backend-asserted |
| 6 | FAssets egress | 1d | `redeem` + partial-fill handling | FXRP redeemed out → real XRP lands in an XRPL wallet; partial-fill path (`RedemptionRequestIncomplete`) exercised, not just the happy path |
| 7 | Polish | 1d | Merchant mode, payment history, failure-path handling, demo script | 90-second recording covering ingress → instant payment → egress, all three zones visible on the Coston2 explorer |

Reasoning for the ordering, kept from `implementation.md`: FDC/FAssets integration is the riskiest external dependency (real cross-team infra, not mockable), so it is scheduled with slack *behind* it — phase 5 rather than last — instead of leaving no room to recover if it's harder than expected.

## 4. Test strategy

- **Solidity `.t.sol` (Foundry-style, via the `hardhat` skill's fork tooling)** for pure logic that needs no live network: `ConversionMath` decimal vectors, EIP-712 digest correctness, access-control checks (`onlyExecutor`-equivalent gates), nonce replay.
- **TypeScript integration tests against a Coston2 fork** for anything touching `FtsoV2Interface`, `FdcVerification`, or `IAssetManager`. These three are explicitly *not* meaningfully mockable — a contract that only works against a hand-rolled mock of FAssets is not evidence it works against FAssets. Use `network.create()` for the fork, documented in `contract/.claude/skills/hardhat`.
- **Invariant fuzzing** on `QpayLedger`'s solvency property is the one test that must run in CI on every change to the ledger, not just once at phase 1 — it is the load-bearing proof behind "the database can't authorize a bad balance."

## 5. Pre-demo checklist (carried from `implementation.md` §8)

- [ ] Coston2 faucet claimed for every demo address (C2FLR + FXRP + USDT0) — 24h cooldown, claim early
- [ ] `getSettings()` read live immediately before demo — Coston2 values differ from mainnet and can change between sessions
- [ ] FXRP decimals asserted as `6` in a test that fails loudly if it ever changes
- [ ] Solvency invariant fuzz passing in CI, not just locally
- [ ] `usedProofs` / nonce replay test present and passing
- [ ] Relayer wallet funded with C2FLR and monitored — a payment relayer with 0 balance silently breaks the gasless path
- [ ] FTSO staleness path exercised — a test that forces a stale timestamp and asserts a revert
- [ ] Partial-fill redemption path exercised, not just full-fill
- [ ] If demoing live FAssets minting (Path A): an agent with free collateral confirmed available beforehand. Otherwise state plainly that the demo uses the faucet path (Path B) and why.
- [ ] Every demo transaction linked to the Coston2 explorer in the writeup — this is the actual evidence, not the narration

## 6. Explicitly out of scope for this plan

- Any custom bridge, custom oracle, or custom custody layer — deliberately replaced by Flare's enshrined protocols (FAssets, FTSOv2, FDC) per `plan.md` §"Deliberately not built."
- LayerZero/Stargate/Axelar/Wormhole integration on Coston2 — no testnet deployment exists for these on Coston2; Stargate/USDT0 egress on Flare mainnet is explicitly post-hackathon future work.
- The chain-selection agent described in `agent.md` — that sits in the off-chain orchestration layer and only ever *recommends* a route; it has no dependency on contract code and is tracked separately.
