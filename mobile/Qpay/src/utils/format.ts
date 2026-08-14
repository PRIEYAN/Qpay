import { PrimaryAsset } from '../services/types';

const DECIMALS_BY_ASSET: Partial<Record<PrimaryAsset, number>> = {
  FXRP: 4,
  FLR: 2,
  USDT0: 2,
};

const DEFAULT_DECIMALS = 2;

/** Formats an amount with asset-appropriate decimal precision, e.g. `formatAmount(128.4032, 'FXRP')` -> "128.4032 FXRP". */
export function formatAmount(value: number, asset: string, opts?: { decimals?: number }): string {
  const decimals = opts?.decimals ?? DECIMALS_BY_ASSET[asset as PrimaryAsset] ?? DEFAULT_DECIMALS;
  const formatted = Number.isFinite(value) ? value.toFixed(decimals) : '0'.padEnd(decimals + 2, '0');
  return asset ? `${formatted} ${asset}` : formatted;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Formats a ms-epoch timestamp relative to now: "just now", "5m ago", "3h ago", "2d ago", or a short date beyond a week. */
export function formatRelativeTime(ts: number, now: number = Date.now()): string {
  const diff = now - ts;
  if (diff < 0) return 'just now';
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;

  const date = new Date(ts);
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return sameYear ? `${day} ${month}` : `${day} ${month} ${date.getFullYear()}`;
}

/** Truncates a long address/hash for display: `truncateAddress('0x1234...abcd')` -> "0x1234…abcd". */
export function truncateAddress(addr: string, opts?: { prefix?: number; suffix?: number }): string {
  const prefix = opts?.prefix ?? 6;
  const suffix = opts?.suffix ?? 4;
  if (!addr || addr.length <= prefix + suffix + 1) return addr;
  return `${addr.slice(0, prefix)}…${addr.slice(addr.length - suffix)}`;
}
