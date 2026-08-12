// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAssetManager} from "../interfaces/IAssetManager.sol";

/// @notice Test-only stand-in for AssetManagerFXRP. `fillRatioBIPS` lets tests
///         exercise the partial-fill path (implementation.md §5.1) deterministically.
contract MockAssetManager is IAssetManager {
    IERC20 public immutable fxrp;
    uint256 public immutable lotSizeAmount;
    uint256 public fillRatioBIPS = 10_000; // 100% filled by default

    event Redeemed(uint256 lots, string underlyingAddress, uint256 redeemedUBA);

    constructor(address _fxrp, uint256 _lotSize) {
        fxrp = IERC20(_fxrp);
        lotSizeAmount = _lotSize;
    }

    function setFillRatioBIPS(uint256 bips) external {
        fillRatioBIPS = bips;
    }

    function lotSize() external view returns (uint256) {
        return lotSizeAmount;
    }

    function redeem(uint256 _lots, string memory _redeemerUnderlyingAddressString, address payable)
        external
        payable
        returns (uint256 _redeemedAmountUBA)
    {
        uint256 requested = _lots * lotSizeAmount;
        _redeemedAmountUBA = (requested * fillRatioBIPS) / 10_000;

        // Only pull what actually gets redeemed; the unfilled portion is left
        // for the caller (QpayGateway) to refund back to its own ledger.
        fxrp.transferFrom(msg.sender, address(this), _redeemedAmountUBA);
        emit Redeemed(_lots, _redeemerUnderlyingAddressString, _redeemedAmountUBA);
    }
}
