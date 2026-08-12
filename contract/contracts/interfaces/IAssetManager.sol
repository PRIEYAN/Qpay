// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Minimal slice of Flare's FAssets `IAssetManager`, verified against
///         implementation.md §5.1 (repo tag v1.3.1). Only the redemption path
///         Qpay's egress flow needs — minting is out of scope for QpayGateway v1
///         (see contractPlan.md §1, Path B faucet funding is used for ingress).
interface IAssetManager {
    function lotSize() external view returns (uint256);

    function redeem(uint256 _lots, string memory _redeemerUnderlyingAddressString, address payable _executor)
        external
        payable
        returns (uint256 _redeemedAmountUBA);
}
