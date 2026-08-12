// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Minimal slice of Flare's `FtsoV2Interface`, verified against
///         implementation.md §2. `getFeedById` is `payable`, not `view`.
interface IFtsoV2 {
    function calculateFeeById(bytes21 feedId) external view returns (uint256 fee);

    function getFeedById(bytes21 feedId)
        external
        payable
        returns (uint256 value, int8 decimals, uint64 timestamp);
}
