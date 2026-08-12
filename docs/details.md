# plan.md — Cross-Chain Payment Layer ("UPI for chains")

> **⚠ SUPERSEDED.** This is an earlier, generic-multi-EVM-chain draft (working title "OmniPay") that predates Qpay's current direction. It has no XRP/FXRP/FAssets dependency — the current design in [plan.md](plan.md) and [implementation.md](implementation.md) makes FAssets/FXRP the load-bearing, non-optional core of the product (see `plan.md` §6), which this document does not. Kept for historical reference only; do not build against it. The only parts of this doc still in active use are two threat-model/architecture patterns (non-custodial dual-authorization, "DB is a read replica") which `plan.md` already restates directly in its own §4.2 and §7.

> Working title: **OmniPay** (placeholder — rename before public repo)
> Status: Design draft v0.1 — **superseded**
> Owner: Abishek Raj

---

## 1. One-line thesis

Merchants publish a single payment identity (a link, a QR, or an embedded widget). Customers pay from **whatever chain and wallet they already hold funds on**. Funds settle **where they land**. Bridging is decoupled from payment and executed later as a **batched, route-optimised treasury operation** chosen by the merchant.

The product bet: **payment latency and settlement latency are different problems and should not share a transaction.**

---

## 2. Why the "bridge later" idea actually works

This needs to be stated precisely, because the naive version ("wait for gas to be cheap") is weak and won't survive a technical review.

Bridge cost for a transfer of value `V` is roughly:

```
cost(V) = fixed_cost + variable_cost(V)

fixed_cost    ≈ source gas + destination gas (relayer fill/mint) + attestation overhead
variable_cost ≈ liquidity/LP fee, typically 0–15 bps of V
```

`fixed_cost` is **independent of V**. It's typically $0.30–$3 depending on the destination chain. That is the entire problem:

| Payment size | Bridge-per-payment cost | Effective fee |
|---|---|---|
| $5 | ~$1.20 | **24%** — product is dead |
| $50 | ~$1.20 | 2.4% — worse than Stripe |
| $2,000 | ~$1.20 | 0.06% — fine |

So per-payment bridging destroys exactly the segment we want (small merchant transactions, the GPay-like use case).

**Three levers, in descending order of real value:**

1. **Batching (strongest).** 40 payments of $25 sitting on Base, consolidated in one bridge, amortise `fixed_cost` across the whole batch. Effective fee drops from 4.8% to ~0.12%. This is the actual product, and it works deterministically. Everything else is a bonus.
2. **Netting (very strong when applicable).** If the merchant also *spends* on the chain where funds landed — paying suppliers, topping up a card, paying gas — the bridge is skipped entirely. Zero cost. Over time this becomes the highest-margin path.
3. **Route/timing arbitrage (weakest — do not oversell).** Across relayer fees fluctuate with capital availability; CCTP is near-flat. Waiting for a cheap window saves maybe 5–20 bps. Real, but small, and it carries FX exposure while you wait. Ship it as an optimisation in Phase 3, never as the headline.

**Corollary that shapes the whole design:** because funds sit idle between receipt and settlement, **the default asset must be a stablecoin.** Holding volatile assets for days while waiting for a cheap route means the merchant might save 20 bps on the bridge and lose 8% to price movement. Non-stable payments must be swapped to stable at receipt, atomically, or explicitly opted into by the merchant.

---

## 3. Goals and non-goals

### Goals
- Customer pays in **≤3 taps**, from any supported chain, without learning what a bridge is.
- Merchant integrates with **one link or ~10 lines of JS**.
- Merchant retains custody at all times. We never hold merchant keys.
- Payment confirmation is **sub-15s perceived** on L2s.
- Deferred settlement engine reduces effective bridge cost by >10x vs per-payment bridging.
- Full accounting ledger — every payment traceable from tx hash to settled balance.

### Non-goals (v1)
- Fiat on/off ramps. Partner integration only (Transak/Onramper), not built in-house.
- Custodial balances. Explicitly out of scope — see §12 on why.
- Non-EVM chains (Solana, Bitcoin, Sui). Architecture should not *preclude* them; v1 will not include them.
- Refunds beyond a manual merchant-initiated flow.
- Recurring/subscription payments.
- Our own bridge. We are an aggregator, permanently.

---

## 4. Core user flows

### 4.1 Merchant onboarding
1. Connect wallet (this address becomes the **settlement owner**).
2. Choose preferred settlement chain + asset (default: USDC on Base or Arbitrum).
3. Choose accepted chains (default: all supported).
4. Receive: a payment link, a QR, an API key, a widget snippet.

No smart contract is deployed at onboarding. Vaults deploy lazily — see §7.

### 4.2 Customer payment
1. Opens link / scans QR / clicks widget button.
2. Sees amount in fiat (e.g. ₹499) with the crypto equivalent.
3. Connects wallet → **we auto-detect which chains they hold balance on** and pre-select the cheapest viable one.
4. One `transfer` (or `permit` + pull). No bridge. No approval dance if the token supports EIP-2612.
5. Confirmation screen when the required confirmation depth is reached.

The critical UX property: **the customer never chooses a chain from a dropdown.** We infer it from their balances and only show the choice if there's ambiguity.

### 4.3 Merchant settlement
1. Dashboard shows balances grouped by chain: "You have $1,240 on Base, $310 on Arbitrum, $88 on Polygon."
2. Settlement engine surfaces a recommendation: *"Consolidate $1,550 → Base. Est. cost $1.80 (0.12%). Bridging now vs. per-payment would have cost $47."*
3. Merchant hits Settle. Or enables **auto-settle rules** — trigger when balance > X, or every Friday, or when estimated cost < Y bps.
4. Funds arrive on the preferred chain. Ledger updated.

---

## 5. The hard design decisions

These are the decisions that determine whether this works. Each one has a chosen answer and a rejected alternative.

### 5.1 How do we know which invoice a payment belongs to?

This is the single most under-appreciated problem in crypto checkout. An ERC-20 `transfer` carries no memo field.

**Options:**

| Approach | Verdict |
|---|---|
| Shared merchant address + off-chain amount matching | ✗ Breaks on identical amounts, partial payments, two customers at once. Fragile. |
| Memo appended to calldata | ✗ Requires a custom wallet flow; standard wallets won't do it. Kills UX. |
| Payment routed through a contract with `pay(invoiceId)` | ~ Clean, but requires approve+call (2 txs) and won't work if the customer just sends tokens from an exchange. |
| **Unique deterministic deposit address per invoice (CREATE2)** | ✓ **Chosen.** |

**Chosen:** every invoice gets a unique address on every accepted chain, derived deterministically via CREATE2 from `(merchantId, invoiceId)`. Nothing is deployed until sweep time. A plain `transfer` to that address is unambiguous — the address *is* the invoice ID. Works from any wallet, any exchange, any custody solution.

Cost: one deploy+sweep tx per invoice at consolidation time. On L2s this is cents, and it batches. This is how Coinbase Commerce and most serious PSPs actually do it, and the design converges here for good reason.

### 5.2 Custodial or non-custodial?

**Chosen: non-custodial, enforced at the contract level.**

Each merchant's vault contract has exactly one privileged owner — the merchant's address (or their Safe). Our backend can call `sweep()` and `bridge(route)` but **only to destinations the merchant has pre-registered on-chain.** We can move funds along a path; we can never move them to ourselves.

This is not a philosophical stance. It's the difference between "software company" and "unlicensed money transmitter." See §12.

Implementation: role-separated access control.
- `OWNER` (merchant): withdraw anywhere, set allowlist, revoke operator.
- `OPERATOR` (our backend): sweep to vault, execute bridge to allowlisted destination only.
- Owner can revoke the operator at any time in one tx. Ship this button prominently — it's a trust feature, not a liability.

### 5.3 What happens when the customer pays the wrong amount?

Non-negotiable to handle; every real system hits it.

- **Underpayment < 2%:** accept, mark `paid`, absorb. Cheaper than the support ticket.
- **Underpayment ≥ 2%:** mark `underpaid`, show the customer a "top up $X" screen against the same address. Merchant can force-accept from the dashboard.
- **Overpayment:** accept, mark `paid`, credit the surplus to a merchant-visible balance. Do not auto-refund — the refund gas can exceed the surplus.
- **Late payment (after quote expiry):** funds are still detected and credited at the *current* rate, marked `late`. Never silently swallow a payment. This is the #1 way crypto checkouts lose user trust.

### 5.4 Price quoting and FX risk

- Quote locked for **10 minutes**, sourced from Chainlink where available, Pyth as fallback, CEX mid-price as a sanity bound. Reject quotes if sources disagree by >1%.
- If the customer pays a **stablecoin**, the FX risk window is ~zero. Encourage this path.
- If the customer pays a **volatile asset** (ETH, native gas tokens), we take the risk during the 10-min window. Mitigation: 30–50 bps spread on volatile-asset payments, and swap to stable at sweep time.
- Merchant-side risk while funds sit pre-settlement is eliminated by the stablecoin-default rule in §2.

### 5.5 When is a payment "confirmed"?

Per-chain confirmation depth, configurable, defaults:

| Chain | Confirmations | Rationale |
|---|---|---|
| Base / Arbitrum / Optimism | 1–2 blocks (soft) | Sequencer-level trust; ~2–4s. Accept optimistically for < $500. |
| Polygon PoS | 30–50 | Reorg history. |
| Ethereum L1 | 2 blocks, finality for > $10k | Slow but safe. |
| BNB / Avalanche | 15 / 1 | Fast finality on Avax. |

**Two-tier confirmation:** show the customer "Payment received ✓" at soft confirmation (good UX), mark the merchant ledger `confirmed` only at hard depth. If a reorg orphans it, the merchant balance is corrected and the merchant is notified. Never let a soft confirmation trigger irreversible fulfilment for high-value orders — expose `confirmation_level` in the webhook so the merchant decides.

### 5.6 Which bridges?

Aggregate, never build. Route selection at settlement time across:

- **Circle CCTP** — USDC native burn/mint. No liquidity fee, no slippage, canonical USDC on the far side. **Default for USDC.** Slower (~15 min) but we're settling asynchronously, so slowness is free. This is a perfect fit for the deferred model and should be the workhorse.
- **Across** — fast, intent-based, good for non-USDC and when speed is needed.
- **LI.FI / Socket** — meta-aggregator fallback for long-tail routes and swap+bridge combos.

Abstract behind a `BridgeAdapter` interface from day one. Bridges get hacked, deprecated, and re-priced constantly; hard-coupling to one is how this project dies.

Route scoring: `score = fee + (risk_weight × TVL_risk) + (time_penalty × latency)`. Time penalty is near-zero in deferred mode — that's the structural advantage.

### 5.7 Who pays gas for the customer?

If a customer holds USDC on Arbitrum but zero ETH, they are stuck. This is a real, frequent, conversion-killing failure.

- **Primary:** EIP-2612 `permit` + relayer. Customer signs, we submit, fee deducted from the transferred amount. Covers most modern stablecoins.
- **Fallback:** ERC-4337 paymaster sponsoring the transfer, cost recovered from the payment.
- **Detect and warn early:** if the wallet has token balance but insufficient gas, surface the gasless path *before* they attempt a transaction, not after it fails.

---

## 6. System architecture

```
                       ┌──────────────────────────┐
   Customer  ──────────►  Checkout (Next.js)      │
                       │  widget / hosted link    │
                       └───────────┬──────────────┘
                                   │
                       ┌───────────▼──────────────┐
                       │   API (Next.js / Nest)   │
                       │  invoices, quotes,       │
                       │  webhooks, auth          │
                       └───┬──────────────┬───────┘
                           │              │
             ┌─────────────▼───┐   ┌──────▼──────────────┐
             │  Postgres       │   │  Redis + BullMQ     │
             │  ledger, state  │   │  job queues         │
             └─────────────▲───┘   └──────┬──────────────┘
                           │              │
        ┌──────────────────┴──┐  ┌────────▼────────────┐  ┌──────────────────┐
        │  Indexer            │  │ Settlement Engine   │  │ Webhook Dispatch │
        │  Ponder / Envio     │  │ batch + route + exec│  │ retries, HMAC    │
        │  + Alchemy webhooks │  └────────┬────────────┘  └──────────────────┘
        └──────────┬──────────┘           │
                   │                      │
        ┌──────────▼──────────────────────▼──────────────┐
        │  Chains: Base, Arbitrum, Optimism, Polygon,     │
        │  Ethereum, BNB  —  Vault + Deposit contracts    │
        └────────────────────────────────────────────────┘
```

### Services

| Service | Responsibility | Notes |
|---|---|---|
| **Checkout app** | Payment UI, wallet connect, balance detection | Next.js + wagmi/viem + Reown AppKit |
| **API** | Invoices, quotes, merchant config, webhooks | REST + idempotency keys |
| **Indexer** | Watch deposit addresses across N chains, emit `PaymentDetected` | Ponder (self-host) primary; Alchemy/QuickNode webhooks as a redundant second source |
| **Settlement engine** | Batch selection, route quoting, bridge execution, retry/recovery | The interesting service |
| **Webhook dispatcher** | Signed, retried, ordered merchant callbacks | HMAC-SHA256, exponential backoff, DLQ |
| **Reconciler** | Cron job: on-chain balances vs. ledger. Alert on any drift | Non-optional. Ship in Phase 1. |

**Redundant detection is a hard requirement.** A missed payment is an unrecoverable trust failure. Run the self-hosted indexer *and* a provider webhook, dedupe on `(chainId, txHash, logIndex)`. If they ever disagree, page someone.

---

## 7. Smart contracts

Keep the on-chain surface minimal. Every line of Solidity is a liability.

### 7.1 `DepositAddress` (per invoice, CREATE2)
Minimal clone. Deployed lazily — often never, since funds can be swept via a `CREATE2` deploy-and-sweep in a single transaction.

```solidity
// Deployed only at sweep time. Single purpose: forward everything to the vault.
contract DepositAddress {
    function sweep(address token, address vault) external {
        // pull full balance, forward, optionally selfdestruct-equivalent
    }
}
```

### 7.2 `MerchantVault` (one per merchant per chain)

```solidity
contract MerchantVault {
    address public owner;              // merchant — full control
    address public operator;           // our backend — constrained
    mapping(address => bool) public allowedDestinations;

    function withdraw(address token, address to, uint256 amt) external onlyOwner;
    function setOperator(address op) external onlyOwner;
    function revokeOperator() external onlyOwner;          // prominent in UI
    function allowDestination(address dest) external onlyOwner;

    function sweepDeposits(address[] calldata deposits, address token)
        external onlyOperatorOrOwner;

    function executeBridge(BridgeCall calldata call)
        external onlyOperatorOrOwner
        // MUST revert unless call.recipient is in allowedDestinations
}
```

### 7.3 `VaultFactory`
CREATE2 deployment so a merchant's vault address is **identical across every EVM chain**. Big UX win — one address to remember, one to display, one to verify.

### 7.4 Security requirements
- No upgradeability in v1. Immutable contracts, new versions by migration. Upgradeable proxies are a rug vector and reviewers will flag them.
- Reentrancy guards on every value-moving path.
- Handle fee-on-transfer and rebasing tokens — or explicitly allowlist tokens and reject everything else. **Allowlist is the right v1 answer.**
- Bridge adapter calls go through a strict allowlist of target contracts + function selectors. Never an arbitrary `call`.
- Audit before mainnet. Before that: Slither + Echidna/Foundry invariant tests in CI.

**Key invariant to fuzz:** `operator can never cause funds to reach an address not in allowedDestinations`.

---

## 8. Data model

```sql
merchants        (id, owner_address, settlement_chain_id, settlement_token,
                  vault_address, auto_settle_rules jsonb, created_at)

invoices         (id, merchant_id, fiat_amount, fiat_currency, crypto_amount,
                  quote_rate, quote_expires_at, status, metadata jsonb,
                  created_at)
                 -- status: pending | detected | confirmed | underpaid
                 --       | overpaid | expired | late | failed

deposit_addrs    (id, invoice_id, chain_id, address, salt, swept_at)
                 UNIQUE (chain_id, address)

payments         (id, invoice_id, chain_id, tx_hash, log_index, token,
                  amount, from_address, block_number, confirmations,
                  status, detected_at, confirmed_at)
                 UNIQUE (chain_id, tx_hash, log_index)   -- idempotency anchor

balances         (merchant_id, chain_id, token, available, pending_settlement)

settlements      (id, merchant_id, from_chain, to_chain, token, amount,
                  bridge_provider, route jsonb, quoted_fee, actual_fee,
                  src_tx, dst_tx, status, batch_size, created_at)
                 -- status: quoted | submitted | in_flight | completed
                 --       | failed | stuck

ledger_entries   (id, merchant_id, type, chain_id, token, delta,
                  ref_type, ref_id, created_at)
                 -- append-only, double-entry. Source of truth for balances.
```

**`ledger_entries` is append-only and authoritative.** `balances` is a materialised projection, rebuildable from scratch. When on-chain reality and the ledger disagree, the reconciler wins and writes a correcting entry — it never mutates history. This is the difference between a demo and something a merchant would trust with revenue.

---

## 9. Payment state machine

```
   created ──► pending ──► detected ──► confirmed ──► settled
                  │            │            │
                  │            │            └──► reorged ──► detected
                  │            │
                  │            ├──► underpaid ──► (top-up) ──► confirmed
                  │            └──► overpaid  ──► confirmed (+ surplus credit)
                  │
                  └──► expired ──► late (funds arrive post-expiry; re-quote)
```

Every transition writes a ledger entry. Every transition emits a webhook. No transition is ever skipped, including the unhappy ones — merchants integrating against this need `late` and `reorged` to be first-class, not surprises.

---

## 10. Settlement engine

The differentiating service. Runs as a scheduled worker per merchant.

```ts
interface SettlementDecision {
  shouldSettle: boolean;
  batches: Batch[];          // grouped by (srcChain, token)
  estimatedCostBps: number;
  savingsVsPerPayment: number;   // the number shown in the UI
  reason: string;
}
```

**Trigger conditions (any of):**
- Aggregate balance on a chain exceeds `min_batch_value` (default $200 — below this the fixed cost is >0.6%).
- Merchant-configured schedule (weekly, monthly).
- Estimated route cost drops below merchant's `max_fee_bps`.
- Manual trigger.
- **Risk cap:** balance sitting idle exceeds `max_idle_value` (default $10k). Force settlement regardless of cost. Idle capital in a smart contract is a security exposure, not just an opportunity cost. This cap is a safety feature — do not make it optional.

**Execution:**
1. Quote all viable routes in parallel; score them.
2. Deploy-and-sweep deposit addresses into the vault (batched, single multicall).
3. Execute bridge via adapter.
4. Poll for destination fill. **Bridges get stuck** — CCTP attestation delays, Across relayer gaps. Timeout → `stuck` status → alert + manual recovery runbook. Design for this on day one; it will happen in week one.
5. Record `actual_fee` vs `quoted_fee`. Track the delta — it's how you find out a bridge adapter is silently degrading.

**Show the savings number in the UI.** "You saved $47 this month by batching" is the entire pitch, made concrete. It should be computed from real ledger data, never estimated.

---

## 11. API surface (v1)

```
POST   /v1/invoices                 create invoice, returns deposit addrs + hosted URL
GET    /v1/invoices/:id             status
POST   /v1/invoices/:id/cancel
GET    /v1/balances                 per chain, per token
POST   /v1/settlements              trigger settlement (optionally scoped)
GET    /v1/settlements/:id
PUT    /v1/merchant/settings        preferred chain, auto-settle rules
POST   /v1/webhooks/test
```

- `Idempotency-Key` header required on all POSTs.
- Webhooks: `payment.detected`, `payment.confirmed`, `payment.underpaid`, `payment.reorged`, `settlement.completed`, `settlement.failed`.
- HMAC-SHA256 signature + timestamp in header. Document replay-window verification in the integration guide.

**Deliberately Stripe-shaped.** Every backend dev already knows this API. Familiarity is a feature.

### Widget

```html
<script src="https://cdn.omnipay.dev/v1.js"></script>
<button
  data-omnipay
  data-amount="499"
  data-currency="INR"
  data-merchant="mch_abc123">
  Pay with crypto
</button>
```

Iframe-isolated. No merchant page access to wallet state. Must handle mobile deep-linking to wallet apps — this is where most crypto checkouts break, and it deserves dedicated testing on real devices, not just desktop browser extensions.

---

## 12. Compliance and legal posture

Not optional, and worth writing down properly because it constrains the architecture.

- **Non-custodial by construction.** Funds move merchant-address → merchant-owned vault → merchant-controlled destination. We are never a link in the chain of custody. This is the single most important architectural constraint and it is why §5.2 is decided the way it is.
- Do not touch fiat. Ramps are partner-provided, clearly branded as third-party.
- Screen deposit addresses against sanctions lists (Chainalysis/TRM free tiers exist for early stage). Flag, don't silently freeze — you can't freeze non-custodial funds anyway, which is the point.
- Merchant ToS: we provide software; merchants are responsible for their own tax and regulatory obligations.
- India-specific: 30% VDA tax + 1% TDS materially affects Indian merchants. Provide clean exportable transaction reports with cost-basis data. **This is a genuine feature moat for the Indian market** — nobody does it well, and it turns a compliance chore into a reason to choose you.
- Get actual legal advice before taking real merchant volume. Nothing in this document is legal advice.

---

## 13. Threat model

| Threat | Mitigation |
|---|---|
| Operator key compromise | On-chain destination allowlist; operator cannot exfiltrate. Merchant revoke button. |
| Bridge protocol exploit | Per-route TVL/age scoring; cap exposure per bridge per settlement; adapter kill-switch. |
| Reorg after fulfilment | Two-tier confirmation; `confirmation_level` in webhooks; reorg webhook event. |
| Deposit address collision | CREATE2 salt = `keccak(merchantId, invoiceId, nonce)`; DB uniqueness constraint. |
| Price oracle manipulation | Multi-source with divergence rejection; quote expiry. |
| Widget XSS on merchant site | Iframe isolation; strict CSP; no wallet state exposed to parent. |
| Missed payment (indexer down) | Redundant detection sources + reconciler cron + alerting. |
| Malicious token (fee-on-transfer, rebasing) | Strict token allowlist in v1. |
| Griefing via dust deposits | Minimum sweep threshold; dust ignored until it aggregates past gas cost. |

---

## 14. Phased roadmap

### Phase 0 — Validation (1 week)
Prove the economics before building anything. A script that:
- Pulls live bridge quotes across Base/Arbitrum/Optimism/Polygon at varying sizes.
- Plots effective fee vs. batch size.
- Produces the actual crossover point where batching wins.

**If the curve doesn't show a >10x improvement at realistic batch sizes, the core thesis is wrong and the design must change.** Do this first. It's two days and it de-risks two months.

### Phase 1 — Single-chain MVP (2 weeks)
- Invoice creation, CREATE2 deposit addresses, Base only, USDC only.
- Indexer + confirmation logic + ledger + reconciler.
- Hosted checkout page, wallet connect, payment detection.
- **Deliverable:** a payment link that works end-to-end on one chain. No bridging yet.

### Phase 2 — Multi-chain receive (2 weeks)
- Add Arbitrum, Optimism, Polygon.
- Balance-based chain auto-detection in checkout.
- Gasless payments via `permit`.
- Merchant dashboard with per-chain balances.
- **Deliverable:** pay from any of 4 chains, funds visible, no bridging yet.

### Phase 3 — Settlement engine (2 weeks)
- Vault contracts + factory, deployed and tested on testnet then mainnet.
- CCTP adapter, then Across adapter.
- Batching logic, manual settle button, savings calculation.
- Stuck-bridge detection + recovery runbook.
- **Deliverable:** the actual product.

### Phase 4 — Polish and pitch (1 week)
- Auto-settle rules.
- Widget SDK + docs site.
- Tax export (India).
- Landing page with the savings-calculator as the hero. Let visitors input their payment volume and see the number.

### Later
- Netting engine (§2 lever 2) — highest-value future work.
- Solana via Wormhole/CCTP.
- Route/timing optimisation.
- Yield on idle balances — **note the compliance implications carefully before touching this.**

---

## 15. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind | Familiar, fast, good SSR for hosted checkout |
| Wallet | wagmi + viem + Reown AppKit | Best mobile deep-link handling |
| Backend | Next.js route handlers → NestJS if it grows | Start simple |
| DB | Postgres (Neon/Supabase) | Ledger needs transactions; this is not a document-store problem |
| Queue | Redis + BullMQ | Retries, DLQ, scheduling |
| Indexer | Ponder (self-host) + Alchemy webhooks | Redundancy is mandatory |
| Contracts | Foundry, Solidity 0.8.2x | Invariant fuzzing built in |
| Bridges | CCTP, Across, LI.FI | Aggregate, never build |
| Deploy | Vercel (app) + Railway/Fly (workers) | Workers need long-running processes |
| Observability | Sentry + structured logs + a reconciliation dashboard | You will need this at 2am |

---

## 16. Success metrics

**Technical**
- Payment detection latency p95 < 8s on L2s.
- Detection reliability: 100%. Any miss is a Sev-1.
- Effective settlement cost < 20 bps at $500+ batch size.
- Ledger/chain reconciliation drift: exactly zero, checked hourly.

**Product**
- Checkout conversion (link opened → payment confirmed) > 70%.
- Merchant integration time < 30 minutes from docs to first test payment.
- Median savings per merchant per month vs. per-payment bridging — the headline number.

---

## 17. Open questions

1. **Do merchants actually want to hold multi-chain balances?** Some will find it confusing rather than flexible. Needs 5 merchant conversations before Phase 3. It's possible the right default is "auto-settle weekly, never think about it," with manual control as the power-user path.
2. **Is the deposit-address-per-invoice sweep cost acceptable at very low ticket sizes (<$5)?** Phase 0 must answer this. If not, a shared-address + `pay(invoiceId)` contract path may be needed for micro-payments specifically.
3. **What's the actual chain distribution of incoming payments?** If 90% land on Base, the multi-chain complexity is mostly wasted and the product is simpler than planned. Instrument this from day one.
4. **Refund UX.** Cross-chain refunds are genuinely hard and currently hand-waved. Needs real design before any merchant handles physical goods.
5. **Failure mode when a merchant revokes the operator mid-settlement.** Need a defined, tested recovery path.

---

## 18. What would make this a strong portfolio project

Worth stating explicitly, since that's part of the point:

- **The economic analysis in §2 is the differentiator.** Most crypto payment projects are a wallet connect and a transfer call. A quantified argument for *why* deferred batching changes the unit economics — with a Phase 0 script producing real numbers — is what separates this from a hackathon demo.
- **The ledger and reconciler are what make it look like real infrastructure.** Append-only double-entry accounting with automated chain reconciliation is unglamorous and immediately legible to anyone who has built payments.
- **Handling the unhappy paths** — reorgs, underpayment, stuck bridges, late payments — is the strongest signal of engineering maturity. Demo the failure cases, not just the happy path. Most people demoing this project will only have the happy path.
- **A recorded 90-second demo** showing a payment from three different chains landing in one dashboard, then one batched settlement with the savings number displayed, is the entire pitch.
