import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

const LOT_SIZE = 10_000000n; // 10 XRP, 6 decimals — Coston2 lot size (implementation.md §0)

async function deployGateway() {
  const [owner, alice] = await ethers.getSigners();

  const fxrp = await ethers.deployContract("MockERC20", ["FXRP", "FTestXRP", 6]);
  const assetManager = await ethers.deployContract("MockAssetManager", [await fxrp.getAddress(), LOT_SIZE]);

  const ledger = await ethers.deployContract("QpayLedger", [owner.address]);
  await ledger.connect(owner).setAllowedAsset(await fxrp.getAddress(), true);

  const gateway = await ethers.deployContract("QpayGateway", [
    owner.address,
    await ledger.getAddress(),
    await fxrp.getAddress(),
    await assetManager.getAddress(),
  ]);
  await ledger.connect(owner).setGateway(await gateway.getAddress());

  await fxrp.mint(alice.address, ethers.parseUnits("505", 6));
  await fxrp.connect(alice).approve(await ledger.getAddress(), ethers.parseUnits("505", 6));
  await ledger.connect(alice).deposit(await fxrp.getAddress(), ethers.parseUnits("505", 6));

  return { owner, alice, fxrp, assetManager, ledger, gateway };
}

describe("QpayGateway — egress (implementation.md §5.2)", function () {
  it("redeems whole lots and leaves a sub-lot remainder spendable", async function () {
    const { alice, fxrp, ledger, gateway } = await deployGateway();

    // 505 FXRP redeems 500 (50 lots); 5 FXRP remains spendable.
    await gateway.connect(alice).withdrawToXRPL(ethers.parseUnits("505", 6), "rXRPLAddressExample");

    expect(await ledger.balances(alice.address, await fxrp.getAddress())).to.equal(ethers.parseUnits("5", 6));
  });

  it("reverts when the requested amount is below one lot", async function () {
    const { alice, gateway } = await deployGateway();
    await expect(
      gateway.connect(alice).withdrawToXRPL(ethers.parseUnits("5", 6), "rXRPLAddressExample"),
    ).to.be.revertedWithCustomError(gateway, "BelowOneLot");
  });

  it("refunds the unfilled portion of a partial-fill redemption back to the ledger", async function () {
    const { alice, assetManager, fxrp, ledger, gateway } = await deployGateway();

    // Agent tickets run out at 60% fill (implementation.md §5.1, RedemptionRequestIncomplete).
    await assetManager.setFillRatioBIPS(6_000);

    await gateway.connect(alice).withdrawToXRPL(ethers.parseUnits("500", 6), "rXRPLAddressExample");

    // 500 requested, 300 actually redeemed, 200 refunded + 5 original remainder = 205 spendable.
    expect(await ledger.balances(alice.address, await fxrp.getAddress())).to.equal(ethers.parseUnits("205", 6));
    expect(await fxrp.balanceOf(await ledger.getAddress())).to.equal(ethers.parseUnits("205", 6));
  });
});
