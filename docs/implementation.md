# Qpay — Implementation

> The engineering counterpart to [plan.md](plan.md). Contracts, verified addresses, real function signatures, build order.
> Target: **Flare Coston2** (chainId 114) for dev · **Flare mainnet** (chainId 14) for prod.
> Every address and signature below was verified against on-chain state or contract source. Anything unconfirmed is marked **⚠ UNVERIFIED**.

---

## 0. Verified environment

### Networks

| | Coston2 (dev) | Flare (prod) |
|---|---|---|
| Chain ID | **114** | **14** |
| RPC | `https://coston2-api.flare.network/ext/C/rpc` | `https://flare-api.flare.network/ext/C/rpc` |
| WSS | `wss://coston2-api.flare.network/ext/C/ws` | — |
| Explorer | `https://coston2-explorer.flare.network` | `https://flare-explorer.flare.network` |
| Native token | C2FLR | FLR |
| Block time | ~1.8s | ~1.8s |
| Faucet | `https://faucet.flare.network/coston2` | N/A |

**Coston2 faucet gives, per address per 24h: 100 C2FLR + 10 USDT0 + 10 FXRP.** FXRP comes straight from the faucet — no minting required to start building. This is what makes phase-1 development frictionless.

### Contract addresses (read live from the registry)

| Contract | Coston2 | Flare mainnet |
|---|---|---|
| `FlareContractRegistry` | `0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019` | *same on all networks* |
| `AssetManagerFXRP` | `0xc1ca88b937d0b528842f95d5731ffb586f4fbdfa` | `0x2a3fe068cd92178554cabcf7c95adf49b4b0b6a8` |
| **FXRP ERC-20** | `0x0b6a3645c240605887a5532109323a3e12273dc7` | `0xad552a648c74d49e10027ab8a618a3ad4901c5be` |
| `FtsoV2` | `0xc4e9c78ea53db782e28f28fdf80baf59336b304d` | `0x7bde3df0624114edb3a67dfe6753e62f4e7c1d20` |
| `FdcVerification` | `0x906507e0b64bcd494db73bd0459d1c667e14b933` | `0x5c14fe9d73ab763f4d4a76f334bf7029ddd20ecc` |

> **Gotcha that will cost you 20 minutes:** Coston2 FXRP has `name() == "FXRP"` but **`symbol() == "FTestXRP"`**. Wallets and the explorer will show *FTestXRP*. `decimals() == 6` — **not 18**. Every FXRP amount in the codebase is 6-decimal; mixing this with 18-decimal FLR is the most likely source of a catastrophic off-by-10¹² bug. Use a typed wrapper or a named constant, never a bare `1e18`.

**Do not hardcode addresses in Solidity.** Resolve through `ContractRegistry` so the same bytecode deploys to Coston2 and mainnet unchanged. The addresses above are for scripts, tests, and debugging.

### Live Coston2 FAssets settings (decoded from `getSettings()`)

| Setting | Coston2 value | Meaning |
|---|---|---|
| `lotSizeAMG` | `10000000` → **10 XRP/lot** | Redemption granularity |
| `collateralReservationFeeBIPS` | **10** (0.10%) | Paid on `reserveCollateral` |
| `redemptionFeeBIPS` | **50** (0.50%) | Deducted on redeem |
| `redemptionDefaultFactorVaultCollateralBIPS` | **10500** (105%) | Redeemer payout if agent defaults |
| `maxRedeemedTickets` | 20 | Cause of partial fills |
| `underlyingSecondsForPayment` | 900 | Minter's XRPL payment deadline |
| `attestationWindowSeconds` | 86400 | Proof validity window |
| `mintingCapAMG` | 0 | Uncapped on Coston2 |

⚠ **Mainnet differs materially** — docs list CRF 0.01%, redemption fee 0.2%, and a 170M XRP minting cap. **Read settings at runtime via `getSettings()`; never hardcode them.**

### Dependencies

```bash
cd contract
npm i @flarenetwork/flare-periphery-contracts   # 0.1.52+
npm i @openzeppelin/contracts
```

Periphery ships per-network directories: `coston2/`, `coston/`, `flare/`, `songbird/`. Import from the one you are targeting.

### `hardhat.config.ts` — add Flare networks

```ts
networks: {
  coston2: {
    type: "http",
    chainType: "l1",
    url: "https://coston2-api.flare.network/ext/C/rpc",
    chainId: 114,
    accounts: [configVariable("COSTON2_PRIVATE_KEY")],
  },
  flare: {
    type: "http",
    chainType: "l1",
    url: "https://flare-api.flare.network/ext/C/rpc",
    chainId: 14,
    accounts: [configVariable("FLARE_PRIVATE_KEY")],
  },
},
```

Solidity **0.8.28** (already configured) satisfies periphery's `pragma ^0.8.25`.

---

## 1. Reading Flare infrastructure from Solidity

The `ContractRegistry` library is `internal view` functions — inlined at compile time, so there is no external call to the library itself.

```solidity
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IAssetManager}    from "@flarenetwork/flare-periphery-contracts/coston2/IAssetManager.sol";
import {FtsoV2Interface}  from "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol";
import {IFdcVerification} from "@flarenetwork/flare-periphery-contracts/coston2/IFdcVerification.sol";

IAssetManager   am   = ContractRegistry.getAssetManagerFXRP();
FtsoV2Interface ftso = ContractRegistry.getFtsoV2();
IFdcVerification fdc = ContractRegistry.getFdcVerification();
```

Two real traps:
- Registry lookups use `keccak256(abi.encode(name))` — **not** `abi.encodePacked`.
- Unknown names return `address(0)` rather than reverting. **Check before use.**

---

## 2. FTSOv2 — pricing the conversion

### Feed IDs (21 bytes: `[1 byte category][hex ASCII name][zero pad]`, category `01` = crypto)

| Feed | ID |
|---|---|
| FLR/USD | `0x01464c522f55534400000000000000000000000000` |
| XRP/USD | `0x015852502f55534400000000000000000000000000` |
| USDT/USD | `0x01555344542f555344000000000000000000000000` |
| BTC/USD | `0x014254432f55534400000000000000000000000000` |
| ETH/USD | `0x014554482f55534400000000000000000000000000` |

### The `payable` / `view` trap

`getFeedById` is **`payable`, not `view`** — a `FeeCalculator` *can* charge per feed. Standard feeds are currently configured at zero fee, but that means **any function of yours that reads a price cannot be `view`**. Plan your function mutability around this from the start; discovering it late forces a refactor through your whole call graph.

```solidity
interface IQpayOracle {
    function priceOf(bytes21 feedId) external returns (uint256 value, int8 decimals);
}

contract QpayOracle is IQpayOracle {
    uint256 public constant MAX_STALENESS = 120; // seconds

    /// @notice NOT view — FtsoV2.getFeedById is payable.
    function priceOf(bytes21 feedId) external returns (uint256 value, int8 decimals) {
        FtsoV2Interface ftso = ContractRegistry.getFtsoV2();

        uint256 fee = ftso.calculateFeeById(feedId);   // future-proof: 0 today
        uint64 ts;
        (value, decimals, ts) = ftso.getFeedById{value: fee}(feedId);

        require(value > 0, "Qpay: bad feed");
        require(block.timestamp - ts <= MAX_STALENESS, "Qpay: stale feed");
    }
}
```

Forwarding `calculateFeeById` as `msg.value` costs one extra call today and saves a production incident the day fees switch on.

### Cross-asset conversion

To convert `amountIn` of asset A into asset B, both priced in USD:

```
amountOut = amountIn
          × (priceA / 10^decA)          // A → USD
          ÷ (priceB / 10^decB)          // USD → B
          × 10^(decimalsB - decimalsA)  // token decimal correction
          × (10000 - spreadBIPS) / 10000
```

The decimal correction term is where bugs live — **FXRP is 6 decimals, WFLR is 18, USDT0 is 6**. Write it once in a library, fuzz it against known vectors, and never inline the arithmetic at a call site.

For UI-only fiat display (₹250 → 5.42 FXRP) prefer computing off-chain with the same feeds. Only the on-chain path needs the staleness guard, because only it moves money.

---

## 3. `QpayLedger` — the core contract

Zone 2 from [plan.md §4.1](plan.md). Everything here is a local state write. No bridges, no proofs, no external chains.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20}           from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}        from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard}  from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712}           from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA}            from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable}          from "@openzeppelin/contracts/access/Ownable.sol";

contract QpayLedger is EIP712, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ---- state ----------------------------------------------------------
    mapping(address => mapping(address => uint256)) public balances;   // user => asset => amount
    mapping(address => address) public primaryAsset;                   // user => preferred asset
    mapping(address => bool)    public allowedAsset;                   // strict allowlist
    mapping(address => uint256) public nonces;                         // meta-tx replay guard

    IQpaySwap public swap;
    address   public gateway;      // only contract allowed to credit from ingress
    address   public relayer;      // gas sponsor; authority-free

    // ---- events ---------------------------------------------------------
    event Deposited(address indexed user, address indexed asset, uint256 amount);
    event Withdrawn(address indexed user, address indexed asset, uint256 amount);
    event Paid(
        address indexed from, address indexed to,
        address assetIn,  uint256 amountIn,
        address assetOut, uint256 amountOut,
        bytes32 indexed ref
    );
    event PrimaryAssetSet(address indexed user, address indexed asset);

    error NotAllowed(address asset);
    error InsufficientBalance(address user, address asset, uint256 have, uint256 want);

    // ---- typehash -------------------------------------------------------
    bytes32 private constant PAYMENT_AUTH_TYPEHASH = keccak256(
        "PaymentAuth(address from,address to,address asset,uint256 amount,uint256 fee,bytes32 ref,uint256 nonce,uint256 deadline)"
    );

    constructor(address _owner) EIP712("Qpay", "1") Ownable(_owner) {}

    // ---- preference -----------------------------------------------------

    /// @notice The "primary chain" from the user's perspective: the asset every
    ///         incoming payment is converted into before it is credited.
    function setPrimaryAsset(address asset) external {
        if (!allowedAsset[asset]) revert NotAllowed(asset);
        primaryAsset[msg.sender] = asset;
        emit PrimaryAssetSet(msg.sender, asset);
    }

    // ---- deposit / withdraw (zone boundary) ------------------------------

    function deposit(address asset, uint256 amount) external nonReentrant {
        if (!allowedAsset[asset]) revert NotAllowed(asset);
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender][asset] += amount;
        emit Deposited(msg.sender, asset, amount);
    }

    /// @dev Called by QpayGateway after an FDC-proved XRPL deposit mints FXRP.
    function creditFromGateway(address user, address asset, uint256 amount) external {
        require(msg.sender == gateway, "Qpay: not gateway");
        if (!allowedAsset[asset]) revert NotAllowed(asset);
        balances[user][asset] += amount;
        emit Deposited(user, asset, amount);
    }

    function withdraw(address asset, uint256 amount) external nonReentrant {
        _debit(msg.sender, asset, amount);              // effects before interaction
        IERC20(asset).safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, asset, amount);
    }

    // ---- THE PAYMENT ----------------------------------------------------

    function pay(address to, uint256 amount, bytes32 ref) external nonReentrant {
        _pay(msg.sender, to, amount, ref);
    }

    /// @dev Two SSTOREs when assets match; plus one swap when they don't.
    ///      No bridge, no proof, no external chain. ~1.8s, ~$0.001.
    function _pay(address from, address to, uint256 amount, bytes32 ref) internal {
        require(to != address(0) && to != from, "Qpay: bad recipient");

        address assetIn  = primaryAsset[from];
        address assetOut = primaryAsset[to];
        require(assetIn != address(0) && assetOut != address(0), "Qpay: no primary asset");

        _debit(from, assetIn, amount);

        uint256 amountOut = amount;
        if (assetIn != assetOut) {
            // Ledger holds both sides; the swap moves inventory, not custody.
            amountOut = swap.convert(assetIn, assetOut, amount);
        }

        balances[to][assetOut] += amountOut;
        emit Paid(from, to, assetIn, amount, assetOut, amountOut, ref);
    }

    function _debit(address user, address asset, uint256 amount) internal {
        uint256 bal = balances[user][asset];
        if (bal < amount) revert InsufficientBalance(user, asset, bal, amount);
        unchecked { balances[user][asset] = bal - amount; }
    }

    // ---- gasless: relayer executes, user authorizes, contract enforces ----

    function payWithAuth(
        address from, address to, address asset,
        uint256 amount, uint256 fee, bytes32 ref,
        uint256 nonce, uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        require(msg.sender == relayer, "Qpay: not relayer");
        require(block.timestamp <= deadline, "Qpay: expired");
        require(nonce == nonces[from], "Qpay: bad nonce");

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            PAYMENT_AUTH_TYPEHASH, from, to, asset, amount, fee, ref, nonce, deadline
        )));
        require(ECDSA.recover(digest, signature) == from, "Qpay: bad signature");

        nonces[from] = nonce + 1;              // consume before any effect

        if (fee > 0) {
            _debit(from, asset, fee);
            balances[relayer][asset] += fee;   // gas reimbursement, in-kind
        }
        _pay(from, to, amount, ref);
    }

    // ---- admin (no upgradeability in v1) ---------------------------------
    function setAllowedAsset(address asset, bool ok) external onlyOwner { allowedAsset[asset] = ok; }
    function setSwap(address s)    external onlyOwner { swap    = IQpaySwap(s); }
    function setGateway(address g) external onlyOwner { gateway = g; }
    function setRelayer(address r) external onlyOwner { relayer = r; }
}
```

### Why this shape

- **`primaryAsset` drives conversion automatically.** The sender never picks the recipient's asset; the recipient's stored preference does. That is what makes "every incoming transaction goes to my primary chain" true by construction rather than by backend convention.
- **The relayer has zero authority.** It cannot change `to`, `amount`, or `ref` — any mutation invalidates the signature — and it cannot replay, because nonces are consumed on-chain. `chainId` sits in the EIP-712 domain separator, blocking cross-chain replay. It is a gas sponsor, nothing more.
- **CEI everywhere.** Balances are debited before any external call, plus `ReentrancyGuard`.
- **Strict allowlist.** v1 is exactly FXRP, USDT0, WFLR. Fee-on-transfer and rebasing tokens would silently corrupt the ledger invariant; the allowlist is the correct v1 answer.
- **No upgradeability.** Immutable, migrate by redeploy. Proxies are a rug vector and reviewers flag them.

### The invariant to fuzz

```
for every allowed asset A:
    Σ balances[user][A]  ≤  IERC20(A).balanceOf(address(QpayLedger))
```

If this ever breaks, the ledger is insolvent. Fuzz it in CI over random sequences of deposit / pay / withdraw / convert. This one test is worth more than any amount of unit-test coverage, and it is the thing to show a technical judge.

---

## 4. `QpaySwap` — conversion inside a payment

v1 is a single-sided inventory pool priced by FTSOv2 with a spread. It is **not** a constant-product AMM — Qpay needs deterministic, oracle-priced conversion at payment time, not price discovery.

```solidity
contract QpaySwap is IQpaySwap, ReentrancyGuard, Ownable {
    IQpayOracle public oracle;
    address public ledger;

    mapping(address => bytes21) public feedOf;      // asset => FTSO feed id
    mapping(address => uint8)   public decimalsOf;  // cache; FXRP=6, USDT0=6, WFLR=18
    uint256 public spreadBIPS = 30;                 // 0.30%

    /// @notice Ledger-internal conversion. Moves pool inventory, never custody.
    /// @dev NOT view — reads FTSOv2, which is payable.
    function convert(address assetIn, address assetOut, uint256 amountIn)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        require(msg.sender == ledger, "Qpay: not ledger");

        (uint256 pIn,  int8 dIn)  = oracle.priceOf(feedOf[assetIn]);
        (uint256 pOut, int8 dOut) = oracle.priceOf(feedOf[assetOut]);

        amountOut = ConversionMath.convert(
            amountIn, pIn, dIn, pOut, dOut,
            decimalsOf[assetIn], decimalsOf[assetOut]
        );
        amountOut = amountOut * (10_000 - spreadBIPS) / 10_000;

        require(amountOut > 0, "Qpay: dust");
        require(inventory[assetOut] >= amountOut, "Qpay: insufficient liquidity");

        inventory[assetIn]  += amountIn;
        inventory[assetOut] -= amountOut;
    }
}
```

**Be honest about this in the writeup.** For the hackathon, inventory is seeded from the Coston2 faucet. At real volume it needs DEX routing or market-maker inventory — that is [plan.md §9](plan.md) open question 1, and naming it is stronger than pretending the pool scales.

Put `ConversionMath` in its own library and unit-test it against hand-computed vectors covering **every decimal pair** (6→6, 6→18, 18→6). This is the highest-risk arithmetic in the codebase.

---

## 5. `QpayGateway` — ingress and egress

The only contract that talks to `AssetManagerFXRP`. Isolating FAssets here keeps the ledger simple and auditable.

### 5.1 Verified FAssets interface

From `flare-foundation/fassets`, `contracts/userInterfaces/IAssetManager.sol` (repo tag **v1.3.1**, 2026-07-08 — note "v1.1" is stale). `AssetManager` is an **EIP-2535 Diamond**; one AssetManager per FAsset.

**Minting:**
```solidity
function reserveCollateral(
    address _agentVault, uint256 _lots, uint256 _maxMintingFeeBIPS, address payable _executor
) external payable returns (uint256 _collateralReservationId);

function collateralReservationFee(uint256 _lots) external view returns (uint256 _reservationFeeNATWei);

function executeMinting(IPayment.Proof calldata _payment, uint256 _collateralReservationId) external;

function mintingPaymentDefault(
    IReferencedPaymentNonexistence.Proof calldata _proof, uint256 _collateralReservationId
) external;
```

⚠ Two corrections against the rendered doc site: `reserveCollateral` **does return** `_collateralReservationId` (the docs omit it), and `executeMinting` is **not** `nonReentrant` in the interface (the docs show a modifier that is not in source).

**Redemption:**
```solidity
function redeem(uint256 _lots, string memory _redeemerUnderlyingAddressString, address payable _executor)
    external payable returns (uint256 _redeemedAmountUBA);

function confirmRedemptionPayment(IPayment.Proof calldata _payment, uint256 _redemptionRequestId) external;

function redemptionPaymentDefault(
    IReferencedPaymentNonexistence.Proof calldata _proof, uint256 _redemptionRequestId
) external;
```

**Two behaviours that will bite you if unhandled:**
1. **Partial fills are normal.** `redeem` may burn fewer lots than requested when redemption tickets run out or `maxRedeemedTickets` (20) is hit — it emits `RedemptionRequestIncomplete`. **Loop on the returned `_redeemedAmountUBA`; never assume the request was filled.**
2. `confirmRedemptionPayment` must be called for **SUCCESS, FAILED and BLOCKED** — not just success. After `confirmationByOthersAfterSeconds` (7200s) anyone may call it for a reward.

### 5.2 Egress: FXRP → real XRP

```solidity
function withdrawToXRPL(uint256 fxrpAmount, string calldata xrplAddress)
    external
    nonReentrant
    returns (uint256 redeemedUBA)
{
    IAssetManager am = ContractRegistry.getAssetManagerFXRP();

    // Lot granularity: 10 XRP on Coston2. Read it, don't hardcode.
    uint256 lotSize = am.lotSize();
    uint256 lots    = fxrpAmount / lotSize;
    require(lots > 0, "Qpay: below one lot");

    uint256 exact = lots * lotSize;
    ledger.debitForGateway(msg.sender, FXRP, exact);   // remainder stays spendable

    IERC20(FXRP).approve(address(am), exact);
    redeemedUBA = am.redeem(lots, xrplAddress, payable(address(0)));

    // Partial fill: refund the unfilled portion to the ledger.
    if (redeemedUBA < exact) {
        ledger.creditFromGateway(msg.sender, FXRP, exact - redeemedUBA);
    }
    emit RedemptionRequested(msg.sender, xrplAddress, redeemedUBA);
}
```

If the agent fails to pay within the deadline, `redemptionPaymentDefault` pays the redeemer from agent vault collateral at **105%** (`redemptionDefaultFactorVaultCollateralBIPS = 10500`). Surface this in the UI — it is the concrete proof that Qpay balances are collateral-backed claims, not IOUs.

---

## 6. FDC — proving an XRPL deposit

This is what makes ingress trustless rather than "trust our indexer."

### 6.1 Flow

```
1. POST {VERIFIER_URL}/verifier/xrp/Payment/prepareRequest   → abiEncodedRequest
2. IFdcHub.requestAttestation{value: fee}(abiEncodedRequest)
     fee ← IFdcRequestFeeConfigurations.getRequestFee(abiEncodedRequest)
3. votingRoundId = (block.timestamp - firstVotingRoundStartTs) / 90
4. wait ~90–180s for finalization
5. POST {DA_LAYER}/api/v1/fdc/proof-by-request-round-raw
     body: { votingRoundId, requestBytes }   → { response_hex, proof[] }
6. FdcVerification.verifyPayment(IPayment.Proof{ merkleProof, data })
```

**Endpoints:**
- Verifier (testnet): `https://fdc-verifiers-testnet.flare.network/` — public API key `00000000-0000-0000-0000-000000000000` in header `X-API-KEY`
- DA Layer: `https://ctn2-data-availability.flare.network` (Coston2) · `flr-` prefix for mainnet

⚠ **`firstVotingRoundStartTs` is inconsistent across Flare's own docs** (`1658430000` vs `1658429955` — a 45s gap) and differs per network. **Read it from `FlareSystemsManager` on-chain; do not hardcode either value.**

⚠ The attestation type is **`Web2Json`**, not `JsonApi`. `JsonApi` is the deprecated old name — do not use it in new code.

### 6.2 `IPayment` proof struct (verbatim)

```solidity
struct Proof { bytes32[] merkleProof; Response data; }

struct Response {
    bytes32 attestationType; bytes32 sourceId; uint64 votingRound;
    uint64 lowestUsedTimestamp; RequestBody requestBody; ResponseBody responseBody;
}

struct ResponseBody {
    uint64  blockNumber;      uint64  blockTimestamp;
    bytes32 sourceAddressHash;          bytes32 sourceAddressesRoot;
    bytes32 receivingAddressHash;       bytes32 intendedReceivingAddressHash;
    int256  spentAmount;                int256  intendedSpentAmount;
    int256  receivedAmount;             int256  intendedReceivedAmount;
    bytes32 standardPaymentReference;   bool oneToOne;   uint8 status;
}
```

**Addresses are hashed, not raw.** Compare against `keccak256(bytes(expectedAddress))`. `attestationType`/`sourceId` are UTF-8 right-zero-padded to 32 bytes — `Payment` = `0x5061796d656e7400…`, `testXRP` = `0x7465737458525000…`.

### 6.3 Verifying and crediting

```solidity
mapping(bytes32 => bool) public usedProofs;   // NON-OPTIONAL replay guard

function creditXrplDeposit(IPayment.Proof calldata proof) external nonReentrant {
    require(ContractRegistry.getFdcVerification().verifyPayment(proof), "Qpay: invalid proof");

    IPayment.ResponseBody calldata r = proof.data.responseBody;
    require(r.status == 0, "Qpay: payment not successful");
    require(r.receivingAddressHash == QPAY_XRPL_ADDRESS_HASH, "Qpay: wrong recipient");

    bytes32 txId = proof.data.requestBody.transactionId;
    require(!usedProofs[txId], "Qpay: proof replayed");
    usedProofs[txId] = true;

    // paymentReference carries the depositing user's identity
    address user = _userFromReference(r.standardPaymentReference);
    require(user != address(0), "Qpay: unknown reference");

    ledger.creditFromGateway(user, FXRP, uint256(r.receivedAmount));
}
```

The `usedProofs` mapping is the difference between a working system and a free-money bug. A valid Merkle proof stays valid forever — without consumption, the same deposit can be credited unboundedly.

⚠ **Current docs describe direct minting via Core Vault**, where the user sends XRP to the Core Vault address with a packed 32-byte `PaymentReference` memo and an executor calls `executeDirectMinting` with an **`XRPPayment`** proof. The classic per-agent flow (§5.1) is confirmed present in the v1.3.1 interface source but the dev hub no longer documents it — **verify against the deployed ABI before building on either path.** Ship the faucet path as the demo default (see [plan.md §5.2](plan.md), Path B) and treat live minting as the stretch demo.

---

## 7. Build order

Each phase ends with something you can demo. The riskiest integration (FDC/FAssets) is deliberately *not* last-but-one — it is scheduled with slack behind it.

| # | Phase | Deliverable | Exit test |
|---|---|---|---|
| 0 | **Spike** (0.5d) | Coston2 in `hardhat.config.ts`; read XRP/USD; read faucet FXRP balance | Script prints a live price and a nonzero balance |
| 1 | **Ledger** (1.5d) | `QpayLedger` + tests + **invariant fuzz** | Instant transfer A→B; solvency invariant holds under fuzzing |
| 2 | **Conversion** (1d) | `QpayOracle`, `ConversionMath`, `QpaySwap`, `payWithConversion` | USDT0 in → FXRP out, one tx; decimal vectors pass |
| 3 | **Gasless** (1d) | EIP-712 `payWithAuth` + relayer service | Wallet with 0 FLR completes a payment |
| 4 | **Mobile** (2d) | RN app: QR, balance, contacts, send, request, primary-chain picker | Phone-to-phone payment in under 5s wall clock |
| 5 | **FDC ingress** (1.5d) | Verifier → DA layer → `verifyPayment` → credit | Real testXRP on XRPL appears as FXRP in-app |
| 6 | **FAssets egress** (1d) | `redeem` + partial-fill handling | FXRP out → real XRP back in an XRPL wallet |
| 7 | **Polish** (1d) | Merchant mode, history, failure paths, demo script | 90-second recording |

**Testing.** Solidity `.t.sol` tests for pure logic (`ConversionMath`, EIP-712 digests, access control). TypeScript integration tests against a **Coston2 fork** for anything touching FtsoV2, FdcVerification, or AssetManager — those cannot be meaningfully mocked, and mocking them is how you ship a contract that works only against your own mocks. The `hardhat` skill in `contract/.claude/skills` covers `network.create()` and the fork workflow.

---

## 8. Pre-demo checklist

Run this before recording, and again before judging:

- [ ] Coston2 faucet claimed for every demo address (C2FLR + FXRP + USDT0) — 24h cooldown, so claim early
- [ ] `getSettings()` read live — Coston2 values differ from mainnet and can change
- [ ] FXRP decimals asserted as `6` in a test that fails loudly if it changes
- [ ] Solvency invariant fuzz passing in CI
- [ ] `usedProofs` replay test present and passing
- [ ] Relayer funded with C2FLR and monitored
- [ ] FTSO staleness path exercised (a test that forces a stale timestamp and expects a revert)
- [ ] Partial-fill redemption path exercised
- [ ] An agent with free collateral confirmed available *if* demoing live minting — otherwise use the faucet path and say so
- [ ] Every demo transaction linked to the Coston2 explorer in the writeup

---

## 9. Sources

- `IAssetManager.sol` — https://github.com/flare-foundation/fassets/blob/main/contracts/userInterfaces/IAssetManager.sol
- FAssets operational parameters — https://dev.flare.network/fassets/operational-parameters
- FTSOv2 feed IDs — https://dev.flare.network/ftso/feeds
- `FtsoV2Interface` — https://dev.flare.network/ftso/solidity-reference/FtsoV2Interface
- FDC attestation types — https://dev.flare.network/fdc/attestation-types
- `IPayment` reference — https://dev.flare.network/fdc/reference/IPayment
- Coston2 faucet — https://faucet.flare.network/coston2
- `@flarenetwork/flare-periphery-contracts` — https://www.npmjs.com/package/@flarenetwork/flare-periphery-contracts

**Unverified / verify-before-relying:** per-agent minting fee BIPS (per-agent, read via `getAgentInfo`); mainnet direct-minting parameters (doc-stated only); the exact current status of the classic vs. direct minting flow; LayerZero/Stargate contract addresses on Flare mainnet (no Coston2 deployment found — assume unavailable on testnet).
