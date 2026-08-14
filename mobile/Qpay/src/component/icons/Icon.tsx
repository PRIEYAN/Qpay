import React from 'react';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Qpay's icon system, built on `lucide-react-native` (1768 icons, tree-shaken
 * down to only the ones this app actually uses).
 *
 * Every icon below is imported from its own `lucide-react-native/icons/<kebab>`
 * subpath rather than the package root. Importing from the package root
 * (`import { House } from 'lucide-react-native'`) would statically pull in
 * every one of the 1768 icon modules into the Metro bundle, because the
 * barrel file re-exports all of them and Metro does not tree-shake unused
 * re-exports away. The deep subpath import is resolved through the
 * package's `exports` map (Metro has `unstable_enablePackageExports` on by
 * default and matches the `"react-native"` condition; the project's
 * `tsconfig.json` uses `moduleResolution: "bundler"` with the same custom
 * condition), so only the icons actually imported here end up in the graph.
 *
 * The public surface — `Icon`, `IconName` — is unchanged from the old
 * hand-drawn glyph set: `<Icon name="home" size={24} color={theme.ink} />`
 * still works exactly as before. All 34 legacy names are preserved and now
 * map onto a Lucide icon; everything past that is additive vocabulary for
 * richer UI (badges, filled favourites, status glyphs, etc).
 */

// ---------------------------------------------------------------------------
// Legacy 34 — one Lucide icon per pre-existing glyph. Do not rename or
// remove any of these; 18 files across the app depend on this exact set.
// ---------------------------------------------------------------------------
import House from 'lucide-react-native/icons/house';
import ScanLine from 'lucide-react-native/icons/scan-line';
import Send from 'lucide-react-native/icons/send';
import HandCoins from 'lucide-react-native/icons/hand-coins';
import Activity from 'lucide-react-native/icons/activity';
import User from 'lucide-react-native/icons/user';
import Link2 from 'lucide-react-native/icons/link-2';
import Search from 'lucide-react-native/icons/search';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import X from 'lucide-react-native/icons/x';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import Plus from 'lucide-react-native/icons/plus';
import Minus from 'lucide-react-native/icons/minus';
import Check from 'lucide-react-native/icons/check';
import ArrowUp from 'lucide-react-native/icons/arrow-up';
import ArrowDown from 'lucide-react-native/icons/arrow-down';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import ArrowDownLeft from 'lucide-react-native/icons/arrow-down-left';
import Wallet from 'lucide-react-native/icons/wallet';
import QrCode from 'lucide-react-native/icons/qr-code';
import Copy from 'lucide-react-native/icons/copy';
import Share2 from 'lucide-react-native/icons/share-2';
import Settings from 'lucide-react-native/icons/settings';
import LogOut from 'lucide-react-native/icons/log-out';
import Users from 'lucide-react-native/icons/users';
import Landmark from 'lucide-react-native/icons/landmark';
import Clock from 'lucide-react-native/icons/clock';
import Info from 'lucide-react-native/icons/info';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Camera from 'lucide-react-native/icons/camera';
import Zap from 'lucide-react-native/icons/zap';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Delete from 'lucide-react-native/icons/delete';

// ---------------------------------------------------------------------------
// Expanded vocabulary — additive only. Never remove/rename a legacy name;
// these exist so newer screens don't have to reach for the wrong glyph.
// ---------------------------------------------------------------------------
import Bell from 'lucide-react-native/icons/bell';
import Star from 'lucide-react-native/icons/star';
import Heart from 'lucide-react-native/icons/heart';
import TrendingUp from 'lucide-react-native/icons/trending-up';
import TrendingDown from 'lucide-react-native/icons/trending-down';
import Repeat from 'lucide-react-native/icons/repeat';
import ArrowLeftRight from 'lucide-react-native/icons/arrow-left-right';
import CreditCard from 'lucide-react-native/icons/credit-card';
import Banknote from 'lucide-react-native/icons/banknote';
import Coins from 'lucide-react-native/icons/coins';
import Gift from 'lucide-react-native/icons/gift';
import Receipt from 'lucide-react-native/icons/receipt';
import ListFilter from 'lucide-react-native/icons/list-filter';
import ArrowUpDown from 'lucide-react-native/icons/arrow-up-down';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import EllipsisVertical from 'lucide-react-native/icons/ellipsis-vertical';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Lock from 'lucide-react-native/icons/lock';
import LockOpen from 'lucide-react-native/icons/lock-open';
import Shield from 'lucide-react-native/icons/shield';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CircleX from 'lucide-react-native/icons/circle-x';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import CircleQuestionMark from 'lucide-react-native/icons/circle-question-mark';
import ExternalLink from 'lucide-react-native/icons/external-link';
import Download from 'lucide-react-native/icons/download';
import Upload from 'lucide-react-native/icons/upload';
import Trash2 from 'lucide-react-native/icons/trash-2';
import Pencil from 'lucide-react-native/icons/pencil';
import Calendar from 'lucide-react-native/icons/calendar';
import MapPin from 'lucide-react-native/icons/map-pin';
import Phone from 'lucide-react-native/icons/phone';
import Mail from 'lucide-react-native/icons/mail';
import Globe from 'lucide-react-native/icons/globe';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Flame from 'lucide-react-native/icons/flame';
import Award from 'lucide-react-native/icons/award';
import Target from 'lucide-react-native/icons/target';
import Wifi from 'lucide-react-native/icons/wifi';
import WifiOff from 'lucide-react-native/icons/wifi-off';
import LoaderCircle from 'lucide-react-native/icons/loader-circle';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import Menu from 'lucide-react-native/icons/menu';
import Grid3x3 from 'lucide-react-native/icons/grid-3x3';
import List from 'lucide-react-native/icons/list';
import ImageIcon from 'lucide-react-native/icons/image';
import Paperclip from 'lucide-react-native/icons/paperclip';
import Bookmark from 'lucide-react-native/icons/bookmark';
import UserPlus from 'lucide-react-native/icons/user-plus';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import CircleDollarSign from 'lucide-react-native/icons/circle-dollar-sign';
import WalletMinimal from 'lucide-react-native/icons/wallet-minimal';
import Network from 'lucide-react-native/icons/network';
import Layers from 'lucide-react-native/icons/layers';
import Database from 'lucide-react-native/icons/database';

/**
 * The map from name to Lucide component. Exported so any consumer that
 * wants the raw component (e.g. to compose it into something Icon's props
 * don't cover) doesn't have to duplicate this table.
 *
 * Every value here has the exact same shape
 * (`ForwardRefExoticComponent<LucideProps & RefAttributes<SVGSVGElement>>`),
 * so `typeof House` below is a valid stand-in type for "any Lucide icon
 * component", not just House specifically.
 */
export const ICON_MAP = {
  // --- legacy 34 -------------------------------------------------------
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
  repeat: Repeat,
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
  helpCircle: CircleQuestionMark,
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
} satisfies Record<string, typeof House>;

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
  color?: string;
  strokeWidth?: number;
  /**
   * Renders a solid glyph (`fill` = the resolved color) instead of an
   * outline. Useful for active tab/nav states, a favourited star, a
   * selected bookmark, etc. Lucide doesn't ship separate filled
   * components for most glyphs, so this emulates "filled" by filling the
   * same outline path rather than swapping icons.
   */
  filled?: boolean;
};

/** `<Icon name="scan" size={24} color={theme.ink} />` — defaults to the current theme's ink. */
export function Icon({ name, size = 24, color, strokeWidth = 2, filled = false }: Props) {
  const theme = useTheme();
  const tint = color ?? theme.ink;
  const LucideIcon = ICON_MAP[name];
  const shouldFill = filled || ALWAYS_FILLED.has(name);

  return (
    <LucideIcon
      size={size}
      color={tint}
      strokeWidth={strokeWidth}
      fill={shouldFill ? tint : 'none'}
    />
  );
}
