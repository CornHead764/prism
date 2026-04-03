import { NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { shoppingItems, shoppingLists } from '@/lib/db/schema';
import { eq, and, ilike, isNull, or, asc } from 'drizzle-orm';
import { invalidateCache } from '@/lib/cache/redis';
import { lookupBarcode } from '@/lib/integrations/product-lookup';

async function getSetting(key: string): Promise<unknown> {
  try {
    const { settings } = await import('@/lib/db/schema');
    const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
    return row?.value ?? null;
  } catch { return null; }
}

async function resolveTargetList(defaultListId: string | null): Promise<string | null> {
  if (defaultListId) {
    const list = await db.query.shoppingLists.findFirst({
      where: eq(shoppingLists.id, defaultListId),
    });
    if (list) return list.id;
  }
  // Fall back to first list named "Groceries" (case-insensitive), then first list overall
  const all = await db.select({ id: shoppingLists.id, name: shoppingLists.name })
    .from(shoppingLists)
    .orderBy(asc(shoppingLists.sortOrder));
  const groceries = all.find(l => l.name.toLowerCase().includes('groceries'));
  return groceries?.id ?? all[0]?.id ?? null;
}

export async function POST(req: Request) {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as { barcode?: string };
    const barcode = body.barcode?.trim();

    if (!barcode) {
      return NextResponse.json({ error: 'barcode is required' }, { status: 400 });
    }
    // Validate: 1-20 chars, alphanumeric + hyphens
    if (!/^[a-zA-Z0-9-]{1,20}$/.test(barcode)) {
      return NextResponse.json({ error: 'invalid barcode' }, { status: 400 });
    }

    // Check scanner enabled setting
    const scannerEnabled = await getSetting('scanner.enabled');
    if (scannerEnabled === false) {
      return NextResponse.json({ error: 'Scanner is disabled' }, { status: 403 });
    }

    const product = await lookupBarcode(barcode);

    if (!product) {
      return NextResponse.json({ found: false, barcode });
    }

    // Resolve target list
    const defaultListId = (await getSetting('scanner.defaultListId')) as string | null;
    const listId = await resolveTargetList(defaultListId);
    if (!listId) {
      return NextResponse.json({ error: 'No shopping list found' }, { status: 500 });
    }

    // Duplicate check: same name (case-insensitive), same list, not checked
    const existing = await db.select({ id: shoppingItems.id })
      .from(shoppingItems)
      .where(and(
        eq(shoppingItems.listId, listId),
        ilike(shoppingItems.name, product.name),
        or(eq(shoppingItems.checked, false), isNull(shoppingItems.checked)),
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update source to 'scan' to refresh the indicator
      await db.update(shoppingItems)
        .set({ source: 'scan' })
        .where(eq(shoppingItems.id, existing[0]!.id));

      await invalidateCache('shopping-lists:*');
      return NextResponse.json({
        found: true,
        item: { name: product.name, brand: product.brand, category: product.category },
        action: 'updated_existing',
        listId,
        itemId: existing[0]!.id,
      });
    }

    // Insert new item
    const [newItem] = await db.insert(shoppingItems).values({
      listId,
      name: product.name,
      category: product.category ?? null,
      source: 'scan',
      notes: product.brand ? `${product.brand}` : null,
    }).returning({ id: shoppingItems.id });

    await invalidateCache('shopping-lists:*');

    return NextResponse.json({
      found: true,
      item: { name: product.name, brand: product.brand, category: product.category },
      action: 'added',
      listId,
      itemId: newItem!.id,
    });
  } catch (err) {
    console.error('Scan route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
