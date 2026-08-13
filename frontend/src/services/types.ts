/**
 * Domain model for the Qpay data/state layer.
 *
 * These types are consumed directly by screens (via useQpayContext()'s
 * `snapshot` and the src/hooks/* wrappers), so their shape is load-bearing —
 * changing a field name/type here ripples into screens this task doesn't
 * own. See src/services/qpayService.ts for exactly which on-chain call (or,
 * where there is no on-chain analogue — contacts, businesses, payment
 * requests — which local-storage record) backs each field.
 */

/**
 * The three assets a Qpay user can hold as their "primary chain"
 * (implementation.md §3). 'FLR' is the UI-facing symbol for the wrapped
 * WFLR ERC-20 the ledger actually custodies — see src/contracts/assets.ts.
 */
export type PrimaryAsset = 'FXRP' | 'FLR' | 'USDT0';

export const PRIMARY_ASSETS: readonly PrimaryAsset[] = ['FXRP', 'FLR', 'USDT0'];

export type TransactionDirection = 'sent' | 'received' | 'ingress' | 'egress';

/** 'partial' = a redemption that only filled some of its requested lots. */
export type TransactionStatus = 'confirmed' | 'pending' | 'partial' | 'failed';

export type Transaction = {
  /** Stable, unique, and reconstructible: `${txHash}#${logIndex}` for every chain-sourced row. */
  id: string;
  direction: TransactionDirection;
  /** Display name of the counterparty (a saved contact's name, or a truncated chain address). */
  counterparty: string;
  /** Id of the matched local Contact, when the counterparty was resolvable. Undefined otherwise. */
  counterpartyId?: string;
  /** The counterparty's raw wallet address, for sent/received rows — source data for deriving contacts. */
  counterpartyAddress?: string;
  /** Asset debited from (sent/egress) or credited to (received/ingress) *this* user. */
  asset: PrimaryAsset;
  amount: number;
  /** Set only when the payment crossed assets (sender's asset !== recipient's primary asset). */
  assetOut?: PrimaryAsset;
  /** Amount the recipient actually received, in `assetOut`, per the on-chain Paid event. */
  amountOut?: number;
  status: TransactionStatus;
  timestamp: number;
  ref: string;
  note?: string;
  /** Real Flare Coston2 transaction hash. */
  txHash: string;
  blockExplorerUrl: string;
  /** Block the underlying event was emitted in — present for every chain-sourced row. */
  blockNumber?: number;
};

export type ChainBalance = {
  asset: PrimaryAsset;
  label: string;
  balance: number;
  egressLabel: string;
};

export type Balances = Record<PrimaryAsset, number>;

export type Profile = {
  username: string;
  displayName: string;
  /** Single-letter (or short) initial used by square avatar components. */
  avatarInitial: string;
  /** The identifier other users pay you at. There is no on-chain username registry, so this is your wallet address. */
  qpayId: string;
  primaryAsset: PrimaryAsset;
  /** Connected wallet's EVM address (Flare C-chain). Empty string when disconnected. */
  walletAddress: string;
  /** User-supplied XRP Ledger address, for redemption. Empty string until the user sets one. */
  xrplAddress: string;
  onboardingCompleted: boolean;
  walletConnected: boolean;
};

export type Contact = {
  id: string;
  name: string;
  /** The contact's wallet address (this is what `pay()` actually sends to). */
  qpayId: string;
  /** ms epoch of the last payment *you* sent to this contact, or null if never paid — derived from Paid events, or null if this contact has never been paid via this app. */
  lastPaidAt: number | null;
  favourite: boolean;
  avatarInitial: string;
  /**
   * The contact's current on-chain primaryAsset (QpayLedger.primaryAsset),
   * when it could be read. Undefined if unknown/unreadable — callers should
   * fall back to the sender's own asset, as they already do.
   */
  primaryAsset?: PrimaryAsset;
};

export type Business = {
  id: string;
  name: string;
  category: string;
  qpayId: string;
  /** Static merchant QR payload — `qpay:<qpayId>`. */
  staticQrPayload: string;
  primaryAsset?: PrimaryAsset;
};

export type PaymentRequestStatus = 'open' | 'cancelled' | 'paid';

/**
 * A payment request has no on-chain analogue (QpayLedger has no
 * request/invoice bookkeeping) — it's a local "collect request" record,
 * exactly like a UPI collect request: real user intent, stored on-device,
 * that becomes a real on-chain `pay()` only once someone fulfils it.
 */
export type PaymentRequest = {
  id: string;
  /** Always the current user's qpayId (wallet address) in this single-user local store. */
  fromQpayId: string;
  /** Undefined for a static/open-amount request. */
  amount?: number;
  asset: PrimaryAsset;
  ref?: string;
  note?: string;
  status: PaymentRequestStatus;
  createdAt: number;
  /** ms epoch; undefined = never expires (static request). */
  expiresAt?: number;
  /** Set once a matching real on-chain payment was found for this request's ref. */
  paidTxId?: string;
};

export type CreatePaymentRequestInput = {
  amount?: number;
  asset?: PrimaryAsset;
  ref?: string;
  note?: string;
  /** ms epoch, or a duration in ms from now (see requestMoney docstring). */
  expiresAt?: number;
};

export type TransactionFilter = {
  direction?: TransactionDirection;
  status?: TransactionStatus;
  asset?: PrimaryAsset;
  /** Full-text query over counterparty + note + ref. */
  query?: string;
};

export type PayOptions = {
  note?: string;
};

export type RedeemOptions = {
  /**
   * Dev/demo hook retained for the UI's "simulate a partial fill" toggle
   * (RedeemScreen). Real redemption already handles genuine partial fills
   * (implementation.md §5.1 — agent tickets can run out); this flag has no
   * effect on-chain and is not honoured by the real redeemFxrp() — it is
   * accepted only so the existing call signature keeps compiling. Real
   * partial fills are detected from the transaction receipt, not simulated.
   */
  simulatePartialFill?: boolean;
};

export type QpaySnapshot = {
  profile: Profile;
  balances: Balances;
  contacts: Contact[];
  businesses: Business[];
  transactions: Transaction[];
  paymentRequests: PaymentRequest[];
};
