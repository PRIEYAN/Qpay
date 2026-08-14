import { buildQpayUri, parseQpayUri } from '../src/utils/qpayUri';

describe('qpay: URI scheme (docs/plan.md §5.5)', () => {
  it('parses a static merchant QR with no amount', () => {
    const parsed = parseQpayUri('qpay:arjun');
    expect(parsed).toEqual({ qpayId: 'arjun' });
  });

  it('parses a dynamic invoice QR with amount + ref', () => {
    const parsed = parseQpayUri('qpay:arjun?amount=250&ref=INV42');
    expect(parsed?.qpayId).toBe('arjun');
    expect(parsed?.amount).toBe(250);
    expect(parsed?.ref).toBe('INV42');
  });

  it('parses an expiry-bearing URI', () => {
    const parsed = parseQpayUri('qpay:arjun?amount=250&ref=INV42&exp=1755000000000');
    expect(parsed?.expiry).toBe(1755000000000);
  });

  it('returns null for non-qpay input', () => {
    expect(parseQpayUri('https://example.com')).toBeNull();
    expect(parseQpayUri('')).toBeNull();
    expect(parseQpayUri('qpay:')).toBeNull();
  });

  it('round-trips build -> parse for a full dynamic request', () => {
    const input = { qpayId: 'meera@qpay', amount: 42.5, ref: 'INV-99', expiry: 1755000000000 };
    const uri = buildQpayUri(input);
    const parsed = parseQpayUri(uri);
    expect(parsed).toEqual(input);
  });

  it('round-trips build -> parse for a static (amount-less) request', () => {
    const input = { qpayId: 'arjunschai@qpay' };
    const uri = buildQpayUri(input);
    expect(uri).toBe('qpay:arjunschai@qpay');
    expect(parseQpayUri(uri)).toEqual(input);
  });

  it('round-trips a ref containing spaces and special characters', () => {
    const input = { qpayId: 'meera@qpay', amount: 10, ref: 'dinner & drinks #2' };
    const uri = buildQpayUri(input);
    const parsed = parseQpayUri(uri);
    expect(parsed?.ref).toBe('dinner & drinks #2');
    expect(parsed?.qpayId).toBe('meera@qpay');
    expect(parsed?.amount).toBe(10);
  });

  it('omits amount/ref/expiry keys entirely when not provided (does not emit amount=undefined)', () => {
    const uri = buildQpayUri({ qpayId: 'arjun' });
    expect(uri).not.toContain('amount');
    expect(uri).not.toContain('?');
  });
});
