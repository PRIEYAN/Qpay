import { network } from "hardhat";
import deployed from "../ignition/deployments/chain-114/deployed_addresses.json" with { type: "json" };
import params from "../ignition/parameters/coston2.json" with { type: "json" };

/**
 * One-shot post-deploy fix: teach the already-deployed QpaySwap how to price
 * FXRP. Deploys nothing and touches no address — it sends a single
 * `configureAsset` call to the existing QpaySwap at the address Ignition
 * already recorded.
 *
 * Equivalent to re-running `npm run deploy:coston2` (Ignition would skip the
 * eight completed futures and send exactly this one tx); this exists for when
 * you'd rather not point the deploy command at a live deployment at all.
 *
 *   npx hardhat run scripts/configure-fxrp.ts --network coston2
 */
const { ethers } = await network.connect({ network: "coston2", chainType: "l1" });

const swapAddress = deployed["QpayModule#QpaySwap"];
const { fxrp, fxrpFeedId, fxrpDecimals } = params.QpayModule;

const [signer] = await ethers.getSigners();
const swap = await ethers.getContractAt("QpaySwap", swapAddress, signer);

const owner = await swap.owner();
if (owner.toLowerCase() !== signer.address.toLowerCase()) {
  throw new Error(`configureAsset is onlyOwner: swap owner is ${owner}, signer is ${signer.address}`);
}

const before = await swap.feedOf(fxrp);
console.log(`QpaySwap  ${swapAddress}`);
console.log(`feedOf(FXRP) before: ${before}`);
if (before !== "0x" + "00".repeat(21)) {
  console.log("Already configured — nothing to do.");
  process.exit(0);
}

const tx = await swap.configureAsset(fxrp, fxrpFeedId, fxrpDecimals);
console.log(`configureAsset(${fxrp}, ${fxrpFeedId}, ${fxrpDecimals}) -> ${tx.hash}`);
const receipt = await tx.wait();
if (!receipt || receipt.status !== 1) throw new Error(`tx failed: ${tx.hash}`);

console.log(`feedOf(FXRP) after:  ${await swap.feedOf(fxrp)}`);
console.log(`decimalsOf(FXRP):    ${await swap.decimalsOf(fxrp)}`);
console.log(`mined in block ${receipt.blockNumber}, gas used ${receipt.gasUsed}`);
