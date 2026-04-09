/**
 * Safe error logger for API routes.
 *
 * In production: logs only error.message to avoid leaking stack traces,
 * file paths, DB query details, or other internals via server logs.
 * In development: logs the full error object for easy debugging.
 */
export function logError(message: string, error: unknown): void {
  if (process.env.NODE_ENV === 'production') {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(message, msg);
  } else {
    console.error(message, error);
  }
}
