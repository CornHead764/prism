import { useCallback, useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';

export function useGlobeRotation(
  mapRef: React.MutableRefObject<maplibregl.Map | null>,
  overlayOpen: boolean
) {
  const rotationFrameRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRotatingRef = useRef(false);
  const overlayOpenRef = useRef(overlayOpen);

  useEffect(() => { overlayOpenRef.current = overlayOpen; }, [overlayOpen]);

  const startRotation = useCallback(() => {
    if (!mapRef.current || isRotatingRef.current) return;
    isRotatingRef.current = true;
    const tick = () => {
      if (!mapRef.current || !isRotatingRef.current) return;
      const { lng, lat } = mapRef.current.getCenter();
      const next = ((lng + 0.04 + 180) % 360) - 180;
      mapRef.current.setCenter([next, lat]);
      rotationFrameRef.current = requestAnimationFrame(tick);
    };
    rotationFrameRef.current = requestAnimationFrame(tick);
  }, [mapRef]);

  const stopRotation = useCallback(() => {
    isRotatingRef.current = false;
    if (rotationFrameRef.current !== null) {
      cancelAnimationFrame(rotationFrameRef.current);
      rotationFrameRef.current = null;
    }
  }, []);

  const scheduleResume = useCallback(() => {
    if (resumeTimerRef.current !== null) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      resumeTimerRef.current = null;
      if (!overlayOpenRef.current) startRotation();
    }, 60_000);
  }, [startRotation]);

  // When overlay opens: stop rotation + cancel resume. When closes: start 1-min timer.
  useEffect(() => {
    if (overlayOpen) {
      stopRotation();
      if (resumeTimerRef.current !== null) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null; }
    } else {
      scheduleResume();
    }
  }, [overlayOpen, stopRotation, scheduleResume]);

  // Pause rotation when tab is hidden, resume when visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        stopRotation();
      } else if (!overlayOpenRef.current) {
        scheduleResume();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [stopRotation, scheduleResume]);

  const cleanup = useCallback(() => {
    stopRotation();
    if (resumeTimerRef.current !== null) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null; }
  }, [stopRotation]);

  return { startRotation, stopRotation, scheduleResume, cleanup, overlayOpenRef };
}
