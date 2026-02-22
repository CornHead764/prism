/**
 * Tests for the recipe parser's internal pure functions.
 *
 * We test the helpers (parseDuration, parseServings, parseImage, parseInstructions,
 * parseAuthor, firstValue, findRecipeJsonLd) by importing the module and testing
 * parseRecipeFromUrl indirectly through findRecipeJsonLd-based extraction.
 *
 * Since parseRecipeFromUrl does a fetch, we mock fetch for integration-style tests
 * and test the pure parsing logic with crafted HTML.
 */

// The internal functions are not exported, so we test through the public API
// by mocking fetch and providing crafted HTML responses.

const RECIPE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Test Pasta',
  description: 'A delicious test pasta',
  image: 'https://example.com/pasta.jpg',
  recipeIngredient: ['2 cups pasta', '1 cup sauce', '1/4 cup cheese'],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Boil the pasta.' },
    { '@type': 'HowToStep', text: 'Add sauce.' },
    { '@type': 'HowToStep', text: 'Top with cheese.' },
  ],
  prepTime: 'PT10M',
  cookTime: 'PT20M',
  totalTime: 'PT30M',
  recipeYield: '4 servings',
  recipeCuisine: 'Italian',
  recipeCategory: 'Main Course',
  author: { name: 'Chef Test' },
};

function makeHtml(jsonLd: object | object[]): string {
  return `
    <html><head>
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    </head><body></body></html>
  `;
}

function makeGraphHtml(items: object[]): string {
  return makeHtml({ '@context': 'https://schema.org', '@graph': items });
}

// Mock global fetch
const originalFetch = global.fetch;
beforeAll(() => {
  global.fetch = jest.fn();
});
afterAll(() => {
  global.fetch = originalFetch;
});

function mockFetchHtml(html: string) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    text: async () => html,
  });
}

function mockFetchError(status: number) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Not Found',
  });
}

// Dynamic import to avoid issues with fetch mock timing
async function parseRecipe(url: string) {
  const { parseRecipeFromUrl } = await import('../recipeParser');
  return parseRecipeFromUrl(url);
}

describe('parseRecipeFromUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('URL validation and SSRF blocking', () => {
    it('rejects invalid URLs', async () => {
      await expect(parseRecipe('not-a-url')).rejects.toThrow('Invalid URL');
    });

    it('rejects non-HTTP protocols', async () => {
      await expect(parseRecipe('ftp://example.com/recipe')).rejects.toThrow('Only HTTP/HTTPS URLs are supported');
    });

    it('blocks localhost', async () => {
      await expect(parseRecipe('http://localhost/recipe')).rejects.toThrow('blocked address');
    });

    it('blocks 127.x.x.x', async () => {
      await expect(parseRecipe('http://127.0.0.1/recipe')).rejects.toThrow('blocked address');
    });

    it('blocks 10.x.x.x private range', async () => {
      await expect(parseRecipe('http://10.0.0.1/recipe')).rejects.toThrow('blocked address');
    });

    it('blocks 192.168.x.x private range', async () => {
      await expect(parseRecipe('http://192.168.1.1/recipe')).rejects.toThrow('blocked address');
    });

    it('blocks 172.16-31.x.x private range', async () => {
      await expect(parseRecipe('http://172.16.0.1/recipe')).rejects.toThrow('blocked address');
      await expect(parseRecipe('http://172.31.255.255/recipe')).rejects.toThrow('blocked address');
    });

    it('blocks 0.0.0.0', async () => {
      await expect(parseRecipe('http://0.0.0.0/recipe')).rejects.toThrow('blocked address');
    });

    it('allows public URLs', async () => {
      mockFetchHtml(makeHtml(RECIPE_JSON_LD));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result).not.toBeNull();
    });
  });

  describe('fetch error handling', () => {
    it('throws on non-OK response', async () => {
      mockFetchError(404);
      await expect(parseRecipe('https://example.com/recipe')).rejects.toThrow('Failed to fetch URL: 404');
    });
  });

  describe('JSON-LD discovery', () => {
    it('finds a direct Recipe @type', async () => {
      mockFetchHtml(makeHtml(RECIPE_JSON_LD));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.name).toBe('Test Pasta');
    });

    it('finds Recipe in @graph array', async () => {
      mockFetchHtml(makeGraphHtml([
        { '@type': 'WebPage', name: 'Page' },
        RECIPE_JSON_LD,
      ]));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.name).toBe('Test Pasta');
    });

    it('finds Recipe when @type is an array', async () => {
      mockFetchHtml(makeHtml({ ...RECIPE_JSON_LD, '@type': ['Recipe', 'Thing'] }));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.name).toBe('Test Pasta');
    });

    it('finds Recipe in a JSON-LD array', async () => {
      mockFetchHtml(makeHtml([{ '@type': 'WebSite' }, RECIPE_JSON_LD]));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.name).toBe('Test Pasta');
    });

    it('returns null when no Recipe found', async () => {
      mockFetchHtml(makeHtml({ '@type': 'WebSite', name: 'Not a recipe' }));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result).toBeNull();
    });

    it('handles invalid JSON-LD gracefully', async () => {
      mockFetchHtml('<html><head><script type="application/ld+json">{not valid json}</script></head></html>');
      const result = await parseRecipe('https://example.com/recipe');
      expect(result).toBeNull();
    });
  });

  describe('duration parsing', () => {
    it('parses PT30M as 30 minutes', async () => {
      mockFetchHtml(makeHtml({ ...RECIPE_JSON_LD, prepTime: 'PT30M' }));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.prepTime).toBe(30);
    });

    it('parses PT1H30M as 90 minutes', async () => {
      mockFetchHtml(makeHtml({ ...RECIPE_JSON_LD, cookTime: 'PT1H30M' }));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.cookTime).toBe(90);
    });

    it('parses PT2H as 120 minutes', async () => {
      mockFetchHtml(makeHtml({ ...RECIPE_JSON_LD, totalTime: 'PT2H' }));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.totalTime).toBe(120);
    });

    it('handles missing duration gracefully', async () => {
      const noTimes = { ...RECIPE_JSON_LD };
      delete (noTimes as Record<string, unknown>).prepTime;
      delete (noTimes as Record<string, unknown>).cookTime;
      delete (noTimes as Record<string, unknown>).totalTime;
      mockFetchHtml(makeHtml(noTimes));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.prepTime).toBeUndefined();
      expect(result?.cookTime).toBeUndefined();
      expect(result?.totalTime).toBeUndefined();
    });
  });

  describe('servings parsing', () => {
    it('parses "4 servings"', async () => {
      mockFetchHtml(makeHtml({ ...RECIPE_JSON_LD, recipeYield: '4 servings' }));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.servings).toBe(4);
    });

    it('parses numeric yield', async () => {
      mockFetchHtml(makeHtml({ ...RECIPE_JSON_LD, recipeYield: 6 }));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.servings).toBe(6);
    });

    it('extracts number from "Makes 12"', async () => {
      mockFetchHtml(makeHtml({ ...RECIPE_JSON_LD, recipeYield: 'Makes 12' }));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.servings).toBe(12);
    });
  });

  describe('image parsing', () => {
    it('handles string image', async () => {
      mockFetchHtml(makeHtml({ ...RECIPE_JSON_LD, image: 'https://img.com/photo.jpg' }));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.imageUrl).toBe('https://img.com/photo.jpg');
    });

    it('handles array of strings', async () => {
      mockFetchHtml(makeHtml({ ...RECIPE_JSON_LD, image: ['https://img.com/1.jpg', 'https://img.com/2.jpg'] }));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.imageUrl).toBe('https://img.com/1.jpg');
    });

    it('handles array of objects with url', async () => {
      mockFetchHtml(makeHtml({ ...RECIPE_JSON_LD, image: [{ url: 'https://img.com/obj.jpg' }] }));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.imageUrl).toBe('https://img.com/obj.jpg');
    });
  });

  describe('instructions parsing', () => {
    it('handles string instructions', async () => {
      mockFetchHtml(makeHtml({ ...RECIPE_JSON_LD, recipeInstructions: 'Just cook it.' }));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.instructions).toBe('Just cook it.');
    });

    it('handles array of HowToStep objects', async () => {
      mockFetchHtml(makeHtml(RECIPE_JSON_LD));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.instructions).toContain('1. Boil the pasta.');
      expect(result?.instructions).toContain('2. Add sauce.');
      expect(result?.instructions).toContain('3. Top with cheese.');
    });

    it('handles array of strings', async () => {
      mockFetchHtml(makeHtml({ ...RECIPE_JSON_LD, recipeInstructions: ['Step one', 'Step two'] }));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.instructions).toContain('1. Step one');
      expect(result?.instructions).toContain('2. Step two');
    });
  });

  describe('author parsing', () => {
    it('handles string author', async () => {
      mockFetchHtml(makeHtml({ ...RECIPE_JSON_LD, author: 'Jane Doe' }));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.author).toBe('Jane Doe');
    });

    it('handles object author with name', async () => {
      mockFetchHtml(makeHtml({ ...RECIPE_JSON_LD, author: { name: 'Chef Bob' } }));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.author).toBe('Chef Bob');
    });

    it('handles array of author objects', async () => {
      mockFetchHtml(makeHtml({ ...RECIPE_JSON_LD, author: [{ name: 'Alice' }] }));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.author).toBe('Alice');
    });
  });

  describe('cuisine and category', () => {
    it('extracts string values', async () => {
      mockFetchHtml(makeHtml(RECIPE_JSON_LD));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.cuisine).toBe('Italian');
      expect(result?.category).toBe('Main Course');
    });

    it('extracts first value from arrays', async () => {
      mockFetchHtml(makeHtml({
        ...RECIPE_JSON_LD,
        recipeCuisine: ['Mexican', 'Tex-Mex'],
        recipeCategory: ['Appetizer', 'Snack'],
      }));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result?.cuisine).toBe('Mexican');
      expect(result?.category).toBe('Appetizer');
    });
  });

  describe('full extraction', () => {
    it('extracts all fields from a complete recipe', async () => {
      mockFetchHtml(makeHtml(RECIPE_JSON_LD));
      const result = await parseRecipe('https://example.com/recipe');
      expect(result).toEqual({
        name: 'Test Pasta',
        description: 'A delicious test pasta',
        url: 'https://example.com/recipe',
        imageUrl: 'https://example.com/pasta.jpg',
        ingredients: [
          { text: '2 cups pasta' },
          { text: '1 cup sauce' },
          { text: '1/4 cup cheese' },
        ],
        instructions: expect.stringContaining('Boil the pasta'),
        prepTime: 10,
        cookTime: 20,
        totalTime: 30,
        servings: 4,
        cuisine: 'Italian',
        category: 'Main Course',
        author: 'Chef Test',
      });
    });
  });
});
