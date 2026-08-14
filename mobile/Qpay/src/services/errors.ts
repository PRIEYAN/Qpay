import { PrimaryAsset } from './types';

/** Base class for every typed error the Qpay service layer can throw. */
export class QpayServiceError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'QpayServiceError';
    this.code = code;
    // Restore prototype chain (TS -> ES5 lib target compiled via Babel/Metro quirk).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InsufficientBalanceError extends QpayServiceError {
  asset: PrimaryAsset;
  requested: number;
  available: number;

  constructor(asset: PrimaryAsset, requested: number, available: number) {
    super(
      'INSUFFICIENT_BALANCE',
      `Insufficient ${asset} balance: requested ${requested}, available ${available}`,
    );
    this.name = 'InsufficientBalanceError';
    this.asset = asset;
    this.requested = requested;
    this.available = available;
  }
}

export class BelowLotSizeError extends QpayServiceError {
  amount: number;
  lotSize: number;

  constructor(amount: number, lotSize: number) {
    super(
      'BELOW_LOT_SIZE',
      `Redemption amount ${amount} is below the minimum lot size of ${lotSize}`,
    );
    this.name = 'BelowLotSizeError';
    this.amount = amount;
    this.lotSize = lotSize;
  }
}

export class InvalidAmountError extends QpayServiceError {
  constructor(message = 'Amount must be greater than zero') {
    super('INVALID_AMOUNT', message);
    this.name = 'InvalidAmountError';
  }
}

export class PaymentRequestNotFoundError extends QpayServiceError {
  requestId: string;

  constructor(requestId: string) {
    super('PAYMENT_REQUEST_NOT_FOUND', `Payment request "${requestId}" not found`);
    this.name = 'PaymentRequestNotFoundError';
    this.requestId = requestId;
  }
}

export class PaymentRequestNotOpenError extends QpayServiceError {
  requestId: string;

  constructor(requestId: string) {
    super('PAYMENT_REQUEST_NOT_OPEN', `Payment request "${requestId}" is not open`);
    this.name = 'PaymentRequestNotOpenError';
    this.requestId = requestId;
  }
}

/** No wallet connected — thrown by any read/write that needs to know "who is the current user." */
export class NotConnectedError extends QpayServiceError {
  constructor(message = 'Connect a wallet to continue.') {
    super('NOT_CONNECTED', message);
    this.name = 'NotConnectedError';
  }
}

/** Wallet is connected, but not to Coston2 (chainId 114) — thrown before submitting a transaction. */
export class WrongNetworkError extends QpayServiceError {
  chainId: number | null;

  constructor(chainId: number | null, message?: string) {
    super(
      'WRONG_NETWORK',
      message ?? `Wrong network (chainId ${chainId ?? 'unknown'}). Switch to Flare Coston2 (114).`,
    );
    this.name = 'WrongNetworkError';
    this.chainId = chainId;
  }
}

/** Contracts (or a required token) aren't deployed/configured yet — see src/config/network.ts. */
export class NotConfiguredError extends QpayServiceError {
  constructor(message = 'Qpay is not configured — contract addresses are missing.') {
    super('NOT_CONFIGURED', message);
    this.name = 'NotConfiguredError';
  }
}

/**
 * `pay()`'s recipient string wasn't a valid 0x address and didn't match any
 * locally-saved contact. There is no on-chain username registry to fall back
 * to (implementation.md), so this is a hard stop rather than a guess.
 */
export class UnknownRecipientError extends QpayServiceError {
  recipient: string;

  constructor(recipient: string) {
    super(
      'UNKNOWN_RECIPIENT',
      `"${recipient}" isn't a wallet address and isn't a saved contact. Ask them for their ` +
        'Qpay address, or add them as a contact first.',
    );
    this.name = 'UnknownRecipientError';
    this.recipient = recipient;
  }
}

/** The user's (or a counterparty's) primaryAsset hasn't been set on QpayLedger yet. */
export class PrimaryAssetNotSetError extends QpayServiceError {
  address: string;

  constructor(address: string) {
    super(
      'PRIMARY_ASSET_NOT_SET',
      `${address} hasn't chosen a primary asset on QpayLedger yet (setPrimaryAsset).`,
    );
    this.name = 'PrimaryAssetNotSetError';
    this.address = address;
  }
}

/** A contract returned/holds a token address this app's TOKENS config doesn't recognize. */
export class UnknownAssetError extends QpayServiceError {
  address: string;

  constructor(address: string) {
    super('UNKNOWN_ASSET', `Asset ${address} isn't one of Qpay's configured tokens (TOKENS).`);
    this.name = 'UnknownAssetError';
    this.address = address;
  }
}

export class ContactNotFoundError extends QpayServiceError {
  contactId: string;

  constructor(contactId: string) {
    super('CONTACT_NOT_FOUND', `Contact "${contactId}" not found`);
    this.name = 'ContactNotFoundError';
    this.contactId = contactId;
  }
}
