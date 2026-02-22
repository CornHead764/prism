'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function CalendarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Calendar error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">Calendar Error</h1>
        <p className="text-muted-foreground">
          {process.env.NODE_ENV === 'development'
            ? error.message
            : 'Failed to load the calendar. Please try again.'}
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:opacity-90"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
