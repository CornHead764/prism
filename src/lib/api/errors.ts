import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

/**
 * Standard API error response helpers.
 *
 * All error responses follow the shape:
 *   { error: string, details?: unknown }
 *
 * - error:   Human-readable message safe to show or log
 * - details: Optional structured info (validation issues, etc.) — for debugging only,
 *            never displayed directly to end users
 */

export function apiError(message: string, status: number, details?: unknown): NextResponse {
  const body: { error: string; details?: unknown } = { error: message };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}

// Convenience shorthands for common status codes
export const badRequest  = (msg: string, details?: unknown) => apiError(msg, 400, details);
export const unauthorized = (msg = 'Authentication required')  => apiError(msg, 401);
export const forbidden   = (msg = 'Forbidden')                 => apiError(msg, 403);
export const notFound    = (msg: string)                       => apiError(msg, 404);
export const conflict    = (msg: string)                       => apiError(msg, 409);
export const serverError = (msg = 'Internal server error')     => apiError(msg, 500);

/**
 * Standard validation error — always uses ZodError.flatten() for consistent shape:
 * {
 *   error: 'Validation failed',
 *   details: { formErrors: string[], fieldErrors: Record<string, string[]> }
 * }
 */
export function validationError(err: ZodError): NextResponse {
  return badRequest('Validation failed', err.flatten());
}
