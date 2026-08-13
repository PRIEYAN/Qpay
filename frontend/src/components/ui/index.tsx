import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { Icon, type IconName } from '../icons';
import { useAnimatedNumber, haptic } from '../motion';
import { useTheme } from '../../theme/ThemeProvider';
import './ui.css';

export { Icon };
export type { IconName };

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/* ===========================================================================
   Screen
   =========================================================================== */

/**
 * The app-bar + scrolling body + pinned footer frame every screen sits in.
 * Ported from mobile's `Screen`, minus the `KeyboardAvoidingView` (the
 * browser handles keyboard insets itself) and with safe-area padding moved
 * into CSS `env()`.
 */
export function Screen({
  children,
  title,
  onBack,
  action,
  footer,
  padded = true,
  className,
}: {
  children: ReactNode;
  title?: string;
  onBack?: () => void;
  /** Right-aligned app-bar affordance. */
  action?: ReactNode;
  footer?: ReactNode;
  padded?: boolean;
  className?: string;
}) {
  return (
    <div className={cx('screen', className)}>
      {(title || onBack || action) && (
        <header className="screen__appbar">
          {onBack ? (
            <button type="button" onClick={onBack} aria-label="Back" className="cluster">
              <Icon name="back" size={22} />
            </button>
          ) : null}
          {title ? <span className="t-caption grow">{title}</span> : <span className="grow" />}
          {action}
        </header>
      )}

      <div className={cx('screen__body', padded && 'screen__body--padded')}>{children}</div>

      {footer ? <footer className="screen__footer">{footer}</footer> : null}
    </div>
  );
}

/* ===========================================================================
   Button
   =========================================================================== */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent';

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  icon,
  className,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  loading?: boolean;
  icon?: IconName;
}) {
  return (
    <button
      type="button"
      className={cx('btn', `btn--${variant}`, size === 'lg' && 'btn--lg', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Icon name="loader" size={20} className="m-spinner" />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} /> : null}
          {label}
        </>
      )}
    </button>
  );
}

/* ===========================================================================
   Card
   =========================================================================== */

export function Card({
  children,
  onClick,
  selected,
  variant = 'outlined',
  raised = false,
  padded = true,
  disabled,
  className,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  /** Selected inverts the whole card to filled ink — not a badge or a tint. */
  selected?: boolean;
  variant?: 'outlined' | 'flat';
  raised?: boolean;
  padded?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const classes = cx(
    'card',
    `card--${variant}`,
    padded && 'card--padded',
    raised && 'card--raised',
    selected && 'card--selected',
    className,
  );

  if (!onClick) {
    return (
      <div className={classes} style={style}>
        {children}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      style={style}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
    >
      {children}
    </button>
  );
}

/* ===========================================================================
   Input / SearchBar
   =========================================================================== */

export function Input({
  label,
  amount,
  suffix,
  containerClassName,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  /** Renders the value at amount scale — for the one number that is the screen's subject. */
  amount?: boolean;
  suffix?: string;
  containerClassName?: string;
}) {
  return (
    <div className={containerClassName}>
      {label ? <span className="t-caption field__label">{label}</span> : null}
      <div className="field__box">
        <input
          className={cx('field__input', amount && 'field__input--amount', className)}
          {...rest}
        />
        {suffix ? (
          <span className={amount ? 't-subtitle c-muted' : 't-body-medium c-muted'}>{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder,
  onFocus,
  autoFocus,
  readOnly,
  onClick,
}: {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  autoFocus?: boolean;
  readOnly?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="searchbar" onClick={onClick}>
      <Icon name="search" size={18} />
      <input
        className="searchbar__input"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        onFocus={onFocus}
        autoFocus={autoFocus}
        readOnly={readOnly}
        aria-label={placeholder ?? 'Search'}
      />
      {value && onChange ? (
        <button type="button" onClick={() => onChange('')} aria-label="Clear">
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  );
}

/* ===========================================================================
   Avatar — square, gradient-filled, deterministic per name.
   =========================================================================== */

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

/** Blends two hex colours (opaque RGB mix, not alpha) so the result is correct over any backdrop. */
function mix(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

const GRADIENT_ANGLES = [135, 45, 315, 90];

/**
 * Square-cornered (never circular), filled ink with a paper initial, plus a
 * subtle two-stop gradient whose angle and mix ratio derive from the name —
 * so a list of avatars reads as distinct people rather than identical tiles.
 * Strictly monochrome: both stops are mixes of ink/paper, never the accent.
 */
export function Avatar({
  name,
  size = 44,
  inverted,
}: {
  name: string;
  size?: number;
  inverted?: boolean;
}) {
  const { theme } = useTheme();
  const base = inverted ? theme.paper : theme.ink;
  const opposite = inverted ? theme.ink : theme.paper;
  const fg = inverted ? theme.ink : theme.paper;

  const hash = hashName(name || '?');
  const angle = GRADIENT_ANGLES[hash % GRADIENT_ANGLES.length];
  const mixRatio = 0.14 + ((hash >> 4) % 17) / 100;

  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(${angle}deg, ${base}, ${mix(base, opposite, mixRatio)})`,
        color: fg,
        fontSize: size * 0.4,
      }}
      aria-hidden
    >
      <span className="avatar__initial">{(name || '?').slice(0, 1).toUpperCase()}</span>
    </div>
  );
}

/* ===========================================================================
   Rows
   =========================================================================== */

export function ListRow({
  title,
  subtitle,
  value,
  valueSuffix,
  meta,
  onClick,
  showAvatar = true,
  leading,
}: {
  title: string;
  subtitle?: string;
  /** Signed amount string, e.g. "-18.46". Sign carries the direction, not colour. */
  value?: string;
  valueSuffix?: string;
  meta?: ReactNode;
  onClick?: () => void;
  showAvatar?: boolean;
  leading?: ReactNode;
}) {
  const content = (
    <>
      {leading ?? (showAvatar ? <Avatar name={title} size={40} /> : null)}
      <div className="row__text">
        <span className="t-body-medium truncate">{title}</span>
        {subtitle ? <span className="t-label c-muted truncate">{subtitle}</span> : null}
        {meta}
      </div>
      {value ? (
        <div className="row__value">
          <span className="t-body-medium">{value}</span>
          {valueSuffix ? <span className="t-micro c-muted">{valueSuffix}</span> : null}
        </div>
      ) : null}
    </>
  );

  if (!onClick) return <div className="row">{content}</div>;
  return (
    <button type="button" className="row" onClick={onClick}>
      {content}
    </button>
  );
}

/** Generic label/value row — profile details, settings entries. */
export function Row({
  label,
  value,
  icon,
  onClick,
  danger,
}: {
  label: string;
  value?: string;
  icon?: IconName;
  onClick?: () => void;
  danger?: boolean;
}) {
  const content = (
    <>
      {icon ? <Icon name={icon} size={18} className="c-muted" /> : null}
      <span className={cx('t-body grow truncate', danger && 'c-danger')}>{label}</span>
      <span className="row__right">
        {value ? <span className="t-body-medium truncate">{value}</span> : null}
        {onClick ? <Icon name="chevronRight" size={18} /> : null}
      </span>
    </>
  );

  if (!onClick) return <div className="row">{content}</div>;
  return (
    <button type="button" className="row" onClick={onClick}>
      {content}
    </button>
  );
}

export function Divider() {
  return <hr className="divider" />;
}

/* ===========================================================================
   Labels, tags, empty states
   =========================================================================== */

export function SectionLabel({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <div className="section-label">
      <span className="t-caption">{children}</span>
      {action}
    </div>
  );
}

export function StatusTag({
  label,
  emphasis = 'outline',
  tone = 'neutral',
}: {
  label: string;
  /** `solid` reads as "settled/final", `outline` as "in progress". */
  emphasis?: 'solid' | 'outline';
  tone?: 'neutral' | 'success' | 'danger';
}) {
  return (
    <span
      className={cx('status-tag', `status-tag--${tone}`, emphasis === 'solid' && 'status-tag--solid')}
    >
      <span>{label}</span>
    </span>
  );
}

export function EmptyState({
  icon = 'info',
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <Icon name={icon} size={24} />
      </div>
      <span className="t-subtitle">{title}</span>
      {body ? <span className="t-body c-muted">{body}</span> : null}
      {action ? <div style={{ marginTop: 'var(--space-md)', width: '100%' }}>{action}</div> : null}
    </div>
  );
}

export function Skeleton({
  width,
  height = 16,
  className,
  style,
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cx('m-skeleton', className)}
      style={{ width: width ?? '100%', height, ...style }}
      aria-hidden
    />
  );
}

/* ===========================================================================
   AmountDisplay
   =========================================================================== */

/**
 * The number *is* the hierarchy — no small-caption-plus-big-number trick.
 * Integer and fractional parts split so the decimals drop to muted weight,
 * and the value rolls to a new figure instead of snapping: the single
 * biggest "is this live data" tell in the app.
 */
export function AmountDisplay({
  value,
  asset,
  caption,
  size = 'amount',
  decimals = 2,
}: {
  value: number | null;
  asset: string;
  caption?: string;
  size?: 'display' | 'amount';
  decimals?: number;
}) {
  const animated = useAnimatedNumber(value ?? 0);
  const [whole, fraction] = value === null ? ['—', null] : animated.toFixed(decimals).split('.');

  return (
    <div className="amount">
      <div className="amount__row">
        <span className={size === 'display' ? 't-display' : 't-amount'}>
          {whole}
          {fraction ? <span className="c-muted">.{fraction}</span> : null}
        </span>
        {asset ? <span className="t-subtitle amount__asset">{asset}</span> : null}
      </div>
      {caption ? <span className="t-caption amount__caption">{caption}</span> : null}
    </div>
  );
}

/* ===========================================================================
   ActionTile / ContactChip
   =========================================================================== */

export function ActionTile({
  icon,
  label,
  onClick,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="action-tile" onClick={onClick} aria-label={label}>
      <Icon name={icon} size={22} />
      <span className="action-tile__label">{label}</span>
    </button>
  );
}

export function ContactChip({
  name,
  subtitle,
  onClick,
}: {
  name: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="chip" onClick={onClick} aria-label={name}>
      <Avatar name={name} size={56} />
      <span className="t-label chip__name truncate">{name}</span>
      {subtitle ? <span className="t-micro c-muted truncate chip__name">{subtitle}</span> : null}
    </button>
  );
}

/* ===========================================================================
   SegmentedControl
   =========================================================================== */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const width = options.length > 0 ? 100 / options.length : 100;

  return (
    <div className="segmented" role="tablist">
      <div
        className="segmented__indicator"
        style={{ width: `${width}%`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className="segmented__option"
          onClick={() => {
            haptic('select');
            onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ===========================================================================
   KeypadNumeric
   =========================================================================== */

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

/**
 * GPay-style numeric keypad — 3x4 grid, square keys. Press inverts the key
 * to filled ink rather than tinting it, paired with a haptic tick: this is a
 * payments app and the keypad is touched more than anything else in it.
 *
 * The web build also accepts real keyboard input, which the mobile original
 * had no equivalent for — a desktop user should be able to just type.
 */
export function KeypadNumeric({
  value,
  onChange,
  maxDecimals = 2,
}: {
  value: string;
  onChange: (value: string) => void;
  maxDecimals?: number;
}) {
  const apply = useRef<(key: string) => void>(() => {});

  apply.current = (key: string) => {
    haptic('tap');
    if (key === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (value.includes('.')) return;
      onChange(value.length ? `${value}.` : '0.');
      return;
    }
    if (value.includes('.')) {
      const decimals = value.split('.')[1] ?? '';
      if (decimals.length >= maxDecimals) return;
    }
    onChange(value === '0' ? key : value + key);
  };

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Don't hijack typing in a real text field (e.g. the note input).
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (/^[0-9]$/.test(e.key)) apply.current(e.key);
      else if (e.key === '.' || e.key === ',') apply.current('.');
      else if (e.key === 'Backspace') apply.current('back');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);

  return (
    <div className="keypad" role="group" aria-label="Amount keypad">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className="keypad__key"
          onClick={() => apply.current(key)}
          aria-label={key === 'back' ? 'Delete' : key === '.' ? 'Decimal point' : key}
        >
          {key === 'back' ? <Icon name="backspace" size={22} /> : key}
        </button>
      ))}
    </div>
  );
}

/* ===========================================================================
   Sheet
   =========================================================================== */

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  // Escape closes, and the page behind never scrolls while a sheet is up.
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handle);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handle);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="sheet__backdrop" onClick={onClose} aria-hidden />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        {title ? (
          <div className="sheet__header">
            <span className="t-caption">{title}</span>
            <button type="button" onClick={onClose} aria-label="Close">
              <Icon name="close" size={20} />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </>
  );
}

/* ===========================================================================
   Toast / Notice
   =========================================================================== */

export function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="toast t-body" role="status" aria-live="polite">
      {message}
    </div>
  );
}

export function Notice({
  message,
  tone = 'neutral',
  icon = 'alert',
}: {
  message: string;
  tone?: 'neutral' | 'danger' | 'accent';
  icon?: IconName;
}) {
  return (
    <div className={cx('notice', tone !== 'neutral' && `notice--${tone}`)} role="alert">
      <Icon name={icon} size={16} />
      <span className="t-label notice__text">{message}</span>
    </div>
  );
}

/* ===========================================================================
   Copy affordance — used by Request, Profile, TransactionDetail.
   =========================================================================== */

/** Copies `text` and reports a transient "copied" flag for UI feedback. */
export function useCopy(resetMs = 1500): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useMemo(
    () => (text: string) => {
      haptic('select');
      const done = () => {
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), resetMs);
      };
      // `navigator.clipboard` needs a secure context; fall back to the
      // legacy execCommand path so this still works over plain http on a LAN.
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
      } else {
        fallbackCopy(text, done);
      }
    },
    [resetMs],
  );

  return [copied, copy];
}

function fallbackCopy(text: string, done: () => void) {
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  try {
    document.execCommand('copy');
    done();
  } catch {
    // Clipboard genuinely unavailable — the value is still on screen to
    // select manually, so this is not worth surfacing as an error.
  }
  document.body.removeChild(el);
}
