import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Qpay QR generator.
 *
 * Deliberately does NOT read the theme: a QR must stay literally
 * black-on-white to remain scannable in both light and dark mode, so the
 * colours here are hardcoded rather than token-driven. No colored frame, no
 * logo overlay — the same rule the mobile component followed.
 */
export function QpayQrCode({
  value,
  size = 220,
  quietZone = true,
}: {
  value: string;
  size?: number;
  /** Square quiet-zone border around the code. Default true. */
  quietZone?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;

    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 0,
      color: { dark: '#000000', light: '#FFFFFF' },
      // 'M' tolerates ~15% damage — the right trade-off for a code that
      // gets printed and left on a counter.
      errorCorrectionLevel: 'M',
    })
      .then(() => setError(null))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not render this code.'));
  }, [value, size]);

  if (error) {
    return (
      <div className="notice notice--danger" role="alert">
        <span className="t-label">{error}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#FFFFFF',
        padding: quietZone ? 16 : 0,
        border: quietZone ? '1px solid #000000' : 'none',
        borderRadius: 'var(--radius-md)',
        alignSelf: 'center',
        lineHeight: 0,
      }}
    >
      <canvas ref={canvasRef} width={size} height={size} aria-label="Qpay payment code" />
    </div>
  );
}
