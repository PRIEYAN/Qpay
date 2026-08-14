/**
 * Pure event -> Transaction mapping. Takes already-fetched, already-decoded
 * event logs (plain data, not live ethers.Contract instances) and produces
 * the exact Transaction[] shape screens render — so this is testable with
 * hand-built fixtures and no network, per the task's test requirements.
 *
 * Kept deliberately separate from qpayService.ts's orchestration (which does
 * the actual queryFilter calls, block-timestamp lookups, and TOKENS/contact
 * resolution) so the mapping logic — the part most likely to have a subtle
 * bug — can be unit tested in isolation.
 */
import { fromTokenAmount } from '../contracts/decimals';
import { fromBytes32Ref } from '../contracts/ref';
import { PrimaryAsset, Transaction, TransactionStatus } from './types';

export type RawLog = {
  transactionHash: string;
  blockNumber: number;
  /** The log's index within its block — combined with transactionHash, unique per row. */
  index: number;
};

export type RawPaidLog = RawLog & {
  args: {
    from: string;
    to: string;
    assetIn: string;
    amountIn: bigint;
    assetOut: string;
    amountOut: bigint;
    ref: string; // bytes32 hex
  };
};

export type RawDepositedLog = RawLog & {
  args: { user: string; asset: string; amount: bigint };
};

export type RawWithdrawnLog = RawLog & {
  args: { user: string; asset: string; amount: bigint };
};

export type RawRedemptionRequestedLog = RawLog & {
  args: { user: string; xrplAddress: string; redeemedUBA: bigint };
};

export type AssetInfo = { symbol: PrimaryAsset; decimals: number };

/** Resolves a token contract address to the PrimaryAsset symbol + decimals Qpay knows it by, or null if unrecognized. */
export type AssetResolver = (tokenAddress: string) => AssetInfo | null;

/** Resolves a wallet address to a locally-saved contact's display name/id, or null if unknown. */
export type ContactResolver = (address: string) => { id: string; name: string } | null;

export type BuildTransactionsInput = {
  /** The connected user's address (any case). */
  me: string;
  paid: RawPaidLog[];
  deposited: RawDepositedLog[];
  withdrawn: RawWithdrawnLog[];
  redemptions: RawRedemptionRequestedLog[];
  /** FXRP's decimals (always 6 on Coston2/mainnet) — RedemptionRequested carries no asset address to resolve it from. */
  fxrpDecimals: number;
  resolveAsset: AssetResolver;
  resolveContact: ContactResolver;
  /** ms-epoch block timestamp, keyed by block number. */
  blockTimestamps: ReadonlyMap<number, number>;
  explorerUrl: (txHash: string) => string;
  /** Fallback display for an address with no saved contact — defaults to a truncated address. */
  truncate?: (address: string) => string;
};

function defaultTruncate(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function txId(log: RawLog): string {
  return `${log.transactionHash}#${log.index}`;
}

/**
 * Builds the final Transaction[] from every raw event Qpay's history spans:
 * Paid (both directions), Deposited, Withdrawn, RedemptionRequested — per
 * the task's explicit list. Newest first.
 */
export function buildTransactions(input: BuildTransactionsInput): Transaction[] {
  const me = input.me;
  const truncate = input.truncate ?? defaultTruncate;
  const timestampOf = (blockNumber: number) => input.blockTimestamps.get(blockNumber) ?? 0;
  const rows: Transaction[] = [];

  // ---- redemptions, cross-referenced against a same-tx Deposited refund ----
  // A redemption that only partially fills refunds the unfilled lots back to
  // the ledger in the SAME transaction (QpayGateway.withdrawToXRPL) — that
  // shows up as a Deposited(user=me, asset=FXRP, amount=unfilled) log sharing
  // the redemption's transactionHash. Detecting that (rather than trusting a
  // client-side flag) is how partial fills are told apart from full fills
  // without fabricating anything implementation.md §5.1 didn't actually emit.
  const consumedDepositLogIndices = new Set<string>();

  for (const log of input.redemptions) {
    if (!sameAddress(log.args.user, me)) continue;
    const decimals = input.fxrpDecimals;

    const refund = input.deposited.find(
      (d) =>
        d.transactionHash === log.transactionHash &&
        sameAddress(d.args.user, me) &&
        input.resolveAsset(d.args.asset)?.symbol === 'FXRP',
    );

    const redeemedAmount = fromTokenAmount(log.args.redeemedUBA, decimals);
    let status: TransactionStatus = 'confirmed';
    let ref = '';

    if (refund) {
      consumedDepositLogIndices.add(txId(refund));
      const unfilled = fromTokenAmount(refund.args.amount, decimals);
      const requestedExact = redeemedAmount + unfilled;
      const lotSizeGuess = requestedExact > 0 && redeemedAmount > 0 ? gcdLotGuess(redeemedAmount, unfilled) : null;
      status = 'partial';
      ref = lotSizeGuess
        ? `redeem-${Math.round(redeemedAmount / lotSizeGuess)}of${Math.round(requestedExact / lotSizeGuess)}lots`
        : `redeem-partial-${redeemedAmount}of${requestedExact}`;
    } else {
      ref = `redeem-${redeemedAmount}lots`;
    }

    rows.push({
      id: txId(log),
      direction: 'egress',
      counterparty: log.args.xrplAddress,
      asset: 'FXRP',
      amount: redeemedAmount,
      status,
      timestamp: timestampOf(log.blockNumber),
      ref,
      txHash: log.transactionHash,
      blockExplorerUrl: input.explorerUrl(log.transactionHash),
      blockNumber: log.blockNumber,
    });
  }

  // ---- Paid: both 'sent' (from === me) and 'received' (to === me) ----
  for (const log of input.paid) {
    const { from, to, assetIn, amountIn, assetOut, amountOut, ref } = log.args;
    const isSent = sameAddress(from, me);
    const isReceived = !isSent && sameAddress(to, me);
    if (!isSent && !isReceived) continue;

    if (isSent) {
      const assetInInfo = input.resolveAsset(assetIn);
      const assetOutInfo = input.resolveAsset(assetOut);
      if (!assetInInfo) continue; // unrecognized token — TOKENS config is out of date; skip rather than fabricate a symbol.
      const contact = input.resolveContact(to);
      const crossAsset = assetIn.toLowerCase() !== assetOut.toLowerCase();
      rows.push({
        id: txId(log),
        direction: 'sent',
        counterparty: contact?.name ?? truncate(to),
        counterpartyId: contact?.id,
        counterpartyAddress: to,
        asset: assetInInfo.symbol,
        amount: fromTokenAmount(amountIn, assetInInfo.decimals),
        assetOut: crossAsset && assetOutInfo ? assetOutInfo.symbol : undefined,
        amountOut: crossAsset && assetOutInfo ? fromTokenAmount(amountOut, assetOutInfo.decimals) : undefined,
        status: 'confirmed',
        timestamp: timestampOf(log.blockNumber),
        ref: fromBytes32Ref(ref),
        txHash: log.transactionHash,
        blockExplorerUrl: input.explorerUrl(log.transactionHash),
        blockNumber: log.blockNumber,
      });
    } else {
      const assetOutInfo = input.resolveAsset(assetOut);
      if (!assetOutInfo) continue;
      const contact = input.resolveContact(from);
      rows.push({
        id: txId(log),
        direction: 'received',
        counterparty: contact?.name ?? truncate(from),
        counterpartyId: contact?.id,
        counterpartyAddress: from,
        asset: assetOutInfo.symbol,
        amount: fromTokenAmount(amountOut, assetOutInfo.decimals),
        status: 'confirmed',
        timestamp: timestampOf(log.blockNumber),
        ref: fromBytes32Ref(ref),
        txHash: log.transactionHash,
        blockExplorerUrl: input.explorerUrl(log.transactionHash),
        blockNumber: log.blockNumber,
      });
    }
  }

  // ---- Deposited (raw deposit() ingress), excluding redemption refunds already folded above ----
  for (const log of input.deposited) {
    if (!sameAddress(log.args.user, me)) continue;
    if (consumedDepositLogIndices.has(txId(log))) continue;
    const assetInfo = input.resolveAsset(log.args.asset);
    if (!assetInfo) continue;
    rows.push({
      id: txId(log),
      direction: 'ingress',
      counterparty: 'Wallet deposit',
      asset: assetInfo.symbol,
      amount: fromTokenAmount(log.args.amount, assetInfo.decimals),
      status: 'confirmed',
      timestamp: timestampOf(log.blockNumber),
      ref: `deposit-${txId(log)}`,
      txHash: log.transactionHash,
      blockExplorerUrl: input.explorerUrl(log.transactionHash),
      blockNumber: log.blockNumber,
    });
  }

  // ---- Withdrawn (raw withdraw() back to the user's own wallet balance) ----
  for (const log of input.withdrawn) {
    if (!sameAddress(log.args.user, me)) continue;
    const assetInfo = input.resolveAsset(log.args.asset);
    if (!assetInfo) continue;
    rows.push({
      id: txId(log),
      direction: 'egress',
      counterparty: 'Withdrawn to your wallet',
      asset: assetInfo.symbol,
      amount: fromTokenAmount(log.args.amount, assetInfo.decimals),
      status: 'confirmed',
      timestamp: timestampOf(log.blockNumber),
      ref: `withdraw-${txId(log)}`,
      txHash: log.transactionHash,
      blockExplorerUrl: input.explorerUrl(log.transactionHash),
      blockNumber: log.blockNumber,
    });
  }

  rows.sort((a, b) => b.timestamp - a.timestamp);
  return rows;
}

/**
 * Best-effort recovery of the lot size from a partial fill's own numbers
 * (redeemed and refunded amounts are always whole multiples of the real lot
 * size), so the display ref can say "Xof Ylots" without qpayService having
 * to thread the live lotSize() read through this pure module too. Falls
 * back to null (caller shows a plain fraction) if it can't find a clean fit.
 */
function gcdLotGuess(redeemed: number, refunded: number): number | null {
  const scale = 1_000_000; // FXRP is 6dp; work in integer "micro-FXRP" to avoid float GCD issues.
  let a = Math.round(redeemed * scale);
  let b = Math.round(refunded * scale);
  if (a <= 0 || b <= 0) return null;
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a > 0 ? a / scale : null;
}
