'use client';

import Link from 'next/link';
import { Zap } from 'lucide-react';
import { usePerformanceMode } from '@/lib/hooks/usePerformanceMode';

export function PerformanceModeBadge() {
  const { enabled } = usePerformanceMode();
  if (!enabled) return null;

  return (
    <Link
      href="/settings"
      className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground"
      aria-label="Performance Mode active — open Settings to change"
      title="Performance Mode active"
    >
      <Zap className="h-4 w-4" />
    </Link>
  );
}
