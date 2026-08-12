# Chain-Selection Agent

> Status: Design v1.0 · Runtime: Groq (LLM inference) · Live data: CoinMarketCap API

## 1. What this agent does

Qpay's core design (see `plan.md`) removes bridging from the payment path by keeping settlement on a single chain (Flare) and only touching other chains at the ingress/egress edges. Those edges are exactly where a bridge, a swap route, or a withdrawal network still has to be *chosen* — and the cost of that choice varies constantly: gas on one chain spikes while another is idle, a token's bridge fee on one route is a flat $0.30 and on another is 0.3% of notional.

The chain-selection agent is a small decision-making step that sits at those edges. Before Qpay executes an ingress (funding in) or egress (cash-out) transaction, the agent looks at live network conditions across the candidate chains/routes and recommends the one that minimizes total cost (gas + bridge/relayer fee) for that specific transfer, given its asset and size.

It does **not** authorize fund movement and it is not on the trust path — same non-negotiable rule as the rest of Qpay: *the agent recommends, the user/contract still enforces.* If the agent is wrong, slow, or down, the system falls back to a static default route and nothing breaks.

## 2. Why an LLM agent instead of a fixed rule table

A hand-written rule table ("if amount < $10 use route A") works until fee curves shift — and they shift hourly. Gas prices, CEX/DEX-derived token prices, and network congestion move independently and the *cheapest* choice depends on all three at once. Framing the decision as an LLM call over live, structured inputs (rather than a static lookup) means:

- New chains/routes can be added by describing them in the prompt/config, not by writing new branching logic.
- The reasoning ("why this chain was picked") is human-readable and can be logged for the demo/judges without extra instrumentation.
- The agent naturally handles the "close call" cases — e.g. two routes within 5% of each other — by picking the one with better finality/reliability trade-offs when cost is a tie, instead of needing that judgment hard-coded.

The LLM is a **cost estimator with judgment**, not a source of truth for prices — all numeric inputs it reasons over come from CoinMarketCap, never from its own knowledge.

## 3. Runtime: Groq

Inference runs on Groq (LPU-hosted open models — e.g. Llama 3.x / Mixtral class), chosen specifically because this decision sits in the user-facing payment latency path at the ingress/egress edges:

- Groq's low time-to-first-token keeps the "which chain should I use" decision under the same UX budget as the rest of the flow (sub-2-second target, per `plan.md`).
- The task is a bounded, structured decision (a handful of candidate chains, a handful of numeric features each) — well within a fast, cheaper open-weight model's competence, so there's no need for a slower/heavier model here.

Model calls are stateless: one call per ingress/egress decision, no conversation history retained. This keeps the agent easy to reason about and cheap to run per-transaction.

## 4. Data source: CoinMarketCap API

The agent's numeric inputs come from CoinMarketCap (CMC), fetched fresh immediately before each decision (not cached across transactions, since gas/price conditions are the whole point):

| Endpoint | Used for |
|---|---|
| `/v2/cryptocurrency/quotes/latest` | Live USD price of the asset being moved, per candidate chain's native/bridged representation |
| `/v1/tools/price-conversion` | Converting the transfer amount into each chain's gas-fee-denominating asset for an apples-to-apples comparison |

Where CMC does not expose gas price directly (it is a market-data API, not a gas oracle), the agent combines CMC's price feed with a lightweight per-chain gas-price source (chain RPC `eth_gasPrice` / equivalent, or a gas-station endpoint) to compute:

```
total_cost_usd(route) = (gas_units_estimate * gas_price_gwei * native_token_usd_price)
                       + fixed_bridge_or_relayer_fee_usd(route)
                       + variable_fee_pct(route) * transfer_amount_usd
```

CMC supplies the USD pricing legs of that formula; the agent's job is to gather one such estimate per candidate route and pass the set to the LLM for a final ranked recommendation with a short rationale.

## 5. Decision flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Trigger: ingress deposit detected, or user requests egress      │
└───────────────────────────────┬───────────────────────────────────┘
                                 ▼
                  Enumerate candidate chains/routes
                  (from the user's primary-chain config +
                   any protocol-supported egress networks)
                                 ▼
        For each candidate: fetch live price (CoinMarketCap)
        + live gas price (chain RPC) → compute total_cost_usd
                                 ▼
        Groq LLM call: given [route, cost_usd, est. finality time]
        for each candidate → rank + short rationale
                                 ▼
              Top recommendation surfaced to the user
              (never auto-executed without confirmation)
                                 ▼
        User confirms → normal Qpay flow executes on-chain,
        exactly as if the user had picked the route manually
                                 ▼
   Fallback: if CMC/Groq call fails or times out → default route
   for that asset (defined in config), no user-facing delay
```

## 6. What the agent is explicitly not

- **Not a signer.** It never holds keys and never submits a transaction itself. Recommendation only — Qpay's existing EIP-712 / on-chain authorization path (see `plan.md` §"dual-authorization") is unchanged.
- **Not a price oracle for settlement.** FTSOv2 remains the only price feed used for actual conversion math inside the contract. CoinMarketCap data feeds the agent's *route recommendation* only; it never touches balances.
- **Not required for the system to function.** If Groq or CMC is unreachable, Qpay falls back to a static per-asset default route (the same one used today) and the payment/withdrawal proceeds without the agent in the loop.

## 7. Failure modes and mitigations

| Failure | Mitigation |
|---|---|
| CoinMarketCap API rate-limited or down | Fall back to last-known-good cached quote (short TTL) or static default route |
| Groq inference timeout | Hard timeout (e.g. 2s) → fall back to lowest-cost candidate computed directly from the numeric data, skipping the LLM ranking step |
| Agent recommends a route the user's wallet/asset doesn't support | Recommendation list is pre-filtered to routes valid for the user's held asset before the LLM ever sees it |
| Stale gas price causing a bad recommendation | Gas price fetched fresh per decision, no caching across transactions |

## 8. Open items

- Which chains/routes are in the candidate set beyond Flare's own ingress/egress list (`plan.md` §"primary chain") is not yet finalized — likely scoped to whatever egress networks Qpay already supports (XRPL, Flare C-chain, Stargate/USDT0 post-hackathon) rather than an open-ended chain list.
- Exact Groq model choice (Llama 3.1 8B vs. 70B class) should be benchmarked against the latency budget once real CMC + gas-price data is wired up.
- No historical logging/analytics on agent recommendations vs. actual best route yet — worth adding before relying on this for anything beyond a demo.
