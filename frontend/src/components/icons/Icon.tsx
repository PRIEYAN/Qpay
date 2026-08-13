/**
 * Qpay's icon system, ported from mobile. Same public surface —
 * `<Icon name="scan" size={24} />`, same `IconName` union — but built on
 * `lucide-react` rather than `lucide-react-native`.
 *
 * Unlike Metro, Vite/Rollup tree-shakes the package barrel properly, so a
 * plain named import from 'lucide-react' only bundles the icons actually
 * referenced here. No deep subpath imports needed.
 *
 * The colour defaults to `currentColor`, which is the important web-native
 * difference from mobile: an icon inside a element that already sets
 * `color` (a pressed row, a filled button) inherits the correct tint
 * automatically instead of every call site having to thread a theme value.
 */
import {
  Activity,
  ArrowDown,
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Award,
  Banknote,
  Bell,
  Bookmark,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleDollarSign,
  CircleHelp,
  CircleX,
  Clock,
  Coins,
  Copy,
  CreditCard,
  Database,
  Delete,
  Download,
  Ellipsis,
  EllipsisVertical,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  Gift,
  Globe,
  Grid3x3,
  HandCoins,
  Heart,
  House,
  Image as ImageIcon,
  Info,
  Landmark,
  Layers,
  Link2,
  List,
  ListFilter,
  LoaderCircle,
  Lock,
  LockOpen,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Minus,
  Network,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  ScanLine,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Trash2,
  Upload,
  User,
  UserPlus,
  Users,
  Wallet,
  WalletMinimal,
  Wifi,
  WifiOff,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Legacy 34 — one Lucide icon per pre-existing glyph. Do not rename or
// remove any of these; the ported screens depend on this exact set.
// ---------------------------------------------------------------------------
const ICON_MAP = {
  home: House,
  scan: ScanLine,
  send: Send,
  request: HandCoins,
  activity: Activity,
  profile: User,
  chains: Link2,
  search: Search,
  back: ArrowLeft,
  close: X,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  plus: Plus,
  minus: Minus,
  check: Check,
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,
  arrowUpRight: ArrowUpRight,
  arrowDownLeft: ArrowDownLeft,
  wallet: Wallet,
  qr: QrCode,
  copy: Copy,
  share: Share2,
  settings: Settings,
  logout: LogOut,
  contacts: Users,
  bank: Landmark,
  clock: Clock,
  info: Info,
  alert: TriangleAlert,
  camera: Camera,
  flash: Zap,
  refresh: RefreshCw,
  backspace: Delete,

  // --- expanded vocabulary ---------------------------------------------
  bell: Bell,
  star: Star,
  starFilled: Star,
  heart: Heart,
  trendingUp: TrendingUp,
  trendingDown: TrendingDown,
  repeat: RefreshCw,
  arrowLeftRight: ArrowLeftRight,
  creditCard: CreditCard,
  banknote: Banknote,
  coins: Coins,
  gift: Gift,
  receipt: Receipt,
  filter: ListFilter,
  sort: ArrowUpDown,
  moreHorizontal: Ellipsis,
  moreVertical: EllipsisVertical,
  eye: Eye,
  eyeOff: EyeOff,
  lock: Lock,
  unlock: LockOpen,
  shield: Shield,
  checkCircle: CircleCheck,
  xCircle: CircleX,
  alertCircle: CircleAlert,
  helpCircle: CircleHelp,
  externalLink: ExternalLink,
  download: Download,
  upload: Upload,
  trash: Trash2,
  edit: Pencil,
  calendar: Calendar,
  mapPin: MapPin,
  phone: Phone,
  mail: Mail,
  globe: Globe,
  zap: Zap,
  sparkles: Sparkles,
  flame: Flame,
  award: Award,
  target: Target,
  wifi: Wifi,
  wifiOff: WifiOff,
  loader: LoaderCircle,
  chevronLeft: ChevronLeft,
  chevronUp: ChevronUp,
  menu: Menu,
  grid: Grid3x3,
  list: List,
  image: ImageIcon,
  paperclip: Paperclip,
  bookmark: Bookmark,
  userPlus: UserPlus,
  arrowRight: ArrowRight,
  circleDollarSign: CircleDollarSign,
  wallet2: WalletMinimal,
  network: Network,
  layers: Layers,
  database: Database,
} satisfies Record<string, LucideIcon>;

/** Every icon name Qpay knows how to render — autocompletes in editors. */
export type IconName = keyof typeof ICON_MAP;

/**
 * Names that read as "filled/active" glyphs by nature (e.g. a solid star
 * for "favourited") even when the caller doesn't pass `filled` explicitly.
 */
const ALWAYS_FILLED: ReadonlySet<IconName> = new Set<IconName>(['starFilled']);

type Props = {
  name: IconName;
  size?: number;
  /** Defaults to `currentColor` so icons inherit their container's tint. */
  color?: string;
  strokeWidth?: number;
  filled?: boolean;
  className?: string;
};

export function Icon({
  name,
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
  filled = false,
  className,
}: Props) {
  const LucideGlyph = ICON_MAP[name];
  const shouldFill = filled || ALWAYS_FILLED.has(name);

  return (
    <LucideGlyph
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      fill={shouldFill ? color : 'none'}
      className={className}
      aria-hidden
      // Keeps icons from being dragged out of buttons/rows as images.
      style={{ flexShrink: 0 }}
    />
  );
}
