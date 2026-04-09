import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { recipes } from '@/lib/db/schema';
import { requireAuth, requireRole } from '@/lib/auth';
import { invalidateCache } from '@/lib/cache/redis';
import { parseRecipeFromUrl } from '@/lib/utils/recipeParser';
import { logError } from '@/lib/utils/logError';

/**
 * Validate that a URL doesn't point to a private/internal network address.
 * Prevents SSRF attacks where users could scan internal infrastructure.
 */
function isPrivateUrl(urlString: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return true; // Invalid URLs are rejected
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block non-HTTP protocols
  if (!['http:', 'https:'].includes(parsed.protocol)) return true;

  // Block localhost variants
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') return true;

  // Block private IPv4 ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 10) return true;                          // 10.0.0.0/8
    if (a === 172 && b! >= 16 && b! <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true;             // 192.168.0.0/16
    if (a === 169 && b === 254) return true;             // 169.254.0.0/16 (link-local)
    if (a === 0) return true;                            // 0.0.0.0/8
    if (a! >= 224) return true;                          // multicast + reserved
  }

  // Block common internal hostnames
  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.lan')) return true;

  return false;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageRecipes');
  if (forbidden) return forbidden;

  const { rateLimitGuard } = await import('@/lib/cache/rateLimit');
  const limited = await rateLimitGuard(auth.userId, 'recipe-import', 10, 60);
  if (limited) return limited;

  try {
    const body = await request.json();

    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // SSRF protection: block private/internal URLs
    if (isPrivateUrl(body.url)) {
      return NextResponse.json(
        { error: 'URLs pointing to private or internal networks are not allowed' },
        { status: 400 }
      );
    }

    // Parse recipe from URL
    const parsedRecipe = await parseRecipeFromUrl(body.url);

    if (!parsedRecipe) {
      return NextResponse.json(
        { error: 'Could not find recipe data on this page. The site may not use schema.org markup, or may be blocking automated access.' },
        { status: 422 }
      );
    }

    // Option to just preview without saving
    if (body.preview) {
      return NextResponse.json({
        preview: true,
        recipe: parsedRecipe,
      });
    }

    // Save to database
    const [newRecipe] = await db
      .insert(recipes)
      .values({
        name: parsedRecipe.name,
        description: parsedRecipe.description || null,
        url: parsedRecipe.url,
        sourceType: 'url_import',
        ingredients: parsedRecipe.ingredients,
        instructions: parsedRecipe.instructions || null,
        prepTime: parsedRecipe.prepTime || null,
        cookTime: parsedRecipe.cookTime || null,
        servings: parsedRecipe.servings || null,
        cuisine: parsedRecipe.cuisine || null,
        category: parsedRecipe.category || null,
        imageUrl: parsedRecipe.imageUrl || null,
        tags: [],
        createdBy: auth.userId,
      })
      .returning();

    await invalidateCache('recipes:*');

    return NextResponse.json(newRecipe, { status: 201 });
  } catch (error) {
    logError('Error importing recipe from URL:', error);

    if (error instanceof Error) {
      if (error.message === 'Invalid URL') {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        );
      }
      if (error.message === 'Only HTTP/HTTPS URLs are supported') {
        return NextResponse.json(
          { error: 'Only HTTP/HTTPS URLs are supported' },
          { status: 400 }
        );
      }
      if (error.message.includes('403')) {
        return NextResponse.json(
          { error: 'This site blocks automated requests (Cloudflare). The headless browser fallback could not load the page. Try a different recipe site, or add the recipe manually.' },
          { status: 502 }
        );
      }
      if (error.message.startsWith('Failed to fetch URL:')) {
        return NextResponse.json(
          { error: error.message },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to import recipe from URL' },
      { status: 500 }
    );
  }
}
