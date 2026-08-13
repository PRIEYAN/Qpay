import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/icons';
import { Sheet, Notice } from '../../components/ui';
import { haptic } from '../../components/motion';
import { useWallet, METAMASK_DOWNLOAD_URL, type DiscoveredWallet } from '../../web3';
import './onboarding.css';

/**
 * The landing/onboarding surface — the one screen in the app that is
 * marketing rather than product, so it deliberately breaks out of the
 * phone-column shell and owns its own colour field (deep green ground,
 * oversized display wordmark, orange facets) per the provided reference.
 *
 * Everything past the fold is a live preview of the real app rather than a
 * screenshot: the device frame below renders actual markup, so it can never
 * drift out of date with the product the way an exported image would.
 */
export default function OnBoardingScreen() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updateVisible, setUpdateVisible] = useState(true);

  const openPicker = () => {
    haptic('select');
    setError(null);
    setPickerOpen(true);
  };

  const handleConnect = async (target?: DiscoveredWallet) => {
    setError(null);
    setConnecting(target?.info.uuid ?? 'default');
    try {
      await wallet.connect(target);
      haptic('success');
      setPickerOpen(false);
      // A connected wallet still has to choose what it wants to hold before
      // the dashboard means anything, so onboarding continues there.
      navigate('/onboarding/asset', { replace: true });
    } catch (e) {
      haptic('warning');
      setError(e instanceof Error ? e.message : 'Could not connect a wallet.');
    } finally {
      setConnecting(null);
    }
  };

  const hasWallets = wallet.available.length > 0;

  return (
    <div className="onboarding">
      <div className="onboarding__inner">
        <nav className="ob-nav">
          <div className="ob-wordmark">
            <span>Q</span>
            <span>pay</span>
          </div>
          <div className="ob-nav__actions">
            <button type="button" className="ob-pill" onClick={openPicker}>
              Get started
            </button>
            <button
              type="button"
              className="ob-pill ob-pill--icon"
              aria-label="Menu"
              onClick={openPicker}
            >
              <Icon name="menu" size={20} />
            </button>
          </div>
        </nav>

        <header className="ob-hero">
          <h1 className="ob-hero__title">
            <em>Where</em>
            <em>your money</em>
            <em>lives</em>
          </h1>

          <p className="ob-hero__sub">
            Hold what you want. Get paid in it automatically. Every payment settles on Flare in about
            two seconds — no bridge to think about, no chain to pick.
          </p>

          <div className="ob-hero__cta">
            <button type="button" className="ob-pill ob-pill--light" onClick={openPicker}>
              Get started
            </button>
          </div>

          <p className="ob-hero__note">
            {hasWallets
              ? 'Connect the wallet you already use.'
              : 'Requires a browser wallet such as MetaMask.'}
          </p>

          <div className="ob-facets" aria-hidden>
            <span className="ob-facet ob-facet--left-dark" />
            <span className="ob-facet ob-facet--left" />
            <span className="ob-facet ob-facet--right-dark" />
            <span className="ob-facet ob-facet--right" />
          </div>
        </header>

        <section className="ob-showcase">
          <div className="ob-showcase__heading">
            <h2>Everything you hold, in one balance</h2>
            <p>
              Your spendable balance, your assets and every payment you've made — live from the
              chain, never a cached guess.
            </p>
          </div>

          <PhonePreview />

          <div className="ob-props">
            <Prop
              icon="send"
              title="Pay in what you hold"
              body="Send from the balance you already have. No swap screen, no chain to pick."
            />
            <Prop
              icon="arrowDownLeft"
              title="Get paid in what you want"
              body="Every payment you receive lands as the asset you chose, converted automatically."
            />
            <Prop
              icon="zap"
              title="Instant, always"
              body="Payments settle in about two seconds. Cashing out is the only slow step, and it's optional."
            />
          </div>
        </section>

        <footer className="ob-footer">
          <span>Qpay · Flare Coston2 testnet</span>
          <span>Non-custodial — your keys stay in your wallet.</span>
        </footer>
      </div>

      {updateVisible ? (
        <div className="ob-update" role="status">
          <span className="ob-update__tag">Update</span>
          <span className="ob-update__text">
            Redeem FXRP straight to an XRP Ledger address from your wallet.
          </span>
          <button
            type="button"
            className="ob-update__close"
            aria-label="Dismiss"
            onClick={() => setUpdateVisible(false)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ) : null}

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Connect a wallet">
        {error ? <Notice message={error} tone="danger" /> : null}

        {hasWallets ? (
          <div className="ob-wallets">
            {wallet.available.map((w) => (
              <button
                key={w.info.uuid}
                type="button"
                className="ob-wallet"
                onClick={() => void handleConnect(w)}
                disabled={connecting !== null}
              >
                {w.info.icon ? (
                  <img className="ob-wallet__icon" src={w.info.icon} alt="" />
                ) : (
                  <span className="ob-wallet__icon">
                    <Icon name="wallet" size={18} />
                  </span>
                )}
                <span className="grow t-body-medium">{w.info.name}</span>
                {connecting === w.info.uuid ? (
                  <Icon name="loader" size={18} className="m-spinner" />
                ) : (
                  <Icon name="chevronRight" size={18} />
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="stack stack--md" style={{ paddingBlock: 'var(--space-sm)' }}>
            <p className="t-body c-muted">
              No browser wallet was detected. Install MetaMask, then reload this page to connect.
            </p>
            <a
              className="btn btn--primary"
              href={METAMASK_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              Install MetaMask
            </a>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Prop({ icon, title, body }: { icon: 'send' | 'arrowDownLeft' | 'zap'; title: string; body: string }) {
  return (
    <article className="ob-prop">
      <div className="ob-prop__icon">
        <Icon name={icon} size={20} />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

/**
 * A static, non-interactive rendition of the dashboard, shown inside the
 * device frame. The figures here are illustrative page copy — this is the
 * marketing panel, and it is never presented as the visitor's own balance
 * (the real dashboard reads exclusively from the chain).
 */
function PhonePreview() {
  return (
    <div className="ob-phone" aria-hidden>
      <div className="ob-phone__screen">
        <div className="ob-phone__bar">
          <span className="cluster" style={{ gap: 6 }}>
            Account 1 <Icon name="chevronDown" size={14} />
          </span>
          <span className="cluster" style={{ gap: 12 }}>
            <Icon name="clock" size={16} />
            <Icon name="copy" size={16} />
            <Icon name="menu" size={16} />
          </span>
        </div>

        <div>
          <div className="ob-phone__balance">1,284.60</div>
          <div className="ob-phone__delta">+34.28 FXRP (2.24%)</div>
        </div>

        <div className="ob-phone__actions">
          <div className="ob-phone__action">
            <Icon name="scan" size={18} />
            Scan
          </div>
          <div className="ob-phone__action">
            <Icon name="send" size={18} />
            Send
          </div>
          <div className="ob-phone__action">
            <Icon name="request" size={18} />
            Request
          </div>
          <div className="ob-phone__action">
            <Icon name="wallet" size={18} />
            Redeem
          </div>
        </div>

        <div className="ob-phone__card">
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Spendable balance</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
              1,284.60 <span style={{ fontSize: 12, color: '#4ade80' }}>FXRP</span>
            </div>
          </div>
          <span
            style={{
              background: '#fff',
              color: '#000',
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Add
          </span>
        </div>

        <div className="ob-phone__list">
          <PreviewToken mark="X" color="#23292f" name="XRP" sub="0.24 FXRP" value="812.42" up="+0.56%" />
          <PreviewToken mark="F" color="#e62058" name="Flare" sub="0.24 FLR" value="647.30" up="+0.88%" />
          <PreviewToken mark="T" color="#26a17b" name="USDT0" sub="0.24 USDT" value="152.02" up="+1.82%" />
        </div>
      </div>
    </div>
  );
}

function PreviewToken({
  mark,
  color,
  name,
  sub,
  value,
  up,
}: {
  mark: string;
  color: string;
  name: string;
  sub: string;
  value: string;
  up: string;
}) {
  return (
    <div className="ob-phone__token">
      <span className="ob-phone__token-mark" style={{ background: color }}>
        {mark}
      </span>
      <div className="grow">
        <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{sub}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#4ade80' }}>{up}</div>
      </div>
    </div>
  );
}
