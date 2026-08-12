# Universal Merchant Vaults
### Cross-Chain Merchant Payments, Custody, and Withdrawal Architecture

*Architecture Document — v0.1 Draft*

> **⚠ SUPERSEDED.** This is an earlier, generic multi-chain merchant-vault concept (UMID, per-chain custodial vaults, Circle-wallet-based AI agent bridging) that predates Qpay's current direction and has no XRP/FXRP/FAssets dependency. The current design in [plan.md](plan.md) and [implementation.md](implementation.md) makes FAssets/FXRP the load-bearing, non-optional core of the product — remove FAssets and the product breaks, per `plan.md` §6. Kept for historical reference only; do not build the vault/UMID product described here. The parts of this doc still in active use are the threat-model patterns `plan.md` explicitly inherits and cites by section (§5 dual-authorization / EIP-712 withdrawal signatures, §8 "database is a read replica, never a write authority," §9 regulatory-reach-follows-custody framing) — those are restated directly in `plan.md` itself, so treat `plan.md` as the current source even for those inherited rules.

> **What this document is:** A working architecture spec for a multi-chain merchant payment platform — a universal merchant identity (UMID), deterministic per-chain vaults, custodial fund handling with dual-authorized withdrawals, flexible cross-chain settlement, and an AI-agent orchestration layer. Written to be reusable across hackathon submissions and grant applications, and as the reference doc for actual implementation.

---

## 1. Overview & Motivation

The core problem: merchants want to accept payments across many chains without paying full settlement cost on every single transaction, and without needing to understand cross-chain infrastructure themselves. Bridging every payment individually is expensive. The fix is to let value accumulate per-chain in merchant-linked vaults, and only bridge when it's actually needed — whether that's an urgent withdrawal or a merchant's standing preference for where their funds should end up.

On top of that settlement layer sits a single merchant identity that works the same way no matter which chain a payment arrived on. A merchant integrates once (via a widget), and the system handles routing, custody, and reconciliation across every supported chain behind that one identity.

### 1.1 Product Pillars

- **Flexible cross-chain settlement** — funds accumulate in per-chain vaults; bridging is used either as an urgent last-resort withdrawal path, or as a standard routing choice, based on merchant preference and where payments are actually landing.
- **Universal Merchant Identity (UMID)** — one identity, minted once, recognized deterministically on every supported chain without per-chain registration.
- **Merchant dashboard** — a single view across all chains and vaults, showing balances, activity, and withdrawal status.
- **AI agent orchestration** — an agent layer (using programmable wallet infra, e.g. Circle wallets) handles cross-chain routing decisions so merchants and the platform don't have to manage this manually.
- **One project, many hackathons/grants** — the architecture is deliberately modular so pieces of it (UMID registry, vault design, agent orchestration) can be submitted individually across different chain ecosystems' hackathons and grant programs.

---

## 2. High-Level Architecture

Three layers, each with a distinct job:

| Layer | Responsibility |
|---|---|
| **Identity layer** (home chain) | Mints and owns the canonical Universal Merchant Identity (UMID). Source of truth for "who controls this merchant." |
| **Vault layer** (every supported chain) | Holds merchant funds per chain. Computed deterministically from the UMID — no per-chain registration transaction needed. Executes withdrawals only under dual authorization. |
| **Orchestration layer** (off-chain + agent) | Backend, indexer, dashboard, and the AI agent that manages cross-chain routing, including both merchant-preference-based bridging and last-resort withdrawal bridging. |

A guiding rule that shapes every decision below: **the database is a read replica, never a write authority.** Anything that moves funds must be independently verifiable on-chain — if the backend or database were fully compromised, an attacker still could not move a merchant's money.

---

## 3. Universal Merchant Identity (UMID)

### 3.1 Minting

The UMID is created exactly once, on a home chain (an L2 chosen for low gas cost). It's implemented as a non-transferable ERC-721: `tokenId = UMID`, `owner = merchant's control address`. This gives a canonical, chain-native fact — "this merchant ID exists and this address controls it" — that isn't just a row in a database. The backend can generate the ID, but the mint event is what makes it real.

### 3.2 Recognition across chains — deterministic addressing

Rather than registering the merchant on every chain (N gas payments for one merchant), each chain's vault-internal accounting key is derived via `CREATE2`, using the UMID as salt. Any chain can compute where a given merchant's balance lives without a lookup — it's pure math. This also lets merchants independently verify their own vault addresses without trusting the platform's database, which is a strong, demonstrable claim for grant applications: trustless verification even though the operational UX is custodial.

### 3.3 Merchant-facing widget

Merchants integrate through a widget that hides the UMID and vault plumbing entirely — from the merchant's side it looks like "connect a wallet (embedded or external), start accepting payments." Deposits are permissive: anyone can tag a payment with a UMID, since a deposit only credits a balance and carries no risk. The enforcement that actually matters is on withdrawal, covered in Section 5.

> **Demo idea worth keeping:** A public "verify my vaults" page — paste a UMID, get back the deterministically-computed vault address on every supported chain, cross-checked live against the registry's current signer set. Cheap to build, and it's the clearest way to show that the merchant ID isn't just a database primary key wearing a costume.

---

## 4. Vault Model — Custodial, Not Self-Service

Merchants do not interact with vaults directly. They can only request a withdrawal; the platform fulfills it. This is a deliberate simplification with a real consequence for the threat model.

**What this removes:** No need for per-merchant signer mirrors synced across every chain purely for on-chain interaction rights. There's exactly one authorized executor per chain (the platform's own multisig/role) permitted to call the vault's withdraw function.

**What this changes the risk to:** The threat model shifts from "can an outsider impersonate a merchant on-chain" (now basically moot, since nobody but the platform can call withdraw) to a request-fulfillment integrity problem: can the platform prove, to itself and to merchants, that every payout actually matches a real, authorized request? That problem is solved with merchant-signed withdrawal authorization, enforced by the vault itself — not just trusted at the backend level.

---

## 5. Withdrawal Authorization — Dual Signature, Enforced On-Chain

Executor authority alone is not enough — it makes "the executor is honest" the only guarantee that a withdrawal matches a real request. Requiring a merchant signature that the vault itself verifies turns that promise into a cryptographic guarantee.

### 5.1 Off-chain: EIP-712 signed withdrawal request

The merchant signs a typed, structured message off-chain — via the widget, no gas cost, no direct vault interaction:

```
WithdrawalRequest {
  umid: uint256
  token: address
  amount: uint256
  destination: address
  nonce: uint256
  deadline: uint256
  chainId: uint256   // in domain separator — blocks cross-chain replay
}
```

That signature is the merchant's consent. It's sent to the backend, which runs its normal checks (balance, fraud rules, etc.), and the executor then submits the withdrawal transaction carrying the merchant's signature.

### 5.2 On-chain: the vault enforces it too

```solidity
function withdraw(
    umid, token, amount, destination, nonce, deadline, merchantSig
) external onlyExecutor {
    require(block.timestamp <= deadline, "expired");
    require(!usedNonces[umid][nonce], "replayed");

    address signer = recoverSigner(
        umid, token, amount, destination, nonce, deadline, merchantSig
    );
    require(signer == currentSigningKey[umid], "invalid merchant signature");

    usedNonces[umid][nonce] = true;
    // transfer funds
}
```

Two independent gates, not one:

- **`onlyExecutor`** — only the platform can call this function at all (same custodial control as Section 4).
- **valid merchant signature** — but the executor cannot successfully call it without a genuine, unexpired, unused signature from the merchant's currently registered key.

Neither party can move funds alone. The platform can't rug merchant funds, since an invalid or missing merchant signature reverts the call. A merchant can't be spoofed through the platform's API either, since a compromised backend still cannot produce a valid signature it doesn't hold. This is the sentence worth putting directly in a grant or hackathon writeup: *withdrawals require dual authorization — platform execution plus cryptographic merchant consent verified on-chain — so a compromised backend cannot move merchant funds.*

### 5.3 Embedded and external wallets — same signing path

Merchants may sign with either an embedded wallet (key generated and custodied by the platform, e.g. via Circle wallet infra) or an external wallet they control themselves. Both produce the same EIP-712 signature the vault checks, so the on-chain enforcement logic doesn't need to know or care which kind of key signed.

> **Framing this honestly for judges:** If the signing key is embedded (platform-generated), the merchant signature proves *request integrity* — the backend cannot forge a withdrawal without going through the same signing path — not merchant self-custody. If the wallet is external, both properties hold. Both are legitimate designs; state clearly which applies per wallet type rather than implying non-custodial guarantees that aren't there.

### 5.4 Where `currentSigningKey[umid]` comes from

Two options, in order of build cost:

1. **Home-chain attestation passed at withdrawal time** (recommended for hackathon speed): the executor passes the current key plus a home-chain attestation (Merkle proof or oracle read) with each withdrawal call. No relay infrastructure, no sync-lag failure mode, slightly more gas per withdrawal — an acceptable trade since withdrawals are not high-frequency.
2. **Local signer mirror synced from the home chain**: each vault keeps its own copy of the current signing key, synced via a cross-chain messaging relay (e.g. LayerZero, Axelar, Wormhole GMP) whenever the merchant rotates keys. Requires a rotation timelock (24–48h) so the relay has time to propagate before the old key is invalidated and the new one becomes exclusively valid. Worth building once the platform is past hackathon stage and withdrawal volume justifies the gas savings.

---

## 6. Cross-Chain Bridging — Two Modes, Not Just a Fallback

Bridging every individual payment as it arrives is the expensive, naive approach. Instead, funds accumulate in per-chain vaults under the merchant's UMID, and bridging happens through two distinct modes depending on why it's needed:

### 6.1 Last-resort withdrawal bridging

If a merchant needs immediate access to funds on a chain other than where they landed, a cheap cross-chain bridge moves the requested amount at withdrawal time. This is the fallback path — used when speed matters more than routing preference, and only for the funds actually being withdrawn.

### 6.2 Preference-based settlement bridging

Separately, the platform will also offer **normal, standing cross-chain bridging to a chain of the merchant's choice**, driven by two inputs:

- **What the merchant wants** — a merchant can set a standing preference for which chain their funds should settle to or accumulate on, regardless of which chain a given payment originally arrived on.
- **Where payments are actually going into** — the platform can also route based on the observed pattern of incoming payments (e.g. consolidating fragmented small balances across many chains into one primary settlement chain), so a merchant isn't left with dust balances scattered across every chain they've ever received a payment on.

This makes bridging a configurable, ongoing part of settlement — not only an emergency withdrawal mechanism. It's the AI agent orchestration layer (Section 7) that decides, per merchant and per payment, whether funds should stay put, be consolidated toward the merchant's preferred chain, or wait for an explicit withdrawal request.

Keeping both modes distinct matters for cost and risk reasoning: last-resort bridging is optimized for speed on a small, specific amount; preference-based bridging is optimized for cost efficiency and can be batched, scheduled, or deferred since it isn't blocking a merchant's immediate access to funds.

---

## 7. AI Agent Orchestration

An AI agent sits in the orchestration layer and handles cross-chain routing decisions — for example, deciding whether a withdrawal request can be fulfilled from local vault balance or requires triggering a last-resort bridge, and separately managing standing preference-based consolidation toward a merchant's chosen settlement chain. Using programmable wallet infrastructure (e.g. Circle wallet agent tooling) makes this tractable without the agent needing raw custody of merchant funds — it operates within the same policy-gated, dual-authorization constraints as the rest of the system, not as a bypass around them.

---

## 8. Data Layer — Read Replica, Not Write Authority

The backend database's job is to index and display, never to authorize. An indexer listens to the home chain's mint/rotation events and each vault's deposit/withdrawal events, and that populates the database and merchant dashboard. The database is never consulted to authorize a withdrawal — only the on-chain signature check in Section 5.2 does that. If the entire database were exfiltrated, an attacker still could not move a dollar, because moving money requires a merchant signature the database never held.

---

## 9. Threat Model Summary

| Actor / scenario | What's actually protected |
|---|---|
| Compromised backend / database | Cannot move funds — no valid merchant signature is stored anywhere off-chain to steal, and the vault rejects withdrawals without one. |
| Malicious or coerced executor | Cannot move funds without a genuine, unexpired, unused merchant signature matching the currently registered key. |
| Outsider impersonating a merchant | Cannot produce a valid EIP-712 signature without the merchant's signing key (embedded or external). |
| Stale key after rotation | Bounded by the rotation timelock (Section 5.4, mirror option) or eliminated entirely by passing a fresh home-chain attestation per withdrawal. |
| Cross-chain signature replay | Blocked by chainId in the EIP-712 domain separator plus per-UMID nonce tracking. |

> **One item to address explicitly in writeups, not just engineering:** Regulatory reach follows the custody, not just the code. If a chain the platform settles through receives a legal request for merchant data, the platform is the party holding both funds and (for embedded wallets) signing keys. This isn't a blocker, but it deserves a paragraph in any grant or hackathon submission so reviewers see it's been considered rather than assumed away.

---

## 10. Suggested Build Sequence

1. UMID registry contract (home chain) — non-transferable ERC-721 mint + key rotation with timelock.
2. Deterministic vault contract template (CREATE2 via UMID salt) — deploy to first target chain.
3. EIP-712 withdrawal request schema + signature verification in the vault (Section 5.1–5.2).
4. Widget: embedded + external wallet signing, unified through the same EIP-712 flow.
5. Indexer + dashboard — read-only, event-driven, never in the authorization path.
6. "Verify my vaults" public page — cheap, high-impact demo artifact for judges.
7. Last-resort withdrawal bridging + preference-based settlement bridging, both routed through the AI agent orchestration layer.
8. Roll out to additional chains — deterministic addressing means no new registration step per chain, only a new vault deployment.
