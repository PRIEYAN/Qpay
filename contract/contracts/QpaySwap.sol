// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IQpaySwap} from "./interfaces/IQpaySwap.sol";
import {IQpayOracle} from "./interfaces/IQpayOracle.sol";
import {ConversionMath} from "./libraries/ConversionMath.sol";

/// @notice v1 single-sided inventory pool priced by FTSOv2 with a spread
///         (implementation.md §4). NOT a constant-product AMM — Qpay needs
///         deterministic, oracle-priced conversion at payment time, not price
///         discovery. Inventory is seeded from the Coston2 faucet for the
///         hackathon; at real volume this needs DEX routing or market-maker
///         inventory (plan.md §9, open question 1) — said out loud, not hidden.
contract QpaySwap is IQpaySwap, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IQpayOracle public oracle;
    address public ledger;

    mapping(address => bytes21) public feedOf; // asset => FTSO feed id
    mapping(address => uint8) public decimalsOf; // FXRP=6, USDT0=6, WFLR=18
    mapping(address => uint256) public inventory;

    uint256 public spreadBIPS = 30; // 0.30%

    event LedgerUpdated(address indexed ledger);
    event AssetConfigured(address indexed asset, bytes21 feedId, uint8 decimals);
    event InventoryAdded(address indexed asset, uint256 amount);
    event Converted(address indexed assetIn, address indexed assetOut, uint256 amountIn, uint256 amountOut);

    error NotLedger();
    error AssetNotConfigured(address asset);

    constructor(address _owner, address _oracle) Ownable(_owner) {
        oracle = IQpayOracle(_oracle);
    }

    function setLedger(address _ledger) external onlyOwner {
        ledger = _ledger;
        emit LedgerUpdated(_ledger);
    }

    function configureAsset(address asset, bytes21 feedId, uint8 decimals) external onlyOwner {
        feedOf[asset] = feedId;
        decimalsOf[asset] = decimals;
        emit AssetConfigured(asset, feedId, decimals);
    }

    function setSpreadBIPS(uint256 _spreadBIPS) external onlyOwner {
        spreadBIPS = _spreadBIPS;
    }

    /// @notice Fund the pool's sell-side inventory of `asset`. Anyone may top up —
    ///         depositing inventory carries no risk, symmetric to plan.md's
    ///         "deposits are permissive" framing for merchant vaults.
    function addInventory(address asset, uint256 amount) external nonReentrant {
        if (feedOf[asset] == bytes21(0)) revert AssetNotConfigured(asset);
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        inventory[asset] += amount;
        emit InventoryAdded(asset, amount);
    }

    /// @dev NOT view — reads FTSOv2 via the oracle, which is payable.
    function convert(address assetIn, address assetOut, uint256 amountIn)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        if (msg.sender != ledger) revert NotLedger();
        if (feedOf[assetIn] == bytes21(0)) revert AssetNotConfigured(assetIn);
        if (feedOf[assetOut] == bytes21(0)) revert AssetNotConfigured(assetOut);

        (uint256 pIn, int8 dIn) = oracle.priceOf(feedOf[assetIn]);
        (uint256 pOut, int8 dOut) = oracle.priceOf(feedOf[assetOut]);

        amountOut = ConversionMath.convert(
            amountIn, pIn, dIn, pOut, dOut, decimalsOf[assetIn], decimalsOf[assetOut], spreadBIPS
        );

        require(amountOut > 0, "Qpay: dust");
        require(inventory[assetOut] >= amountOut, "Qpay: insufficient liquidity");

        inventory[assetIn] += amountIn;
        inventory[assetOut] -= amountOut;

        emit Converted(assetIn, assetOut, amountIn, amountOut);
    }
}
