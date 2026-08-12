// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Ledger-internal conversion. Moves pool inventory, never custody.
interface IQpaySwap {
    function convert(address assetIn, address assetOut, uint256 amountIn) external returns (uint256 amountOut);
}
