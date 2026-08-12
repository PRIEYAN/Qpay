# Qpay — Plan

> **A UPI/GPay-style payments app where the rails are Flare.**
> Status: Design v1.0 · Target: Flare Coston2 (chainId 114) for dev, Flare mainnet (chainId 14) for prod
> Companion doc: [implementation.md](implementation.md) — contracts, signatures, code, build order.

---

## 1. The thesis in one paragraph

Crypto payments are slow and expensive **because every payment is treated as a settlement event**. Send USDC from Arbitrum to a merchant who wants XRP and you pay a bridge, wait for a relayer, and burn $1.20 of fixed cost on a $5 coffee. Qpay separates the two: **payments are instant internal ledger moves inside a single Flare contract, and cross-chain movement only happens at the edges** — when value enters the system and when it leaves. Between those two edges, a payment is a storage write. Sub-2-second, sub-cent, final.

The thing that makes this more than a database is that the balances inside Qpay are backed 1:1 by **FAssets** — real, over-collateralized, trustlessly-minted representations of XRP and other non-smart-contract assets, native to Flare. A user's FXRP balance is not an IOU from us. It is a redeemable claim on real XRP held by collateralized agents, enforced by the FAssets AssetManager.

**So: Qpay is a payments UX layer over FAssets, with instant off-ledger-cost internal settlement and a per-user primary chain preference.**

---

## 2. The user problem, stated concretely

Three real people, three real failures today:

**Priya** holds XRP. She has held it for years. She cannot spend it on anything, because XRP Ledger has no smart contracts and no merchant ecosystem. Her options are: sell it on an exchange (taxable event, 3 days, KYC), or bridge it somewhere (custodial wrapper, trust assumption, $15 of friction).

**Arjun** runs a coffee stall. He wants to accept crypto. Every payment he receives lands on whichever chain the customer happened to use. He ends up with $4 on Base, $11 on Polygon, $7 on Arbitrum — dust that costs more to consolidate than it is worth. He gives up.

**Meera** wants to pay Arjun. She has USDT. He wants XRP. Today that is: swap, bridge, wait, pray. Four minutes and $2 of fees on a $3 chai.

**The single unifying insight:** all three problems disappear if the *asset the sender holds* and the *asset the receiver wants* are both represented on the same chain, and the conversion between them is a local swap rather than a cross-chain operation. Flare is the only chain where that is true for XRP, because FAssets brings XRP on-chain trustlessly rather than through a custodial wrapper.

---

## 3. What "primary chain" means and why it is the core UX primitive

Every Qpay user picks **one primary asset** — the thing they want to end up holding. Default is FXRP. Alternatives: USDT0, FLR, or (post-hackathon) other FAssets.

```
Meera holds USDT0.  Her primary is USDT0.
Arjun's primary is FXRP.

Meera pays Arjun ₹250.

  Qpay debits  Meera:  3.01 USDT0
  Qpay credits Arjun:  5.42 FXRP

  One transaction. One block. ~1.8 seconds.
```

Neither of them chose a chain. Neither of them saw a bridge. Meera spent what she had; Arjun received what he wants. The conversion happened inside the same transaction against an FTSOv2 price feed and a liquidity pool, both native to Flare.

**This is the product.** Everything else in this document exists to make that four-line diagram true and safe.

### Why a *primary chain* and not just a *primary asset*

The user-facing word is "chain" because that is how users think ("I want to get paid in XRP, on XRP"). Internally it is an asset preference plus a **withdrawal route**:

| User picks | Internal asset | Where "withdraw" sends it |
|---|---|---|
| XRP | FXRP | Real XRP on XRP Ledger, via FAssets redemption |
| Flare | FLR | Native FLR on Flare C-chain |
| USDT | USDT0 | ERC-20 on Flare; bridgeable off-Flare via Stargate (mainnet only) |

So the primary chain determines two independent things: **(a)** what asset incoming payments are auto-converted into, and **(b)** the default egress route when the user cashes out. That second property is what makes the word "chain" honest rather than marketing.

---

## 4. Architecture

### 4.1 The three-zone model

Everything in Qpay lives in exactly one of three zones, and the zone determines its cost and latency profile. Keeping this boundary crisp is the single most important design discipline in the project.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ZONE 1 — INGRESS (slow, cross-chain, rare)                          │
│                                                                       │
│   XRP Ledger ──payment──► FDC attestation ──proof──► FAssets mint     │
│   External EVM ──Stargate/LayerZero──► Flare ERC-20                   │
│   Card / UPI ──partner ramp──► USDT0 on Flare                         │
│                                                                       │
│   Latency: 90s – 15min.  Cost: real but amortized over many payments. │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  value crosses into Flare once
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  ZONE 2 — THE LEDGER (instant, local, constant)         ★ THE PRODUCT │
│                                                                       │
│   QpayLedger.sol on Flare — one contract, all users, all balances     │
│                                                                       │
│   pay(to, asset, amount)     →  two SSTOREs                           │
│   payWithConversion(...)     →  two SSTOREs + one pool swap           │
│                                                                       │
│   Latency: 1 block ≈ 1.8s.  Cost: ~$0.001.  Finality: immediate.      │
│   NO BRIDGE. NO RELAYER. NO ATTESTATION. NO WAITING.                  │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  value leaves Flare, on demand
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  ZONE 3 — EGRESS (slow, cross-chain, user-initiated)                 │
│                                                                       │
│   FXRP ──FAssets redemption──► real XRP on XRP Ledger                 │
│   FLR  ──direct transfer──► Flare C-chain address                     │
│   USDT0 ──Stargate──► any connected EVM                               │
│                                                                       │
│   Latency: minutes.  Cost: real, but paid once per cash-out.          │
└──────────────────────────────────────────────────────────────────────┘
```

**The economic argument.** Bridge cost is `fixed_cost + variable_cost(V)`, and `fixed_cost` (~$0.30–$3) does not shrink with the payment size. Per-payment bridging therefore makes a $5 payment cost 24% in fees — it kills exactly the segment a GPay clone needs. Qpay's answer is not "batch the bridges better." It is **stop bridging per payment entirely.** A user bridges in once, transacts fifty times for free, bridges out once. Fixed cost is amortized across the user's whole lifetime of payments rather than across a batch.

| Model | 50 payments of $5 | Effective fee |
|---|---|---|
| Bridge per payment | 50 × $1.20 = $60.00 | **240%** |
| Batch settlement (the doc/ v0.1 design) | ~1 × $1.50 = $1.50 | 0.6% |
| **Qpay zone model** | 1 ingress + 1 egress ≈ $2.00 | **0.8% once, then 0%** |

And critically: in the batch model the *merchant waits* for settlement. In the zone model nobody waits, because the received balance is already spendable — Arjun can pay his supplier with the FXRP Meera just sent him, instantly, without either of them touching zone 1 or 3.

### 4.2 System diagram

```
        ┌───────────────────────────────────────────────┐
        │  Mobile app  (React Native — mobile/Qpay)     │
        │  QR scan · contacts · balance · request money │
        └───────────────┬───────────────────────────────┘
                        │
        ┌───────────────▼───────────────────────────────┐
        │  Backend  (Node/Nest)                         │
        │  • username ↔ address directory               │
        │  • FDC attestation orchestrator               │
        │  • FAssets minting/redemption executor        │
        │  • indexer → Postgres (READ REPLICA ONLY)     │
        │  • push notifications                         │
        └───┬──────────────────────────┬────────────────┘
            │                          │
            │ reads                    │ submits proofs / relays
            ▼                          ▼
   ┌────────────────┐      ┌──────────────────────────────────────┐
   │  Postgres      │      │        FLARE  (Coston2 / mainnet)     │
   │  index, cache  │      │                                       │
   │  never         │      │  ┌────────────────────────────────┐  │
   │  authorizes    │      │  │  QpayLedger.sol       ★         │  │
   └────────────────┘      │  │  balances[user][asset]         │  │
                           │  │  primaryAsset[user]            │  │
                           │  │  pay / payWithConversion       │  │
                           │  │  EIP-712 gasless relay         │  │
                           │  └──────┬──────────┬──────────────┘  │
                           │         │          │                  │
                           │  ┌──────▼─────┐ ┌──▼───────────────┐ │
                           │  │ QpaySwap   │ │ QpayGateway      │ │
                           │  │ conversion │ │ ingress/egress   │ │
                           │  └──────┬─────┘ └──┬───────────────┘ │
                           │         │          │                  │
                           │  ┌──────▼──────────▼───────────────┐ │
                           │  │  FLARE ENSHRINED PROTOCOLS      │ │
                           │  │  FtsoV2 · FdcVerification       │ │
                           │  │  AssetManagerFXRP · FXRP ERC20  │ │
                           │  └─────────────────────────────────┘ │
                           └───────────────────────────────────────┘
                                          │
                                   ┌──────▼────────┐
                                   │  XRP Ledger   │
                                   └───────────────┘
```

**Non-negotiable rule, inherited from `merchantVault.md` §8 and kept:** *the database is a read replica, never a write authority.* No balance, no payment, no withdrawal is ever authorized by a Postgres row. Every fund movement is authorized on-chain — either by the user's own transaction or by an EIP-712 signature the contract verifies itself. If the entire backend is compromised, the attacker can degrade service. They cannot move a cent.

### 4.3 Contracts

| Contract | Job | Notes |
|---|---|---|
| **QpayLedger** | Balances, primary-asset preference, `pay`, `payWithConversion`, EIP-712 gasless relay, payment requests | The core. Everything instant lives here. |
| **QpayGateway** | Ingress and egress. Wraps FAssets minting/redemption and ERC-20 deposit/withdraw | The only contract that talks to `AssetManagerFXRP` |
| **QpaySwap** | Converts asset A → asset B during a payment | v1: single-sided pools priced by FTSOv2 with a spread. v2: route to a real DEX |
| **QpayRegistry** | `username → address`, avatars, merchant flags | Optional on-chain; a hackathon can keep this in Postgres and still be honest, since it never authorizes anything |

Deliberately **not** built: our own bridge, our own oracle, our own custody. Each of those is replaced by an enshrined Flare protocol, which is precisely the "meaningful use of Flare infrastructure" the track asks for.

---

## 5. Core workflows

### 5.1 Onboarding

```
1. Install app → embedded wallet generated (or connect external)
2. Pick a username         →  "meera"
3. Pick a PRIMARY CHAIN    →  [ XRP ] [ Flare ] [ USDT ]     ← the one real decision
4. Fund it                 →  scan XRP deposit QR, or receive from a friend
```

Step 3 is the only moment the user is asked anything chain-shaped, and it is framed as "what do you want to hold?" — not "which network?". A user who taps XRP now has: an FXRP balance, an XRPL deposit address, and every incoming payment auto-converting to FXRP.

### 5.2 Ingress — getting XRP into Qpay

This is the flow that makes Qpay a *Flare* project rather than a generic payments app. It uses **FDC** to prove an XRP Ledger payment happened, and **FAssets** to mint the corresponding FXRP.

```
Priya                Qpay backend           FDC              FAssets
  │                       │                  │                  │
  │  "deposit XRP"        │                  │                  │
  ├──────────────────────►│                  │                  │
  │  ◄── address + memo ──┤  (paymentReference identifies HER)   │
  │                       │                  │                  │
  │  sends 100 XRP on XRPL with that reference                   │
  ├───────────────────────────────────────────────────────────► │
  │                       │                  │                  │
  │                       │ prepareRequest   │                  │
  │                       ├─────────────────►│                  │
  │                       │ requestAttestation (fee)             │
  │                       ├─────────────────►│                  │
  │                       │   ~90–180s, one voting round         │
  │                       │ fetch Merkle proof from DA Layer     │
  │                       │◄─────────────────┤                  │
  │                       │                                     │
  │                       │ executeMinting(proof, reservationId) │
  │                       ├────────────────────────────────────►│
  │                       │                        FXRP minted  │
  │                       │  Gateway credits ledger[Priya][FXRP] │
  │  ◄── push: "100 XRP received" ───────────────────────────── │
```

**Two paths, and the choice matters for the demo:**

- **Path A — agent-reserved minting (canonical).** Reserve collateral with an agent first (`reserveCollateral`), pay the agent's XRPL address with the returned reference, then `executeMinting`. Full trustless flow, but requires an available agent with free collateral and a live reservation with a payment deadline (~900s on Coston2).
- **Path B — faucet-funded FXRP (hackathon shortcut).** The Coston2 faucet dispenses 10 FXRP directly. Ship this as the demo's default funding path so a judge is never blocked on agent liquidity, and expose Path A behind a "Deposit real XRP" button that works but takes minutes.

Honest framing for judges: demo Path B for reliability, *show* Path A working on-chain, and say plainly which is which. Faking Path A is the fastest way to lose a technical reviewer.

### 5.3 The instant payment — the money shot

```
Meera opens Qpay → scans Arjun's QR → types ₹250 → Face ID
                                                      │
                                                      ▼
              ONE TRANSACTION ON FLARE (~1.8 seconds)
              ┌──────────────────────────────────────────┐
              │ 1. read XRP/USD + USDT/USD from FtsoV2    │
              │ 2. debit  balances[meera][USDT0] -= 3.01  │
              │ 3. swap   3.01 USDT0 → 5.42 FXRP          │
              │ 4. credit balances[arjun][FXRP] += 5.42   │
              │ 5. emit   Paid(meera, arjun, ...)         │
              └──────────────────────────────────────────┘
                                                      │
                        Arjun's phone buzzes. Done.   ▼
```

No bridge. No relayer. No attestation. No confirmation depth to wait for, because there is no other chain involved. **This is why the payment is instant — not because we optimized a bridge, but because we removed it from the payment path entirely.**

Arjun's newly received FXRP is immediately spendable. He can pay his milk supplier in the next block. Value circulates *inside* zone 2 and may never need to leave — which is the netting effect the `details.md` draft identified as the highest-margin path, achieved structurally instead of through a batching engine.

### 5.4 Gasless payments

A user holding FXRP but zero FLR cannot pay gas. This is the single most common conversion killer in crypto UX, and it must be solved before anything else is worth demoing.

Solution: **EIP-712 meta-transactions.** Meera signs a typed `PaymentAuth` struct; the backend relayer submits it and pays FLR gas; the contract verifies the signature, executes the payment, and deducts a small fee from the transferred amount.

```
PaymentAuth {
  from, to, asset, amount, fee, nonce, deadline
}                                    // chainId in the domain separator
```

The relayer is a **convenience, not an authority**. It cannot alter `to` or `amount` — any change invalidates the signature. It cannot replay — nonces are consumed on-chain. Meera can always bypass it entirely by sending the transaction herself. This is the same dual-authorization principle from `merchantVault.md` §5, applied to payments instead of withdrawals: *the platform executes, the user authorizes, and the contract enforces that both happened.*

### 5.5 Request money & merchant QR

- **Static merchant QR** — encodes `qpay:arjun` with no amount. Customer types the amount. Never expires, printable, no per-invoice on-chain cost. This is exactly how UPI works, and it is why UPI QRs are on every stall in India.
- **Dynamic invoice QR** — encodes `qpay:arjun?amount=250&ref=INV42&exp=...`. Amount locked, reference tracked, expiry enforced. Used at a POS.

Note the deliberate departure from `details.md` §5.1: the original design used **a CREATE2 deposit address per invoice** to disambiguate payments. Inside zone 2 that entire problem vanishes — a payment is a function call with an `invoiceRef` argument, so identification is free and unambiguous. CREATE2 deposit addresses are still the right answer, but only in **zone 1**, for identifying inbound XRPL deposits. Solving a problem in the wrong zone is how the original design would have accrued unnecessary cost.

### 5.6 Egress — cashing out

```
Arjun: "Withdraw 500 FXRP to my XRPL wallet"

  QpayLedger.debit(arjun, FXRP, 500)
      │
      ▼
  QpayGateway → AssetManagerFXRP.redeem(50 lots, arjun_xrpl_address, executor)
      │                                    (Coston2 lot size = 10 XRP)
      ▼
  An agent pays 500 XRP on XRPL, then confirmRedemptionPayment with an FDC proof
      │
      ▼
  Real XRP lands in Arjun's own XRPL wallet.  Minutes, not days.
```

Redemption is where the "backed 1:1" claim gets proven rather than asserted. If the agent fails to pay within the deadline, `redemptionPaymentDefault` pays Arjun out of the agent's vault collateral at 105% — he is made whole *plus a 5% premium*, enforced on-chain. Show this in the writeup; it is the strongest available evidence that Qpay balances are not IOUs.

Two real behaviours the UI must handle honestly:
- **Lot granularity.** Redemption works in whole lots (10 XRP on Coston2). 505 FXRP redeems 500; the remaining 5 stays as a spendable balance. Say so in the UI.
- **Partial fills.** `redeem` may fill fewer lots than requested if agent tickets run out, emitting `RedemptionRequestIncomplete`. The backend must loop on the returned amount rather than assuming success.

---

## 6. Where each piece of Flare infrastructure is load-bearing

The track rewards *meaningful* use of Flare, not name-dropping. Every one of these is on the critical path — remove it and the product breaks.

| Flare primitive | Where Qpay uses it | What breaks without it |
|---|---|---|
| **FAssets / FXRP** | The primary asset. XRP becomes programmable and spendable. | The entire XRP thesis. This is the reason the project is on Flare. |
| **FDC** | Proves XRPL deposits (`Payment` / `XRPPayment`), backs redemption defaults (`ReferencedPaymentNonexistence`) | Ingress becomes custodial — we would just be trusting our own backend. |
| **FTSOv2** | Cross-asset conversion pricing at payment time, fiat display (₹250 → 5.42 FXRP) | No conversion, no fiat UX. We'd need an off-chain oracle and a trust assumption. |
| **1.8s blocks / cheap gas** | Makes zone 2 feel like a database write | The instant-payment claim. |
| **Coston2 faucet (C2FLR + FXRP + USDT0)** | Frictionless judge onboarding | Demo reliability. |

Note what is *absent*: no LayerZero, no Wormhole, no Axelar, no custom bridge in the core flow. **On Coston2 those are not available anyway** — research confirms no LayerZero/Stargate testnet deployment for Coston2. Designing around Flare's enshrined protocols is not just ideologically neater; on testnet it is the only path that actually works. Stargate on Flare mainnet stays as a *post-hackathon* egress option for USDT0, clearly labelled as future work.

---

## 7. Threat model

| Threat | Mitigation |
|---|---|
| Backend / DB compromise | DB never authorizes. Every movement needs an on-chain signature or the user's own tx. |
| Malicious relayer | EIP-712 binds `to`/`amount`/`deadline`; nonce prevents replay; chainId in domain blocks cross-chain replay. |
| FTSO price manipulation during conversion | Reject stale feeds (`timestamp` freshness check); per-tx conversion caps; slippage bound supplied by the caller. |
| Fake deposit (forged XRPL payment) | Impossible — FDC Merkle proof verified by `FdcVerification`, not by our indexer. |
| Replayed FDC proof | Consume the attested `transactionId` in a `usedProofs` mapping. Non-optional. |
| Agent default on redemption | FAssets pays the redeemer 105% from agent vault collateral. Handled by the protocol. |
| Reentrancy on pay/swap | CEI ordering + `ReentrancyGuard`; balances updated before any external call. |
| Malicious token (fee-on-transfer / rebasing) | Strict asset allowlist. v1 supports exactly FXRP, USDT0, WFLR. |
| Ledger drift vs. contract holdings | Invariant `sum(balances[*][asset]) <= contract holdings of asset`, fuzzed in CI and re-checked by an hourly reconciler. |
| User loses phone / embedded key | Social recovery + external-wallet option. Be explicit that embedded wallets mean request-integrity, not self-custody — the `merchantVault.md` §5.3 honesty rule applies verbatim. |

---

## 8. Build sequence

Ordered so that **something demoable exists after every phase**, and the highest-risk unknown (FDC/FAssets integration) is attacked before the polish.

| Phase | Scope | Demoable outcome |
|---|---|---|
| **0 — Spike (0.5d)** | Coston2 wired up. Read XRP/USD from FtsoV2. Read FXRP balance from the faucet. | "Flare works, here's a live price." |
| **1 — The Ledger (1.5d)** | `QpayLedger`: deposit, withdraw, `pay`, `setPrimaryAsset`. Full test suite + invariant fuzz. | Instant transfer between two addresses. |
| **2 — Conversion (1d)** | `QpaySwap` + FTSOv2 pricing. `payWithConversion`. | **USDT0 in → FXRP out, one tx.** The core demo. |
| **3 — Gasless (1d)** | EIP-712 `PaymentAuth` + relayer. | Pay with zero FLR in the wallet. |
| **4 — Mobile (2d)** | React Native: QR scan, balance, contacts, send, request, primary-chain picker. | The GPay experience. |
| **5 — FDC ingress (1.5d)** | Real XRPL deposit → attestation → FXRP credited. | **Real XRP crossing into Flare.** |
| **6 — FAssets egress (1d)** | `redeem` → real XRP back on XRPL. | Round trip closed. Proves 1:1 backing. |
| **7 — Polish (1d)** | Merchant mode, tx history, failure-path handling, demo script. | The 90-second video. |

Phases 5 and 6 are the ones judges will remember, but phases 1–3 are what make the app *feel* like GPay. If time is cut, cut phase 7 and hand-hold the demo — never cut 5/6, because they are the Flare-infrastructure proof.

---

## 9. Honest open questions

Stated rather than hidden, because a reviewer will find them anyway:

1. **Zone-2 liquidity.** `QpaySwap` needs FXRP and USDT0 inventory to convert against. For the hackathon it is seeded from the faucet and priced by FTSOv2 with a spread. At real volume it needs either a DEX integration or market-maker inventory. This is the biggest gap between demo and product, and it should be said out loud.
2. **Is the ledger contract a honeypot?** All user balances in one contract is a concentrated target. Mitigations: strict allowlist, no upgradeability in v1, invariant fuzzing, per-tx caps, audit before mainnet. A per-user vault design trades this risk for gas cost and worse UX — a deliberate trade, worth naming.
3. **Agent liquidity on Coston2.** Path A minting depends on an agent with free collateral. Path B (faucet) is the fallback, but the dependency is real and should be checked live before any demo.
4. **Is this a money transmitter?** Users hold spendable balances inside our contract. Non-custodial *by construction* (only the user's signature moves their funds) is the defensible position, and it is why EIP-712 authorization is load-bearing rather than a UX nicety. Not legal advice; get real advice before real volume.
5. **Regulatory reach follows custody, not code.** Inherited verbatim from `merchantVault.md` §9 and still true: for embedded wallets, we hold the signing key. That deserves a paragraph in the submission, not a hand-wave.

---

## 10. What makes this a strong submission

Mapped directly against the track's four stated criteria:

- **A working product.** Not a slide deck — a mobile app where a judge scans a QR and value moves in under two seconds.
- **A clear user problem.** Priya's XRP is unspendable; Arjun's balances are dust; Meera pays $2 to send $3. All three are real, all three are fixed by the same mechanism.
- **Meaningful use of Flare infrastructure.** FAssets is the asset layer, FDC is the trust layer, FTSOv2 is the pricing layer. Remove any one and the product stops working. That is the definition of meaningful.
- **A path beyond the hackathon.** Merchant tooling, additional FAssets as they launch, DEX-routed conversion, Stargate egress on mainnet, and the tax-export feature `details.md` §12 correctly identified as an Indian-market moat.

**The 90-second demo:** Priya sends real XRP from an XRPL wallet → it appears in Qpay as FXRP → she pays Arjun, who receives USDT0 instantly because that is his primary chain → Arjun redeems to real XRP on XRPL. One loop, all three zones, every Flare protocol visible on-chain and verifiable on the Coston2 explorer.


## 11 unique user 

<User_Display_name>#genereateCode()


    bytes constant ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    function generateCode() public view returns (string memory) {
        bytes memory code = new bytes(4);

        uint256 random = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao,
                    msg.sender
                )
            )
        );

        for (uint256 i = 0; i < 4; i++) {
            code[i] = ALPHABET[random % 36];
            random /= 36;
        }

        return string(code);
    }
