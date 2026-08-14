/**
 * Qpay QR payload parsing — mobileAppWorkflow.md §2.5.
 *
 * Handles `qpay:username` (static merchant QR) and
 * `qpay:username?amount=250&ref=INV42&exp=...` (dynamic invoice QR).
 *
 * This is a thin adapter over the canonical `qpay:` URI parser at
 * `src/utils/qpayUri.ts` (`parseQpayUri`). It exists so every call site in
 * `src/component/qr` and `src/screens/dashboard/qrScanner` can keep using
 * `parseScannedQpayCode`'s throw-on-invalid contract and this folder's
 * pre-existing field names (`username`, `exp`) without depending on
 * `src/utils` directly.
 */

import { parseQpayUri } from '../../utils/qpayUri';

export type ParsedQpayCode = {
  username: string;
  amount?: number;
  ref?: string;
  exp?: string;
};

export class QpayUriError extends Error {}

/**
 * Parses a scanned/typed `qpay:` URI. Throws {@link QpayUriError} with a
 * user-facing message for anything that isn't a well-formed Qpay code.
 */
export function parseScannedQpayCode(raw: string): ParsedQpayCode {
  const parsed = parseQpayUri(raw);
  if (!parsed) {
    throw new QpayUriError('Not a Qpay code');
  }
  if (parsed.amount !== undefined && !(Number.isFinite(parsed.amount) && parsed.amount > 0)) {
    throw new QpayUriError('Not a Qpay code');
  }

  const result: ParsedQpayCode = { username: parsed.qpayId };
  if (parsed.amount !== undefined) result.amount = parsed.amount;
  if (parsed.ref !== undefined) result.ref = parsed.ref;
  if (parsed.expiry !== undefined) result.exp = String(parsed.expiry);
  return result;
}
