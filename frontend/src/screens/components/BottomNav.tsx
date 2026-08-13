import { NavLink, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../../components/icons';
import { haptic } from '../../components/motion';
import './bottomNav.css';

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/app', label: 'Home', icon: 'home' },
  { to: '/app/chains', label: 'Chains', icon: 'chains' },
  { to: '/app/activity', label: 'Activity', icon: 'activity' },
  { to: '/app/profile', label: 'Profile', icon: 'profile' },
];

/**
 * Google-Pay-shaped bottom bar in the monochrome system: paper bar, 1px top
 * hairline, square hit targets. The active tab is shown by weight and fill
 * alone — never a coloured dot or underline. A square centre "Scan"
 * affordance sits between the two halves of the tab set, mirroring GPay's
 * prominent scan action, and pushes to the scanner route rather than being
 * a tab of its own.
 */
export function BottomNav() {
  const navigate = useNavigate();
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  const renderTab = (tab: (typeof TABS)[number]) => (
    <NavLink
      key={tab.to}
      to={tab.to}
      // `end` on the index route only, so /app/chains doesn't also light up Home.
      end={tab.to === '/app'}
      className="bottom-nav__tab"
      onClick={() => haptic('select')}
    >
      {({ isActive }) => (
        <>
          <Icon name={tab.icon} size={24} strokeWidth={isActive ? 2.25 : 1.75} />
          <span className="t-micro">{tab.label}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <nav className="bottom-nav">
      {left.map(renderTab)}

      <button
        type="button"
        className="bottom-nav__scan"
        aria-label="Scan"
        onClick={() => {
          haptic('scan');
          navigate('/app/scan');
        }}
      >
        <Icon name="scan" size={22} />
      </button>

      {right.map(renderTab)}
    </nav>
  );
}
