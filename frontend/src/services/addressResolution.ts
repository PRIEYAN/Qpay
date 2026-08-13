import { ethers } from 'ethers';
import { LocalContact } from './localData';
import { UnknownRecipientError } from './errors';

export type ResolvedRecipient = {
  address: string;
  displayName: string;
  contactId?: string;
};

/**
 * Resolves a pay()/request-target string typed or scanned by the user into a
 * real wallet address. There is no on-chain username registry
 * (implementation.md), so the rule is exactly:
 *   1. A valid `0x…` address is used directly (looked up against local
 *      contacts only to borrow a friendlier display name).
 *   2. Otherwise, match against locally-saved contacts by name or address.
 *   3. Otherwise, throw UnknownRecipientError — never invent an address.
 */
export function resolveRecipient(to: string, contacts: readonly LocalContact[]): ResolvedRecipient {
  const trimmed = (to ?? '').trim();
  if (!trimmed) throw new UnknownRecipientError(to ?? '');

  // Computed before the isAddress check on purpose: ethers types isAddress as
  // `value is string`, so inside the negative branch TS narrows an already-
  // `string` value to `never` and every method on it stops type-checking.
  const needle = trimmed.toLowerCase();

  if (ethers.isAddress(trimmed)) {
    const address = ethers.getAddress(trimmed);
    const contact = contacts.find((c) => sameAddress(c.qpayId, address));
    return { address, displayName: contact?.name ?? address, contactId: contact?.id };
  }

  const contact = contacts.find(
    (c) => c.name.toLowerCase() === needle || c.qpayId.toLowerCase() === needle,
  );
  if (contact && ethers.isAddress(contact.qpayId)) {
    return {
      address: ethers.getAddress(contact.qpayId),
      displayName: contact.name,
      contactId: contact.id,
    };
  }

  throw new UnknownRecipientError(to);
}

function sameAddress(a: string, b: string): boolean {
  try {
    return ethers.getAddress(a) === ethers.getAddress(b);
  } catch {
    return a.toLowerCase() === b.toLowerCase();
  }
}
