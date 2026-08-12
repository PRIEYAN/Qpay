// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IQpayOracle} from "./interfaces/IQpayOracle.sol";
import {IFtsoV2} from "./interfaces/IFtsoV2.sol";

/// @notice Isolates FTSOv2 feed-ID plumbing from the rest of the contracts
///         (implementation.md §2). `ftso` is settable rather than resolved via
///         `ContractRegistry` at deploy time so the same contract can be pointed
///         at Coston2, Flare mainnet, or a mock in tests without redeploying.
contract QpayOracle is IQpayOracle, Ownable {
    /// @dev Reject any feed whose timestamp is older than this many seconds.
    uint256 public constant MAX_STALENESS = 120;

    IFtsoV2 public ftso;

    event FtsoUpdated(address indexed ftso);

    constructor(address _owner, address _ftso) Ownable(_owner) {
        ftso = IFtsoV2(_ftso);
    }

    function setFtso(address _ftso) external onlyOwner {
        ftso = IFtsoV2(_ftso);
        emit FtsoUpdated(_ftso);
    }

    /// @notice NOT view — FtsoV2.getFeedById is payable.
    function priceOf(bytes21 feedId) external returns (uint256 value, int8 decimals) {
        uint256 fee = ftso.calculateFeeById(feedId);
        uint64 ts;
        (value, decimals, ts) = ftso.getFeedById{value: fee}(feedId);

        require(value > 0, "Qpay: bad feed");
        require(block.timestamp - ts <= MAX_STALENESS, "Qpay: stale feed");
    }

    receive() external payable {}
}
