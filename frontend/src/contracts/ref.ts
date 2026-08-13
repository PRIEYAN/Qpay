import { ethers } from 'ethers';

/**
 * `QpayLedger.pay(to, amount, ref)` takes `ref` as `bytes32`. UI-level refs
 * are short human strings ("send-1755000000000", "INV42"). Encode with
 * `encodeBytes32String` when the ref fits its hard 31-UTF8-byte limit;
 * otherwise fall back to a keccak256 digest, which is still a stable,
 * collision-resistant bytes32 but is one-way — `fromBytes32Ref` reports that
 * case as raw hex rather than fabricating text that was never there.
 */
export function toBytes32Ref(ref: string): string {
  const trimmed = ref ?? '';
  try {
    return ethers.encodeBytes32String(trimmed);
  } catch {
    return ethers.keccak256(ethers.toUtf8Bytes(trimmed));
  }
}

/** Best-effort inverse of toBytes32Ref — falls back to the raw hex when the bytes32 isn't decodable text. */
export function fromBytes32Ref(bytes32: string): string {
  try {
    return ethers.decodeBytes32String(bytes32);
  } catch {
    return bytes32;
  }
}
