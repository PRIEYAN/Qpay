/**
 * Canonical parser/builder for the `qpay:` URI scheme (docs/plan.md §5.5).
 *
 *   qpay:arjun                          — static merchant QR, no amount
 *   qpay:arjun?amount=250&ref=INV42     — dynamic invoice QR
 *   qpay:arjun?amount=250&ref=INV42&exp=1755000000000
 *
 * This is the single source of truth for the scheme: the QR scanner screen
 * should import parseQpayUri from here rather than re-implementing it.
 */

export type QpayUri = {
  /** Everything between `qpay:` and the first `?` — a bare username or a full "name@qpay" id. */
  qpayId: string;
  amount?: number;
  ref?: string;
  /** ms epoch. */
  expiry?: number;
};

export type BuildQpayUriInput = {
  qpayId: string;
  amount?: number;
  ref?: string;
  /** ms epoch. */
  expiry?: number;
};

const SCHEME = 'qpay:';

function parseQueryString(qs: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!qs) return result;
  for (const pair of qs.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawValue = eq === -1 ? '' : pair.slice(eq + 1);
    if (!rawKey) continue;
    try {
      const key = decodeURIComponent(rawKey);
      const value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
      result[key] = value;
    } catch {
      // Malformed percent-encoding — skip this pair rather than throwing.
    }
  }
  return result;
}

/**
 * Parses a `qpay:` URI. Returns null when the input isn't a qpay URI at all
 * (wrong scheme, empty id) rather than throwing, so callers (e.g. the QR
 * scanner) can cleanly fall back to "not a Qpay code."
 */
export function parseQpayUri(uri: string): QpayUri | null {
  if (typeof uri !== 'string') return null;
  const trimmed = uri.trim();
  if (trimmed.toLowerCase().slice(0, SCHEME.length) !== SCHEME) return null;

  const rest = trimmed.slice(SCHEME.length);
  const qIndex = rest.indexOf('?');
  const idPart = qIndex === -1 ? rest : rest.slice(0, qIndex);
  const queryPart = qIndex === -1 ? '' : rest.slice(qIndex + 1);

  let qpayId: string;
  try {
    qpayId = decodeURIComponent(idPart).trim();
  } catch {
    qpayId = idPart.trim();
  }
  if (!qpayId) return null;

  const result: QpayUri = { qpayId };
  const params = parseQueryString(queryPart);

  if (params.amount !== undefined) {
    const amount = Number(params.amount);
    if (!Number.isNaN(amount)) result.amount = amount;
  }
  if (params.ref) result.ref = params.ref;
  if (params.exp !== undefined) {
    const expiry = Number(params.exp);
    if (!Number.isNaN(expiry)) result.expiry = expiry;
  }

  return result;
}

/** Builds a `qpay:` URI. Inverse of parseQpayUri. */
export function buildQpayUri(input: BuildQpayUriInput): string {
  const qpayId = input.qpayId.trim();
  const parts: string[] = [];

  if (input.amount !== undefined) {
    parts.push(`amount=${encodeURIComponent(String(input.amount))}`);
  }
  if (input.ref) {
    parts.push(`ref=${encodeURIComponent(input.ref)}`);
  }
  if (input.expiry !== undefined) {
    parts.push(`exp=${encodeURIComponent(String(input.expiry))}`);
  }

  const query = parts.length > 0 ? `?${parts.join('&')}` : '';
  return `${SCHEME}${encodeURIComponent(qpayId).replace(/%40/g, '@')}${query}`;
}
