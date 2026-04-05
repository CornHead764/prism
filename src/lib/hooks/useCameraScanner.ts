'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraScannerState = 'idle' | 'starting' | 'scanning' | 'error';

interface UseCameraScannerOptions {
  onScan: (barcode: string) => void;
  onError?: (message: string) => void;
}

export function useCameraScanner({ onScan, onError }: UseCameraScannerOptions) {
  const [state, setState] = useState<CameraScannerState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const activeRef = useRef(false);

  const stop = useCallback(() => {
    activeRef.current = false;
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setState('idle');
    setErrorMessage(null);
  }, []);

  const start = useCallback(async (videoEl: HTMLVideoElement) => {
    videoRef.current = videoEl;
    setState('starting');
    activeRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      if (!activeRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

      videoEl.srcObject = stream;
      videoEl.muted = true;
      videoEl.playsInline = true;
      await videoEl.play();
      if (!activeRef.current) return;

      setState('scanning');

      // --- Native BarcodeDetector (Chrome 83+, Android Chrome) ---
      if ('BarcodeDetector' in window) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        let running = true;

        const scan = async () => {
          if (!running || !activeRef.current) return;
          if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
            canvas.width = videoEl.videoWidth;
            canvas.height = videoEl.videoHeight;
            ctx.drawImage(videoEl, 0, 0);
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const results: any[] = await detector.detect(canvas);
              if (results.length > 0 && activeRef.current) {
                onScan(results[0].rawValue as string);
              }
            } catch {
              // single-frame detection error — keep scanning
            }
          }
          if (running && activeRef.current) {
            setTimeout(scan, 250);
          }
        };

        cleanupRef.current = () => { running = false; };
        scan();
        return;
      }

      // --- ZXing fallback (Safari, Firefox) ---
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      if (!activeRef.current) return;

      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoElement(videoEl, (result, err) => {
        if (!activeRef.current) return;
        if (result) {
          const text = result.getText();
          if (text) onScan(text);
        }
        if (err && err.name !== 'NotFoundException') {
          console.error('[CameraScanner]', err);
        }
      });

      cleanupRef.current = () => controls.stop();
    } catch (err) {
      if (!activeRef.current) return;
      const msg = err instanceof Error ? err.message : 'Camera access failed';
      setErrorMessage(msg);
      setState('error');
      onError?.(msg);
    }
  }, [onScan, onError]);

  useEffect(() => () => { stop(); }, [stop]);

  return { state, errorMessage, start, stop };
}
