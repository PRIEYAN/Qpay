// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Thin wrapper interface over FTSOv2 feed reads (see implementation.md §2).
///         NOT `view` — FtsoV2.getFeedById is `payable` (FeeCalculator can charge per read).
interface IQpayOracle {
    function priceOf(bytes21 feedId) external returns (uint256 value, int8 decimals);
}
