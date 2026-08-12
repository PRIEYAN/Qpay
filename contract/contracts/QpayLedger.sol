// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IQpaySwap} from "./interfaces/IQpaySwap.sol";

/// @notice Zone 2 from plan.md §4.1 — the core. Every balance change here is a
///         local state write: no bridge, no proof, no external chain. The
///         database is a read replica, never a write authority (plan.md §4.2) —
///         every balance change below is authorized either by the user's own
///         transaction or by a contract-verified EIP-712 signature.
contract QpayLedger is EIP712, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ---- state ----------------------------------------------------------
    mapping(address => mapping(address => uint256)) public balances; // user => asset => amount
    mapping(address => address) public primaryAsset; // user => preferred asset
    mapping(address => bool) public allowedAsset; // strict allowlist
    mapping(address => uint256) public nonces; // meta-tx replay guard

    IQpaySwap public swap;
    address public gateway; // only contract allowed to credit from ingress
    address public relayer; // gas sponsor; authority-free

    // ---- events ---------------------------------------------------------
    event Deposited(address indexed user, address indexed asset, uint256 amount);
    event Withdrawn(address indexed user, address indexed asset, uint256 amount);
    event Paid(
        address indexed from,
        address indexed to,
        address assetIn,
        uint256 amountIn,
        address assetOut,
        uint256 amountOut,
        bytes32 indexed ref
    );
    event PrimaryAssetSet(address indexed user, address indexed asset);
    event AllowedAssetSet(address indexed asset, bool allowed);
    event SwapUpdated(address indexed swap);
    event GatewayUpdated(address indexed gateway);
    event RelayerUpdated(address indexed relayer);

    error NotAllowed(address asset);
    error InsufficientBalance(address user, address asset, uint256 have, uint256 want);
    error NotGateway();
    error NotRelayer();
    error Expired();
    error BadNonce();
    error BadSignature();
    error BadRecipient();
    error NoPrimaryAsset();

    // ---- typehash -------------------------------------------------------
    bytes32 private constant PAYMENT_AUTH_TYPEHASH = keccak256(
        "PaymentAuth(address from,address to,address asset,uint256 amount,uint256 fee,bytes32 ref,uint256 nonce,uint256 deadline)"
    );

    constructor(address _owner) EIP712("Qpay", "1") Ownable(_owner) {}

    // ---- preference -----------------------------------------------------

    /// @notice The "primary chain" from the user's perspective (plan.md §3): the
    ///         asset every incoming payment is converted into before credit.
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

    /// @dev Called by QpayGateway after an FDC-proved XRPL deposit mints FXRP,
    ///      or after any other verified ingress event.
    function creditFromGateway(address user, address asset, uint256 amount) external {
        if (msg.sender != gateway) revert NotGateway();
        if (!allowedAsset[asset]) revert NotAllowed(asset);
        balances[user][asset] += amount;
        emit Deposited(user, asset, amount);
    }

    /// @dev Called by QpayGateway to debit a user ahead of an egress redemption.
    ///      Moves the real ERC-20 balance to the gateway too, since the gateway
    ///      needs actual custody to approve/redeem against AssetManagerFXRP.
    function debitForGateway(address user, address asset, uint256 amount) external {
        if (msg.sender != gateway) revert NotGateway();
        _debit(user, asset, amount);
        IERC20(asset).safeTransfer(gateway, amount);
    }

    function withdraw(address asset, uint256 amount) external nonReentrant {
        _debit(msg.sender, asset, amount); // effects before interaction
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
        if (to == address(0) || to == from) revert BadRecipient();

        address assetIn = primaryAsset[from];
        address assetOut = primaryAsset[to];
        if (assetIn == address(0) || assetOut == address(0)) revert NoPrimaryAsset();

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
        unchecked {
            balances[user][asset] = bal - amount;
        }
    }

    // ---- gasless: relayer executes, user authorizes, contract enforces ----

    function payWithAuth(
        address from,
        address to,
        address asset,
        uint256 amount,
        uint256 fee,
        bytes32 ref,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        if (msg.sender != relayer) revert NotRelayer();
        if (block.timestamp > deadline) revert Expired();
        if (nonce != nonces[from]) revert BadNonce();

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(PAYMENT_AUTH_TYPEHASH, from, to, asset, amount, fee, ref, nonce, deadline))
        );
        if (ECDSA.recover(digest, signature) != from) revert BadSignature();

        nonces[from] = nonce + 1; // consume before any effect

        if (fee > 0) {
            _debit(from, asset, fee);
            balances[relayer][asset] += fee; // gas reimbursement, in-kind
        }
        _pay(from, to, amount, ref);
    }

    // ---- admin (no upgradeability in v1) ---------------------------------
    function setAllowedAsset(address asset, bool ok) external onlyOwner {
        allowedAsset[asset] = ok;
        emit AllowedAssetSet(asset, ok);
    }

    function setSwap(address s) external onlyOwner {
        swap = IQpaySwap(s);
        emit SwapUpdated(s);
    }

    function setGateway(address g) external onlyOwner {
        gateway = g;
        emit GatewayUpdated(g);
    }

    function setRelayer(address r) external onlyOwner {
        relayer = r;
        emit RelayerUpdated(r);
    }
}
