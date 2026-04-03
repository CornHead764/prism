'use client';

import * as React from 'react';
import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCameraScanner } from '@/lib/hooks/useCameraScanner';
import { toast } from '@/components/ui/use-toast';

interface CameraScannerOverlayProps {
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function CameraScannerOverlay({ onClose, onScan }: CameraScannerOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const lastScanned = useRef<string | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScan = useCallback((barcode: string) => {
    // Debounce repeated scans of the same barcode
    if (lastScanned.current === barcode) return;
    lastScanned.current = barcode;
    cooldownRef.current = setTimeout(() => { lastScanned.current = null; }, 2000);
    onScan(barcode);
  }, [onScan]);

  const handleError = useCallback((msg: string) => {
    toast({ title: 'Camera error', description: msg, variant: 'destructive' });
  }, []);

  const { state, errorMessage, start, stop } = useCameraScanner({
    onScan: handleScan,
    onError: handleError,
  });

  useEffect(() => {
    setMounted(true);
    return () => {
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    };
  }, []);

  useEffect(() => {
    if (mounted && videoRef.current && state === 'idle') {
      start(videoRef.current);
    }
  }, [mounted, start, state]);

  const handleClose = useCallback(() => {
    stop();
    onClose();
  }, [stop, onClose]);

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

      {/* Camera viewport */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        <video
          ref={videoRef}
          className={cn(
            'w-full h-full object-cover',
            state !== 'scanning' && 'opacity-30',
          )}
          playsInline
          muted
        />

        {/* Scanning frame overlay */}
        {state === 'scanning' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-64 h-40">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br" />
              {/* Scan line */}
              <div className="absolute inset-x-2 top-1/2 h-px bg-primary/80 animate-pulse" />
            </div>
            <p className="absolute bottom-8 text-white/70 text-sm">
              Point camera at barcode
            </p>
          </div>
        )}

        {/* Starting state */}
        {state === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Starting camera...</p>
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white px-8 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="font-medium">Camera unavailable</p>
            <p className="text-sm text-white/70">{errorMessage}</p>
            <Button variant="secondary" onClick={handleClose} className="mt-2">
              Close
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
