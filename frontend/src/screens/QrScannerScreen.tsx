import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input, Notice, Screen, SectionLabel } from '../components/ui';
import { haptic } from '../components/motion';
import { useQrScanner } from '../components/qr/useQrScanner';
import { parseScannedQpayCode, QpayUriError } from '../components/qr/qrUri';
import './qrScanner.css';

/**
 * Camera QR scanning, plus a manual paste field.
 *
 * The paste field is not a fallback afterthought: on desktop — where most
 * browsers have no rear camera and the whole app is perfectly usable —
 * pasting a `qpay:` code is the primary path, so it stays visible rather
 * than only appearing once the camera fails.
 */
export default function QrScannerScreen() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [handled, setHandled] = useState(false);

  const handleCode = useCallback(
    (raw: string) => {
      if (handled) return;
      try {
        const parsed = parseScannedQpayCode(raw);
        setHandled(true);
        haptic('scan');

        const params = new URLSearchParams({ to: parsed.username, name: parsed.username });
        if (parsed.amount !== undefined) params.set('amount', String(parsed.amount));
        if (parsed.ref) params.set('note', parsed.ref);
        navigate(`/app/send?${params.toString()}`, { replace: true });
      } catch (e) {
        haptic('warning');
        setError(
          e instanceof QpayUriError
            ? "That isn't a Qpay code. Ask for a code that starts with “qpay:”."
            : 'Could not read that code.',
        );
      }
    },
    [handled, navigate],
  );

  const { videoRef, status, error: cameraError } = useQrScanner(handleCode, !handled);

  const submitManual = () => {
    const value = manual.trim();
    if (!value) return;
    setError(null);
    handleCode(value);
  };


  return (
    <Screen title="Scan" onBack={() => navigate(-1)}>
      <div className="stack stack--lg">
        <div className="scanner">
          <video ref={videoRef} className="scanner__video" playsInline muted />

          {/* The reticle is the only chrome over the feed — corners, no fill,
              so nothing obscures what the decoder actually sees. */}
          <div className="scanner__reticle" aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </div>

          {/* `starting` still shows the placeholder — the feed has no frames
              yet — so this covers every state except a live `scanning`. */}
          {status !== 'scanning' ? (
            <div className="scanner__placeholder t-label c-muted">
              {status === 'starting' ? 'Starting camera…' : 'Camera unavailable'}
            </div>
          ) : null}
        </div>

        {status === 'scanning' ? (
          <p className="t-label c-muted" style={{ textAlign: 'center' }}>
            Point at a Qpay code to pay.
          </p>
        ) : null}

        {error ? <Notice message={error} tone="danger" /> : null}
        {!error && cameraError ? <Notice message={cameraError} /> : null}

        <section>
          <SectionLabel>Or paste a code</SectionLabel>
          <Card variant="flat">
            <div className="stack stack--md">
              <Input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="qpay:0x…"
                spellCheck={false}
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitManual();
                }}
              />
              <Button label="Continue" onClick={submitManual} disabled={!manual.trim()} />
            </div>
          </Card>
        </section>
      </div>
    </Screen>
  );
}
