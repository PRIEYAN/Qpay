import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

const FLR_USD_FEED = "0x01464c522f55534400000000000000000000000000";
const XRP_USD_FEED = "0x015852502f55534400000000000000000000000000";
const USDT_USD_FEED = "0x01555344542f555344000000000000000000000000";

async function deployQpay() {
  const [owner, relayer, alice, bob] = await ethers.getSigners();

  const usdt0 = await ethers.deployContract("MockERC20", ["USDT0", "USDT0", 6]);
  const fxrp = await ethers.deployContract("MockERC20", ["FXRP", "FTestXRP", 6]);
  const wflr = await ethers.deployContract("MockERC20", ["Wrapped FLR", "WFLR", 18]);

  const ftso = await ethers.deployContract("MockFtsoV2");
  await ftso.setFeed(USDT_USD_FEED, 1_00000000, 8); // $1.00
  await ftso.setFeed(XRP_USD_FEED, 54000000, 8); // $0.54
  await ftso.setFeed(FLR_USD_FEED, 2000000, 8); // $0.02

  const oracle = await ethers.deployContract("QpayOracle", [owner.address, await ftso.getAddress()]);
  const swap = await ethers.deployContract("QpaySwap", [owner.address, await oracle.getAddress()]);
  const ledger = await ethers.deployContract("QpayLedger", [owner.address]);

  await swap.connect(owner).setLedger(await ledger.getAddress());
  await swap.connect(owner).configureAsset(await usdt0.getAddress(), USDT_USD_FEED, 6);
  await swap.connect(owner).configureAsset(await fxrp.getAddress(), XRP_USD_FEED, 6);
  await swap.connect(owner).configureAsset(await wflr.getAddress(), FLR_USD_FEED, 18);

  await ledger.connect(owner).setSwap(await swap.getAddress());
  await ledger.connect(owner).setRelayer(relayer.address);
  await ledger.connect(owner).setAllowedAsset(await usdt0.getAddress(), true);
  await ledger.connect(owner).setAllowedAsset(await fxrp.getAddress(), true);
  await ledger.connect(owner).setAllowedAsset(await wflr.getAddress(), true);

  // Seed swap inventory so conversions have liquidity to draw from.
  await fxrp.mint(owner.address, ethers.parseUnits("100000", 6));
  await fxrp.connect(owner).approve(await swap.getAddress(), ethers.parseUnits("100000", 6));
  await swap.connect(owner).addInventory(await fxrp.getAddress(), ethers.parseUnits("100000", 6));

  await usdt0.mint(alice.address, ethers.parseUnits("1000", 6));
  await usdt0.connect(alice).approve(await ledger.getAddress(), ethers.parseUnits("1000", 6));

  return { owner, relayer, alice, bob, usdt0, fxrp, wflr, ftso, oracle, swap, ledger };
}

describe("QpayLedger", function () {
  it("moves value instantly when sender and recipient share a primary asset", async function () {
    const { alice, bob, usdt0, ledger } = await deployQpay();

    await ledger.connect(alice).deposit(await usdt0.getAddress(), ethers.parseUnits("100", 6));
    await ledger.connect(alice).setPrimaryAsset(await usdt0.getAddress());
    await ledger.connect(bob).setPrimaryAsset(await usdt0.getAddress());

    await expect(ledger.connect(alice).pay(bob.address, ethers.parseUnits("30", 6), ethers.id("ref1")))
      .to.emit(ledger, "Paid")
      .withArgs(
        alice.address,
        bob.address,
        await usdt0.getAddress(),
        ethers.parseUnits("30", 6),
        await usdt0.getAddress(),
        ethers.parseUnits("30", 6),
        ethers.id("ref1"),
      );

    expect(await ledger.balances(alice.address, await usdt0.getAddress())).to.equal(ethers.parseUnits("70", 6));
    expect(await ledger.balances(bob.address, await usdt0.getAddress())).to.equal(ethers.parseUnits("30", 6));
  });

  it("converts across primary assets in the same transaction (the money shot, plan.md §5.3)", async function () {
    const { alice, bob, usdt0, fxrp, ledger } = await deployQpay();

    await ledger.connect(alice).deposit(await usdt0.getAddress(), ethers.parseUnits("100", 6));
    await ledger.connect(alice).setPrimaryAsset(await usdt0.getAddress());
    await ledger.connect(bob).setPrimaryAsset(await fxrp.getAddress());

    await ledger.connect(alice).pay(bob.address, ethers.parseUnits("10", 6), ethers.id("ref2"));

    // 10 USDT0 @ $1.00 -> FXRP @ $0.54, minus 0.30% spread ≈ 18.462962 FXRP
    const bobBalance = await ledger.balances(bob.address, await fxrp.getAddress());
    expect(bobBalance).to.be.closeTo(ethers.parseUnits("18.462962", 6), ethers.parseUnits("0.0001", 6));
  });

  it("rejects a payment when the sender's balance is insufficient", async function () {
    const { alice, bob, usdt0, ledger } = await deployQpay();
    await ledger.connect(alice).setPrimaryAsset(await usdt0.getAddress());
    await ledger.connect(bob).setPrimaryAsset(await usdt0.getAddress());

    await expect(
      ledger.connect(alice).pay(bob.address, ethers.parseUnits("1", 6), ethers.id("ref3")),
    ).to.be.revertedWithCustomError(ledger, "InsufficientBalance");
  });

  it("lets a gasless PaymentAuth move funds via the relayer without the sender holding FLR", async function () {
    const { alice, bob, relayer, usdt0, ledger } = await deployQpay();

    await ledger.connect(alice).deposit(await usdt0.getAddress(), ethers.parseUnits("100", 6));
    await ledger.connect(alice).setPrimaryAsset(await usdt0.getAddress());
    await ledger.connect(bob).setPrimaryAsset(await usdt0.getAddress());

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const domain = {
      name: "Qpay",
      version: "1",
      chainId,
      verifyingContract: await ledger.getAddress(),
    };
    const types = {
      PaymentAuth: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "asset", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "fee", type: "uint256" },
        { name: "ref", type: "bytes32" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const value = {
      from: alice.address,
      to: bob.address,
      asset: await usdt0.getAddress(),
      amount: ethers.parseUnits("20", 6),
      fee: ethers.parseUnits("0.5", 6),
      ref: ethers.id("ref4"),
      nonce: 0n,
      deadline,
    };

    const signature = await alice.signTypedData(domain, types, value);

    await ledger
      .connect(relayer)
      .payWithAuth(
        value.from,
        value.to,
        value.asset,
        value.amount,
        value.fee,
        value.ref,
        value.nonce,
        value.deadline,
        signature,
      );

    expect(await ledger.balances(bob.address, await usdt0.getAddress())).to.equal(ethers.parseUnits("20", 6));
    expect(await ledger.balances(relayer.address, await usdt0.getAddress())).to.equal(ethers.parseUnits("0.5", 6));

    // Replaying the same signed nonce must revert.
    await expect(
      ledger
        .connect(relayer)
        .payWithAuth(
          value.from,
          value.to,
          value.asset,
          value.amount,
          value.fee,
          value.ref,
          value.nonce,
          value.deadline,
          signature,
        ),
    ).to.be.revertedWithCustomError(ledger, "BadNonce");
  });

  it("rejects a non-relayer address from submitting a gasless payment", async function () {
    const { alice, bob, usdt0, ledger } = await deployQpay();
    await expect(
      ledger
        .connect(alice)
        .payWithAuth(
          alice.address,
          bob.address,
          await usdt0.getAddress(),
          1n,
          0n,
          ethers.id("x"),
          0n,
          Math.floor(Date.now() / 1000) + 3600,
          "0x",
        ),
    ).to.be.revertedWithCustomError(ledger, "NotRelayer");
  });

  it("holds the solvency invariant after a sequence of deposits, payments, and withdrawals", async function () {
    const { alice, bob, usdt0, ledger } = await deployQpay();

    await ledger.connect(alice).setPrimaryAsset(await usdt0.getAddress());
    await ledger.connect(bob).setPrimaryAsset(await usdt0.getAddress());

    await ledger.connect(alice).deposit(await usdt0.getAddress(), ethers.parseUnits("500", 6));

    const amounts = [10, 47, 3, 120, 8, 1, 60];
    for (const amt of amounts) {
      await ledger.connect(alice).pay(bob.address, ethers.parseUnits(String(amt), 6), ethers.id(`r${amt}`));
    }
    await ledger.connect(bob).withdraw(await usdt0.getAddress(), ethers.parseUnits("50", 6));

    const aliceBal = await ledger.balances(alice.address, await usdt0.getAddress());
    const bobBal = await ledger.balances(bob.address, await usdt0.getAddress());
    const contractHoldings = await usdt0.balanceOf(await ledger.getAddress());

    expect(aliceBal + bobBal).to.be.lte(contractHoldings);
  });
});
