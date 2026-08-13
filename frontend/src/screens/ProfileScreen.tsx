import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Card,
  Divider,
  Icon,
  Row,
  Screen,
  SectionLabel,
  Sheet,
  Toast,
  useCopy,
} from '../components/ui';
import { FadeIn, SlideIn, Stagger } from '../components/motion';
import { useQpayContext } from '../context/QpayProvider';
import { CHAIN_ASSET_META } from '../services/qpayService';
import { truncateAddress } from '../utils';
import { ConnectionGate } from './components/ConnectionGate';
import './profile.css';

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { snapshot, error } = useQpayContext();
  const [copied, copy] = useCopy();
  const [helpOpen, setHelpOpen] = useState(false);

  const profile = snapshot?.profile;
  const openRequests = snapshot?.paymentRequests.filter((r) => r.status === 'open').length ?? 0;

  return (
    <Screen title="Profile">
      <div className="stack stack--lg">
        <SlideIn distance={12}>
          <div className="center profile__header">
            <Avatar name={profile?.displayName ?? '?'} size={72} />
            <span className="t-title" style={{ marginTop: 'var(--space-md)' }}>
              {profile?.displayName ?? '—'}
            </span>

            {profile ? (
              <button
                type="button"
                className="cluster profile__id"
                onClick={() => copy(profile.qpayId)}
              >
                <span className="t-body c-muted">{truncateAddress(profile.qpayId)}</span>
                <Icon name="copy" size={16} className="c-muted" />
              </button>
            ) : (
              <span className="t-body c-muted">—</span>
            )}

            {profile ? (
              <button
                type="button"
                className="t-label c-muted profile__address"
                onClick={() => copy(profile.walletAddress)}
              >
                {truncateAddress(profile.walletAddress)} · tap to copy
              </button>
            ) : null}
          </div>
        </SlideIn>

        <FadeIn delay={80}>
          <Card variant="flat" onClick={() => navigate('/app/request')}>
            <span className="cluster" style={{ gap: 'var(--space-md)' }}>
              <Icon name="qr" size={28} />
              <span className="row__text">
                <span className="t-body-medium">Your Qpay code</span>
                <span className="t-label c-muted">Show it to get paid, or share your ID</span>
              </span>
              <Icon name="chevronRight" size={18} className="c-muted" />
            </span>
          </Card>
        </FadeIn>

        <ConnectionGate error={error}>
          <section>
            <SectionLabel>Account</SectionLabel>
            <Card padded={false} style={{ paddingInline: 'var(--space-md)' }}>
              <Stagger interval={40} distance={8}>
                <Row
                  icon="wallet"
                  label="Primary chain"
                  value={profile ? CHAIN_ASSET_META[profile.primaryAsset].label : '—'}
                  onClick={() => navigate('/onboarding/asset')}
                />
                <Divider />
                <Row
                  icon="request"
                  label="Payment requests"
                  value={openRequests > 0 ? `${openRequests} open` : 'None open'}
                  onClick={() => navigate('/app/request')}
                />
                <Divider />
                <Row
                  icon="contacts"
                  label="Contacts"
                  onClick={() => navigate('/app/contacts?mode=send')}
                />
                <Divider />
                <Row icon="settings" label="Settings" onClick={() => navigate('/app/settings')} />
                <Divider />
                <Row icon="info" label="Help" onClick={() => setHelpOpen(true)} />
              </Stagger>
            </Card>
          </section>
        </ConnectionGate>

        <Toast message="Copied" visible={copied} />
      </div>

      <Sheet open={helpOpen} onClose={() => setHelpOpen(false)} title="Help">
        <div className="stack stack--md">
          <p className="t-body">
            Qpay lets you pay in whatever asset you hold and get paid in whatever asset you chose as
            your primary chain. Payments between Qpay users settle instantly and cost nothing.
            Moving value onto or off a real chain is the only slow step, and it is optional.
          </p>
          <p className="t-body c-muted">
            Qpay reads live balances and activity from Flare Coston2. Contacts, businesses and
            payment requests are stored only in this browser. See Settings → About for the current
            setup status.
          </p>
        </div>
      </Sheet>
    </Screen>
  );
}
