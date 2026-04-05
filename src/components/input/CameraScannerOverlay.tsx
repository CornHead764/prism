'use client';

import * as React from 'react';
import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, Loader2, AlertCircle, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCameraScanner } from '@/lib/hooks/useCameraScanner';
import { toast } from '@/components/ui/use-toast';

interface CameraScannerOverlayProps {
  onClose: () => void;
  onScan: (barcode: string) => void;
}

function hasBarcodeDetector() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}

// Decode a photo by drawing to canvas first.
// Static image → canvas works on iOS; the restriction only applies to live video streams.
// Downscale to max 1280px so ZXing doesn't choke on 12MP+ iPhone photos.
async function decodeImageFile(file: File): Promise<string | null> {
  try {
    const url = URL.createObjectURL(file);
    let img: HTMLImageElement;
    try {
      img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }

    const MAX_W = 1280;
    const scale = img.naturalWidth > MAX_W ? MAX_W / img.naturalWidth : 1;
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);

    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    const reader = new BrowserMultiFormatReader();
    const result = await reader.decodeFromCanvas(canvas);
    return result.getText();
  } catch {
    return null;
  }
}

export function CameraScannerOverlay({ onClose, onScan }: CameraScannerOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const [usePhotoMode, setUsePhotoMode] = useState(false);
  const [photoDecoding, setPhotoDecoding] = useState(false);
  const lastScanned = useRef<string | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannedRef = useRef(false);

  const handleScanSuccess = useCallback((barcode: string) => {
    // Debounce repeated scans of the same barcode
    if (lastScanned.current === barcode) {
      vibrate([50, 80, 50]); // double-tap pattern for duplicate
      toast({ title: 'Already scanned', description: 'That barcode was just scanned.' });
      return;
    }
    if (scannedRef.current) return; // prevent double-fire
    scannedRef.current = true;
    lastScanned.current = barcode;
    cooldownRef.current = setTimeout(() => { lastScanned.current = null; }, 3000);

    vibrate(200); // success pulse
    stop();
    onScan(barcode);
    onClose();
  }, [onScan, onClose]); // stop added below after declaration

  const handleError = useCallback((msg: string) => {
    toast({ title: 'Camera error', description: msg, variant: 'destructive' });
  }, []);

  const { state, errorMessage, start, stop } = useCameraScanner({
    onScan: handleScanSuccess,
    onError: handleError,
  });

  // Patch stop into handleScanSuccess closure via ref
  const stopRef = useRef(stop);
  useEffect(() => { stopRef.current = stop; }, [stop]);

  useEffect(() => {
    setMounted(true);
    setUsePhotoMode(!hasBarcodeDetector());
    return () => {
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    };
  }, []);

  // Only start continuous scanner if BarcodeDetector is available
  useEffect(() => {
    if (mounted && !usePhotoMode && videoRef.current && state === 'idle') {
      start(videoRef.current);
    }
  }, [mounted, usePhotoMode, start, state]);

  const handleClose = useCallback(() => {
    stop();
    onClose();
  }, [stop, onClose]);

  const handlePhotoCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoDecoding(true);
    const barcode = await decodeImageFile(file);
    setPhotoDecoding(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (barcode) {
      handleScanSuccess(barcode);
    } else {
      vibrate([100, 80, 100]); // no-match pattern
      toast({
        title: 'No barcode found',
        description: 'Try again — hold steady and make sure the barcode fills the frame.',
        variant: 'destructive',
      });
    }
  }, [handleScanSuccess]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9000] flex flex-col bg-black/95">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          <span className="font-medium">Scan Barcode</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="text-white hover:text-white hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
        {usePhotoMode ? (
          <>
            <div className="flex flex-col items-center gap-3 text-white text-center">
              <ScanLine className="h-16 w-16 text-white/60" />
              <p className="text-base font-medium">Take a photo of the barcode</p>
              <p className="text-sm text-white/60">
                Hold steady so the barcode fills the frame, then tap below.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoCapture}
            />

            <Button
              size="lg"
              className="gap-2 text-base px-8"
              disabled={photoDecoding}
              onClick={() => fileInputRef.current?.click()}
            >
              {photoDecoding ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Scanning...</>
              ) : (
                <><Camera className="h-5 w-5" /> Open Camera</>
              )}
            </Button>
          </>
        ) : (
          <div className="w-full flex-1 flex items-center justify-center relative overflow-hidden -mx-6">
            <video
              ref={videoRef}
              className={cn(
                'w-full h-full object-cover',
                state !== 'scanning' && 'opacity-30',
              )}
              playsInline
              muted
            />

            {state === 'scanning' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-64 h-40">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br" />
                  <div className="absolute inset-x-2 top-1/2 h-px bg-primary/80 animate-pulse" />
                </div>
                <p className="absolute bottom-8 text-white/70 text-sm">Point camera at barcode</p>
              </div>
            )}

            {state === 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Starting camera...</p>
              </div>
            )}

            {state === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white px-8 text-center">
                <AlertCircle className="h-10 w-10 text-destructive" />
                <p className="font-medium">Camera unavailable</p>
                <p className="text-sm text-white/70">{errorMessage}</p>
                <Button variant="secondary" onClick={handleClose} className="mt-2">Close</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
