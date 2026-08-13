import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Notice, Screen } from '../../components/ui';
import { Stagger, haptic } from '../../components/motion';
import { setPrimaryAsset } from '../../services/qpayService';
import type { PrimaryAsset } from '../../services/types';
import { tokenFor } from '../../contracts';
import { useWallet } from '../../web3';

// Exactly three choices, equal weight, framed as "what do you want to hold?"
const CHOICES: { asset: PrimaryAsset; label: string; hint: string }[] = [
  { asset: 'FXRP', label: 'XRP', hint: 'Get paid in XRP. Cash out to a real XRP Ledger wallet anytime.' },
  { asset: 'FLR', label: 'Flare', hint: 'Get paid in FLR, native to Flare.' },
  { asset: 'USDT0', label: 'USDT', hint: 'Get paid in USDT0, an ERC-20 stable balance on Flare.' },
];

/**
 * The second onboarding step: choosing the asset every incoming payment
 * converts into. This writes on-chain (`QpayLedger.setPrimaryAsset`), so it
 * needs a connected wallet on the right chain — hence the switch prompt
 * rather than letting the transaction fail after the fact.
 */
export default function PrimaryAssetScreen() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const [selected, setSelected] = useState<PrimaryAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await setPrimaryAsset(selected);
      haptic('success');
      navigate('/app', { replace: true });
    } catch (e) {
      // Without this the button sticks on "Saving…" forever and the failure
      // is an unhandled rejection — the first screen of the app is the worst
      // possible place to swallow an error.
      haptic('warning');
      setError(e instanceof Error ? e.message : 'Could not save your choice.');
    } finally {
      setSaving(false);
    }
  };

  const handleSwitch = async () => {
    setSwitching(true);
    setError(null);
    try {
      await wallet.switchToCoston2();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not switch networks.');
    } finally {
      setSwitching(false);
    }
  };

  const needsSwitch = wallet.isConnected && !wallet.isCorrectChain;

  return (
    <Screen
      title="Set up"
      footer={
        <Button
          label={saving ? 'Saving…' : 'Continue'}
          onClick={() => void confirm()}
          disabled={!selected || saving || needsSwitch}
          loading={saving}
        />
      }
    >
      <div className="stack stack--lg">
        <div className="stack stack--xs">
          <h1 className="t-title">What do you want to hold?</h1>
          <p className="t-body c-muted">
            Every payment you receive converts into this automatically. You can change it later.
          </p>
        </div>

        {needsSwitch ? (
          <div className="stack stack--sm">
            <Notice message="Your wallet is on another network. Switch to Flare Coston2 to continue." />
            <Button
              label={switching ? 'Switching…' : 'Switch to Coston2'}
              variant="secondary"
              onClick={() => void handleSwitch()}
              loading={switching}
            />
          </div>
        ) : null}

        <div className="stack stack--md">
          <Stagger interval={50}>
            {CHOICES.map((choice) => {
              // An asset with no token address isn't allowlisted on this
              // deployment — setPrimaryAsset would revert. Show it as
              // unavailable rather than letting the tap fail after the fact.
              const available = !!tokenFor(choice.asset).address;
              const isSelected = selected === choice.asset;

              return (
                <Card
                  key={choice.asset}
                  onClick={
                    available
                      ? () => {
                          haptic('select');
                          setSelected(choice.asset);
                        }
                      : undefined
                  }
                  selected={isSelected}
                  disabled={!available}
                >
                  <div className="stack stack--xs">
                    <span className="t-body-medium">{choice.label}</span>
                    <span className="t-body c-muted">
                      {available ? choice.hint : 'Not enabled on this deployment yet.'}
                    </span>
                  </div>
                </Card>
              );
            })}
          </Stagger>
        </div>

        {error ? <Notice message={error} tone="danger" /> : null}
      </div>
    </Screen>
  );
}
