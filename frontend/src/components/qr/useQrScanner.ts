import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

export type ScannerStatus = 'idle' | 'starting' | 'scanning' | 'denied' | 'unavailable' | 'error';

/**
 * Camera-backed QR scanning for the web.
 *
 * The mobile app used `react-native-camera-kit`, whose scanner ran natively.
 * In a browser the equivalent is `getUserMedia` into a `<video>`, sampling
 * frames onto a canvas and decoding them with `jsQR`. Decoding runs on an
 * animation frame loop and stops the moment a code is found, so the camera
 * isn't left running behind a navigation.
 *
 * `getUserMedia` requires a secure context — https, or localhost during
 * development. On plain http over a LAN the browser reports the API as
 * missing entirely, which surfaces here as `unavailable` so the UI can
 * explain that rather than looking broken.
 */
export function useQrScanner(onDecode: (value: string) => void, active = true) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | undefined>(undefined);
  const decodedRef = useRef(false);

  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Kept in a ref so restarting the camera isn't coupled to the callback's identity.
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;

  const stop = useCallback(() => {
    if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    frameRef.current = undefined;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      setStatus('idle');
      return;
    }

    decodedRef.current = false;
    let cancelled = false;

    const scanFrame = () => {
      const video = videoRef.current;
      if (!video || decodedRef.current || cancelled) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const canvas = (canvasRef.current ??= document.createElement('canvas'));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          // Decode at a capped width: a 4K frame costs far more to scan than
          // it adds in accuracy, and this loop runs every frame.
          const scale = Math.min(1, 640 / (video.videoWidth || 640));
          canvas.width = Math.round((video.videoWidth || 640) * scale);
          canvas.height = Math.round((video.videoHeight || 480) * scale);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const found = jsQR(image.data, image.width, image.height, {
            inversionAttempts: 'dontInvert',
          });

          if (found?.data) {
            decodedRef.current = true;
            onDecodeRef.current(found.data);
            return;
          }
        }
      }
      frameRef.current = requestAnimationFrame(scanFrame);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unavailable');
        setError(
          'Camera access needs a secure connection (https or localhost). You can still paste a Qpay code below.',
        );
        return;
      }

      setStatus('starting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          // iOS Safari refuses to play inline without both of these.
          video.setAttribute('playsinline', 'true');
          video.muted = true;
          await video.play();
        }
        setStatus('scanning');
        setError(null);
        frameRef.current = requestAnimationFrame(scanFrame);
      } catch (e) {
        if (cancelled) return;
        const name = e instanceof Error ? e.name : '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setStatus('denied');
          setError('Camera permission was denied. Allow it in your browser, or paste a code below.');
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setStatus('unavailable');
          setError('No camera was found on this device. You can paste a Qpay code below.');
        } else {
          setStatus('error');
          setError(e instanceof Error ? e.message : 'Could not start the camera.');
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [active, stop]);

  return { videoRef, status, error, stop };
}
