import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/// Deploys the Qpay contract set (contractPlan.md §1) and applies the full
/// post-deploy wiring, including QpaySwap's per-asset FTSO feed config —
/// without `configureAsset`, `QpaySwap.convert()` reverts `AssetNotConfigured`
/// and the app can only quote same-asset payments.
///
/// FXRP, FtsoV2, and AssetManagerFXRP addresses are read live from the Flare
/// contract registry per network (implementation.md §0) rather than
/// hardcoded — they're module parameters, checked in per network under
/// ignition/parameters/:
///
///   npm run deploy:coston2
///   npx hardhat ignition deploy ignition/modules/Qpay.ts --network coston2 \
///     --parameters ignition/parameters/coston2.json
export default buildModule("QpayModule", (m) => {
  const owner = m.getAccount(0);

  const fxrp = m.getParameter<string>("fxrp");
  const ftso = m.getParameter<string>("ftso");
  const assetManager = m.getParameter<string>("assetManager");

  // FTSOv2 feed id for the asset's USD price (implementation.md §2) and the
  // asset's own ERC-20 decimals. Coston2 FXRP is 6-decimal, NOT 18.
  const fxrpFeedId = m.getParameter<string>("fxrpFeedId");
  const fxrpDecimals = m.getParameter<number>("fxrpDecimals", 6);

  const oracle = m.contract("QpayOracle", [owner, ftso]);
  const swap = m.contract("QpaySwap", [owner, oracle]);
  const ledger = m.contract("QpayLedger", [owner]);
  const gateway = m.contract("QpayGateway", [owner, ledger, fxrp, assetManager]);

  m.call(swap, "setLedger", [ledger]);
  m.call(ledger, "setSwap", [swap]);
  m.call(ledger, "setGateway", [gateway]);
  m.call(ledger, "setAllowedAsset", [fxrp, true]);

  // Teaches QpaySwap how to price FXRP. `feedOf[asset] == bytes21(0)` is the
  // AssetNotConfigured trip-wire in convert()/quote(), so this is required for
  // any cross-asset payment, not optional polish.
  m.call(swap, "configureAsset", [fxrp, fxrpFeedId, fxrpDecimals]);

  return { oracle, swap, ledger, gateway };
});
