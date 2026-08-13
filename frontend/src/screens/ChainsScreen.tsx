import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AmountDisplay,
  Button,
  Card,
  Divider,
  Icon,
  Screen,
  SectionLabel,
  Skeleton,
  type IconName,
} from '../components/ui';
import { Stagger } from '../components/motion';
import { useBalances } from '../hooks';
import { getFxrpLotSize } from '../services/qpayService';
import { ConnectionGate } from './components/ConnectionGate';
import './chains.css';

const ZONES: { title: string; body: string; icon: IconName }[] = [
  {
    title: 'Ingress',
    body: 'Real value enters once — XRP, an EVM asset, or a card top-up becomes a Qpay balance.',
    icon: 'arrowDownLeft',
  },
  {
    title: 'The ledger — instant',
    body: 'Every payment between Qpay users is instant and free — this is the whole product.',
    icon: 'activity',
  },
  {
    title: 'Egress — slow, optional',
    body: 'Cashing out is the only slow step, and it only happens when you choose to do it.',
    icon: 'clock',
  },
];

/**
 * Per-chain balances, deliberately kept off the main dashboard. Egress for
 * FXRP goes through FAssets redemption — lot-granular and partial-fill
 * aware — surfaced honestly on its own screen rather than as a generic
 * "withdraw" button here.
 */
export default function ChainsScreen() {
  const navigate = useNavigate();
  const { chainBalances, loading, error } = useBalances();
  const [lotSize, setLotSize] = useState<number | null>(null);

  // Read live rather than assuming Coston2's 10 FXRP/lot — the same reason
  // RedeemScreen does. A wrong lot size here would misreport how close the
  // user is to another redeemable lot.
  useEffect(() => {
    let active = true;
    getFxrpLotSize()
      .then((size) => active && setLotSize(size))
      .catch(() => {
        // Non-fatal: the lot progress bar just doesn't render.
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen title="Chains">
      <div className="stack stack--lg">
        <p className="t-body c-muted">
          Payments settle instantly between Qpay balances. Moving value on or off Flare is the only
          slow step — and it is optional.
        </p>

        <section>
          <SectionLabel>How money moves</SectionLabel>
          <Card variant="flat">
            <div className="stack stack--md">
              <Stagger interval={50}>
                {ZONES.map((zone) => (
                  <div key={zone.title} className="chains__zone">
                    <span className="chains__zone-icon">
                      <Icon name={zone.icon} size={16} />
                    </span>
                    <div className="stack stack--xs grow">
                      <span className="t-body-medium">{zone.title}</span>
                      <span className="t-label c-muted">{zone.body}</span>
                    </div>
                  </div>
                ))}
              </Stagger>
            </div>
          </Card>
        </section>

        <section>
          <SectionLabel>Balances</SectionLabel>
          <ConnectionGate error={error}>
            {loading && chainBalances.length === 0 ? (
              <div className="stack stack--md">
                <Skeleton height={92} />
                <Skeleton height={92} />
                <Skeleton height={92} />
              </div>
            ) : (
              <div className="stack stack--md">
                <Stagger interval={50} distance={14}>
                  {chainBalances.map((balance) => (
                    <Card key={balance.asset} padded={false} className="chains__card">
                      <div className="chains__head">
                        <div className="stack stack--xs">
                          <span className="t-subtitle">{balance.label}</span>
                          <span className="t-micro c-muted">{balance.asset}</span>
                        </div>
                        <AmountDisplay value={balance.balance} asset="" />
                      </div>

                      {balance.asset === 'FXRP' && lotSize ? (
                        <FxrpLotProgress balance={balance.balance} lotSize={lotSize} />
                      ) : null}

                      <Divider />

                      <div className="chains__foot">
                        <span className="t-label c-muted grow">{balance.egressLabel}</span>
                        {balance.asset === 'FXRP' ? (
                          <div className="chains__actions">
                            <Button
                              label="Deposit"
                              variant="secondary"
                              onClick={() => navigate('/app/deposit')}
                            />
                            <Button
                              label="Redeem"
                              variant="secondary"
                              onClick={() => navigate('/app/redeem')}
                            />
                          </div>
                        ) : null}
                      </div>
                    </Card>
                  ))}
                </Stagger>
              </div>
            )}
          </ConnectionGate>
        </section>
      </div>
    </Screen>
  );
}

/**
 * How close this balance is to another whole redeemable lot. Real math, not
 * decoration: FXRP egress only ever fills in whole lots, so the remainder
 * genuinely cannot be cashed out yet.
 */
function FxrpLotProgress({ balance, lotSize }: { balance: number; lotSize: number }) {
  const lots = Math.floor(balance / lotSize);
  const remainder = balance - lots * lotSize;
  const progress = lotSize > 0 ? remainder / lotSize : 0;

  return (
    <div className="chains__lots">
      <div className="spread">
        <span className="t-micro c-muted">
          {lots} redeemable lot{lots === 1 ? '' : 's'}
        </span>
        <span className="t-micro c-muted">
          {remainder.toFixed(2)} / {lotSize} to the next
        </span>
      </div>
      <div className="chains__bar">
        <span style={{ width: `${Math.min(100, progress * 100)}%` }} />
      </div>
    </div>
  );
}
