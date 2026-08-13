import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AmountDisplay,
  Avatar,
  Button,
  Card,
  ContactChip,
  Icon,
  Input,
  KeypadNumeric,
  Notice,
  Screen,
  SectionLabel,
  SegmentedControl,
  StatusTag,
  Toast,
  useCopy,
} from '../components/ui';
import { FadeIn, PopIn, Stagger, haptic } from '../components/motion';
import { QpayQrCode } from '../components/qr/QpayQrCode';
import { useQpayContext } from '../context/QpayProvider';
import { useContacts, usePay } from '../hooks';
import { buildQpayUri, formatAmount, truncateAddress } from '../utils';
import { ConnectionGate } from './components/ConnectionGate';

type Tab = 'code' | 'from';

/**
 * "My code" (a static/never-expires or amount-locked QR) and "Request from"
 * (pick a contact, enter an amount, record a request).
 *
 * Note on the data model: `requestMoney()` only models "create a request as
 * the current user" — `PaymentRequest` has no addressee field. So "request
 * from a contact" folds the chosen contact's name into the request's `note`
 * rather than being a genuinely directed request. That's a service-layer
 * limitation carried over from mobile, not a UI shortcut.
 */
export default function RequestScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { snapshot, error: qpayError } = useQpayContext();
  const { recent } = useContacts();
  const { requestMoney } = usePay();

  // Arriving from ContactPicker with ?to=&name= means the user already chose
  // who they're requesting from — open on that tab, pre-targeted.
  const paramQpayId = params.get('to') ?? '';
  const paramName = params.get('name') ?? '';

  const [tab, setTab] = useState<Tab>(paramQpayId ? 'from' : 'code');

  // ---- My code ---------------------------------------------------------
  const [qrMode, setQrMode] = useState<'static' | 'amount'>('static');
  const [qrAmountStr, setQrAmountStr] = useState('');
  const [copied, copy] = useCopy();

  const profile = snapshot?.profile ?? null;
  const qrAmountValue = qrAmountStr ? Number(qrAmountStr) : undefined;
  const uri = useMemo(
    () =>
      buildQpayUri({
        qpayId: profile?.qpayId ?? '',
        amount: qrMode === 'amount' ? qrAmountValue : undefined,
      }),
    [profile?.qpayId, qrMode, qrAmountValue],
  );

  const shareCode = async () => {
    haptic('select');
    // The Web Share API is the real "share sheet" equivalent on mobile
    // browsers; where it doesn't exist, copying is the honest fallback.
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Qpay', text: uri });
        return;
      } catch {
        // Share cancelled — fall through to copying rather than erroring.
      }
    }
    copy(uri);
  };

  // ---- Request from ------------------------------------------------------
  const [target, setTarget] = useState<{ qpayId: string; name: string } | null>(
    paramQpayId ? { qpayId: paramQpayId, name: paramName || paramQpayId } : null,
  );
  const [reqAmountStr, setReqAmountStr] = useState('');
  const [reqNote, setReqNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    name: string;
    amount: number | null;
    asset: string;
  } | null>(null);

  const senderAsset = profile?.primaryAsset ?? 'FXRP';
  const reqAmountValue = reqAmountStr ? Number(reqAmountStr) : 0;

  async function sendRequest() {
    if (!target) return;
    setSendError(null);
    setSending(true);
    haptic('tap');
    try {
      const note = `Requested from ${target.name}${reqNote.trim() ? ` — ${reqNote.trim()}` : ''}`;
      await requestMoney({
        amount: reqAmountValue > 0 ? reqAmountValue : undefined,
        asset: senderAsset,
        ref: `req-${Date.now()}`,
        note,
      });
      haptic('success');
      setConfirmation({
        name: target.name,
        amount: reqAmountValue > 0 ? reqAmountValue : null,
        asset: senderAsset,
      });
      setTarget(null);
      setReqAmountStr('');
      setReqNote('');
    } catch (e) {
      haptic('warning');
      setSendError(
        e instanceof Error ? e.message : 'Could not send this request. Please try again.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen title="Request" onBack={() => navigate(-1)}>
      <div className="stack stack--lg">
        <SegmentedControl
          options={[
            { label: 'My code', value: 'code' as Tab },
            { label: 'Request from', value: 'from' as Tab },
          ]}
          value={tab}
          onChange={setTab}
        />

        <ConnectionGate error={qpayError}>
          {tab === 'code' ? (
            <div className="stack stack--lg">
              <SegmentedControl
                options={[
                  { label: 'Static', value: 'static' as const },
                  { label: 'Amount', value: 'amount' as const },
                ]}
                value={qrMode}
                onChange={setQrMode}
              />

              {qrMode === 'amount' ? (
                <div className="stack stack--md">
                  <div className="center">
                    <AmountDisplay value={qrAmountValue ?? 0} asset={senderAsset} />
                  </div>
                  <KeypadNumeric value={qrAmountStr} onChange={setQrAmountStr} />
                </div>
              ) : null}

              <FadeIn>
                <div className="center stack stack--md">
                  <QpayQrCode value={uri} />

                  <div className="cluster">
                    <span className="t-subtitle">{truncateAddress(profile?.qpayId ?? '')}</span>
                    <button
                      type="button"
                      onClick={() => copy(profile?.qpayId ?? '')}
                      aria-label="Copy Qpay ID"
                    >
                      <Icon name="copy" size={18} />
                    </button>
                  </div>

                  <Toast message="Copied" visible={copied} />

                  <StatusTag
                    label={qrMode === 'static' ? 'Never expires' : 'Amount locked'}
                    emphasis={qrMode === 'static' ? 'solid' : 'outline'}
                  />

                  <Button label="Share code" variant="secondary" onClick={() => void shareCode()} />
                </div>
              </FadeIn>

              <section>
                <SectionLabel>How this works</SectionLabel>
                <Card variant="flat">
                  <p className="t-body c-muted">
                    {qrMode === 'static'
                      ? 'Print this once and leave it on the counter. It never expires — whoever scans it types the amount.'
                      : 'Locks the amount for this one payment. Use it once the total is already known.'}
                  </p>
                </Card>
              </section>
            </div>
          ) : confirmation ? (
            <div className="center stack stack--lg" style={{ paddingTop: 'var(--space-lg)' }}>
              <PopIn>
                <span className="send__success-badge">
                  <Icon name="check" size={36} />
                </span>
              </PopIn>
              <div className="center stack stack--xs">
                <span className="t-subtitle">Request recorded</span>
                <span className="t-body c-muted" style={{ textAlign: 'center' }}>
                  {confirmation.amount != null
                    ? `${formatAmount(confirmation.amount, confirmation.asset)} from ${confirmation.name}.`
                    : `An open request from ${confirmation.name}.`}{' '}
                  Share your code so they can pay it.
                </span>
              </div>
              <Button label="New request" onClick={() => setConfirmation(null)} />
              <Button label="Show my code" variant="ghost" onClick={() => setTab('code')} />
            </div>
          ) : target ? (
            <div className="stack stack--md">
              <div className="cluster" style={{ gap: 'var(--space-md)' }}>
                <Avatar name={target.name} size={44} />
                <div className="row__text">
                  <span className="t-body-medium truncate">{target.name}</span>
                  <span className="t-label c-muted truncate">{truncateAddress(target.qpayId)}</span>
                </div>
              </div>

              <div className="center" style={{ paddingBlock: 'var(--space-md)' }}>
                <AmountDisplay value={reqAmountValue} asset={senderAsset} size="display" />
              </div>

              <Input
                label="Add a note"
                value={reqNote}
                onChange={(e) => setReqNote(e.target.value)}
                placeholder="What's it for?"
              />

              <KeypadNumeric value={reqAmountStr} onChange={setReqAmountStr} />

              {sendError ? <Notice message={sendError} tone="danger" /> : null}

              <div className="stack stack--sm">
                <Button
                  label="Send request"
                  onClick={() => void sendRequest()}
                  loading={sending}
                  disabled={reqAmountValue <= 0}
                />
                <Button
                  label="Choose someone else"
                  variant="ghost"
                  onClick={() => setTarget(null)}
                />
              </div>
            </div>
          ) : (
            <div className="stack stack--lg">
              {recent.length > 0 ? (
                <section>
                  <SectionLabel>Recent</SectionLabel>
                  <div className="chip-row no-scrollbar">
                    <Stagger interval={30} direction="right" distance={10}>
                      {recent.map((contact) => (
                        <ContactChip
                          key={contact.id}
                          name={contact.name}
                          subtitle={truncateAddress(contact.qpayId, { prefix: 4, suffix: 3 })}
                          onClick={() => setTarget({ qpayId: contact.qpayId, name: contact.name })}
                        />
                      ))}
                    </Stagger>
                  </div>
                </section>
              ) : null}

              <Button
                label="Choose a contact"
                variant="secondary"
                onClick={() => navigate('/app/contacts?mode=request')}
              />
            </div>
          )}
        </ConnectionGate>
      </div>
    </Screen>
  );
}
