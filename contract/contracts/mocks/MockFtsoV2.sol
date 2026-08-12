// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IFtsoV2} from "../interfaces/IFtsoV2.sol";

/// @notice Test-only stand-in for FtsoV2. Fee is always zero; timestamp defaults
///         to "now" so QpayOracle's staleness check passes unless a test
///         explicitly backdates a feed with `setStaleFeed`.
contract MockFtsoV2 is IFtsoV2 {
    struct Feed {
        uint256 value;
        int8 decimals;
        uint64 timestamp;
    }

    mapping(bytes21 => Feed) public feeds;

    function setFeed(bytes21 feedId, uint256 value, int8 decimals) external {
        feeds[feedId] = Feed(value, decimals, uint64(block.timestamp));
    }

    function setStaleFeed(bytes21 feedId, uint256 value, int8 decimals, uint64 timestamp) external {
        feeds[feedId] = Feed(value, decimals, timestamp);
    }

    function calculateFeeById(bytes21) external pure returns (uint256) {
        return 0;
    }

    function getFeedById(bytes21 feedId) external payable returns (uint256 value, int8 decimals, uint64 timestamp) {
        Feed memory f = feeds[feedId];
        return (f.value, f.decimals, f.timestamp);
    }
}
