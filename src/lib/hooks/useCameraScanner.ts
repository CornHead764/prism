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
  const readerRef = useRef<import('@zxing/browser').BrowserMultiFormatReader | null>(null);
  const activeRef = useRef(false);

  const stop = useCallback(() => {
    activeRef.current = false;
    readerRef.current = null;
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(t => t.stop());
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
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      if (!activeRef.current) return;

      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      // Prefer rear camera on mobile
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const rearCamera = devices.find(d =>
        /back|rear|environment/i.test(d.label)
      ) ?? devices[0];

      if (!rearCamera) throw new Error('No camera found');
      if (!activeRef.current) return;

      setState('scanning');

      await reader.decodeFromVideoDevice(
        rearCamera.deviceId,
        videoEl,
        (result, err) => {
          if (!activeRef.current) return;
          if (result) {
            const text = result.getText();
            if (text) onScan(text);
          }
          // Suppress continuous "not found" errors during scanning
          if (err && err.name !== 'NotFoundException') {
            console.error('[CameraScanner]', err);
          }
        }
      );
    } catch (err) {
      if (!activeRef.current) return;
      const msg = err instanceof Error ? err.message : 'Camera access failed';
      setErrorMessage(msg);
      setState('error');
      onError?.(msg);
    }
  }, [onScan, onError]);

  // Cleanup on unmount
  useEffect(() => () => { stop(); }, [stop]);

  return { state, errorMessage, start, stop };
}
