/**
 * Tests for POST /api/recipes/import-url.
 *
 * Mocks auth, DB, cache, and recipeParser to test:
 * - Missing URL (400)
 * - Invalid URL format (400)
 * - Non-HTTP URL (400)
 * - Fetch failure (502)
 * - No schema.org data found (422)
 * - Preview mode (returns parsed recipe without saving)
 * - Successful import (201)
 */

import { NextRequest, NextResponse } from 'next/server';

// --- Auth mock ---
const mockRequireAuth = jest.fn();
const mockRequireRole = jest.fn();

jest.mock('@/lib/auth', () => ({
  requireAuth: () => mockRequireAuth(),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

// --- DB mock ---
const mockInsertReturning = jest.fn();

jest.mock('@/lib/db/client', () => ({
  db: {
    insert: () => ({
      values: () => ({
        returning: () => mockInsertReturning(),
      }),
    }),
  },
}));

jest.mock('@/lib/db/schema', () => ({
  recipes: {},
}));

// --- Cache mock ---
jest.mock('@/lib/cache/redis', () => ({
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

// --- Recipe parser mock ---
const mockParseRecipeFromUrl = jest.fn();

jest.mock('@/lib/utils/recipeParser', () => ({
  parseRecipeFromUrl: (...args: unknown[]) => mockParseRecipeFromUrl(...args),
}));

import { POST } from '../../recipes/import-url/route';

const parentAuth = { userId: 'parent-1', role: 'parent' };

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/recipes/import-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/recipes/import-url', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue(parentAuth);
    mockRequireRole.mockReturnValue(null); // allowed
  });

  it('returns 400 when URL is missing', async () => {
    const res = await POST(makeRequest({}));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('URL is required');
  });

  it('returns 400 when URL is not a string', async () => {
    const res = await POST(makeRequest({ url: 123 }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('URL is required');
  });

  it('returns 400 for invalid URL format', async () => {
    mockParseRecipeFromUrl.mockRejectedValue(new Error('Invalid URL'));

    const res = await POST(makeRequest({ url: 'not-a-url' }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Invalid URL');
  });

  it('returns 400 for non-HTTP URL', async () => {
    mockParseRecipeFromUrl.mockRejectedValue(new Error('Only HTTP/HTTPS URLs are supported'));

    const res = await POST(makeRequest({ url: 'ftp://example.com/recipe' }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('HTTP/HTTPS');
  });

  it('returns 502 when fetch fails', async () => {
    mockParseRecipeFromUrl.mockRejectedValue(new Error('Failed to fetch URL: 503'));

    const res = await POST(makeRequest({ url: 'https://example.com/recipe' }));
    const data = await res.json();

    expect(res.status).toBe(502);
    expect(data.error).toContain('Failed to fetch URL');
  });

  it('returns 422 when no recipe data found', async () => {
    mockParseRecipeFromUrl.mockResolvedValue(null);

    const res = await POST(makeRequest({ url: 'https://example.com/no-recipe' }));
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error).toContain('schema.org');
  });

  it('returns preview without saving when preview=true', async () => {
    const parsedRecipe = {
      name: 'Chocolate Cake',
      description: 'Rich and moist',
      url: 'https://example.com/cake',
      ingredients: [{ text: '2 cups flour' }],
      instructions: 'Mix and bake.',
    };
    mockParseRecipeFromUrl.mockResolvedValue(parsedRecipe);

    const res = await POST(makeRequest({ url: 'https://example.com/cake', preview: true }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.preview).toBe(true);
    expect(data.recipe.name).toBe('Chocolate Cake');
    expect(mockInsertReturning).not.toHaveBeenCalled();
  });

  it('saves recipe and returns 201 on successful import', async () => {
    const parsedRecipe = {
      name: 'Pasta Carbonara',
      description: 'Classic Italian',
      url: 'https://example.com/pasta',
      ingredients: [{ text: '200g pasta' }],
      instructions: 'Cook pasta. Make sauce.',
      servings: '4',
      cuisine: 'Italian',
      category: 'Main',
    };
    mockParseRecipeFromUrl.mockResolvedValue(parsedRecipe);
    mockInsertReturning.mockResolvedValue([{
      id: 'recipe-1',
      name: 'Pasta Carbonara',
    }]);

    const res = await POST(makeRequest({ url: 'https://example.com/pasta' }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe('Pasta Carbonara');
    expect(mockInsertReturning).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    );

    const res = await POST(makeRequest({ url: 'https://example.com/recipe' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when role check fails', async () => {
    mockRequireRole.mockReturnValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    );

    const res = await POST(makeRequest({ url: 'https://example.com/recipe' }));
    expect(res.status).toBe(403);
  });
});
