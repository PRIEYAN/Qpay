// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAssetManager} from "./interfaces/IAssetManager.sol";

interface IQpayLedgerGateway {
    function debitForGateway(address user, address asset, uint256 amount) external;
    function creditFromGateway(address user, address asset, uint256 amount) external;
}

/// @notice The only contract that talks to AssetManagerFXRP (implementation.md
///         §5). Isolating FAssets here keeps the ledger simple and auditable.
///         v1 covers egress (FXRP -> real XRP). Ingress in v1 uses the Coston2
///         faucet path (plan.md §5.2, Path B); FDC-verified minting ingress is
///         tracked as the phase-5 stretch goal in contractPlan.md and is not
///         yet wired into this contract.
contract QpayGateway is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IQpayLedgerGateway public immutable ledger;
    IERC20 public immutable fxrp;
    IAssetManager public assetManager;

    event RedemptionRequested(address indexed user, string xrplAddress, uint256 redeemedUBA);
    event AssetManagerUpdated(address indexed assetManager);

    error BelowOneLot();

    constructor(address _owner, address _ledger, address _fxrp, address _assetManager) Ownable(_owner) {
        ledger = IQpayLedgerGateway(_ledger);
        fxrp = IERC20(_fxrp);
        assetManager = IAssetManager(_assetManager);
    }

    function setAssetManager(address _assetManager) external onlyOwner {
        assetManager = IAssetManager(_assetManager);
        emit AssetManagerUpdated(_assetManager);
    }

    /// @notice Egress: FXRP -> real XRP (implementation.md §5.2).
    ///         Redemption works in whole lots; any remainder below one lot
    ///         stays as a spendable ledger balance rather than being lost.
    function withdrawToXRPL(uint256 fxrpAmount, string calldata xrplAddress)
        external
        nonReentrant
        returns (uint256 redeemedUBA)
    {
        uint256 lotSize = assetManager.lotSize();
        uint256 lots = fxrpAmount / lotSize;
        if (lots == 0) revert BelowOneLot();

        uint256 exact = lots * lotSize;
        ledger.debitForGateway(msg.sender, address(fxrp), exact); // moves real custody here too

        fxrp.forceApprove(address(assetManager), exact);
        redeemedUBA = assetManager.redeem(lots, xrplAddress, payable(address(0)));

        // Partial fill: refund the unfilled portion to the ledger, in tokens and
        // in bookkeeping (implementation.md §5.1 — redeem may fill fewer lots
        // than requested; never assume the request was filled in full).
        if (redeemedUBA < exact) {
            uint256 unfilled = exact - redeemedUBA;
            fxrp.safeTransfer(address(ledger), unfilled);
            ledger.creditFromGateway(msg.sender, address(fxrp), unfilled);
        }

        emit RedemptionRequested(msg.sender, xrplAddress, redeemedUBA);
    }
}
