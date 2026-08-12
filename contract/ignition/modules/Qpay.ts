import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/// Deploys the Qpay contract set (contractPlan.md §1).
///
/// FXRP, FtsoV2, and AssetManagerFXRP addresses are read live from the Flare
/// contract registry per network (implementation.md §0) rather than
/// hardcoded — pass them as module parameters at deploy time:
///
///   npx hardhat ignition deploy ignition/modules/Qpay.ts --network coston2 \
///     --parameters '{"QpayModule": {"fxrp": "0x0b6a...", "ftso": "0xc4e9...", "assetManager": "0xc1ca..."}}'
export default buildModule("QpayModule", (m) => {
  const owner = m.getAccount(0);

  const fxrp = m.getParameter<string>("fxrp");
  const ftso = m.getParameter<string>("ftso");
  const assetManager = m.getParameter<string>("assetManager");

  const oracle = m.contract("QpayOracle", [owner, ftso]);
  const swap = m.contract("QpaySwap", [owner, oracle]);
  const ledger = m.contract("QpayLedger", [owner]);
  const gateway = m.contract("QpayGateway", [owner, ledger, fxrp, assetManager]);

  m.call(swap, "setLedger", [ledger]);
  m.call(ledger, "setSwap", [swap]);
  m.call(ledger, "setGateway", [gateway]);
  m.call(ledger, "setAllowedAsset", [fxrp, true]);

  return { oracle, swap, ledger, gateway };
});
