'use client';

import { useState, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';

type ScanStep = 'loading' | 'duplicate' | 'list' | 'category' | null;

interface ScanProduct { name: string; brand?: string; suggestedCategory?: string | null }
interface ScanExisting { listId: string; listName: string; itemId: string }

export interface ScanState {
  barcode: string;
  product: ScanProduct | null;
  existingInLists: ScanExisting[];
  step: ScanStep;
  targetListId: string | null;
  targetListName: string | null;
}

export function useShoppingScanFlow() {
  const [scan, setScan] = useState<ScanState | null>(null);

  const clearScan = useCallback(() => setScan(null), []);

  // Called by overlay after decode — close the scanner immediately, then look up product
  const handleCameraScan = useCallback(async (barcode: string, onScannerClose: () => void) => {
    onScannerClose();
    setScan({ barcode, product: null, existingInLists: [], step: 'loading', targetListId: null, targetListName: null });
    try {
      const r = await fetch('/api/shopping/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode, dryRun: true }),
      });
      const data = await r.json() as {
        found: boolean;
        product?: ScanProduct;
        existingInLists?: ScanExisting[];
      };
      if (!data.found || !data.product) {
        toast({ title: 'Product not found', description: 'Barcode not in database. Add it manually.', variant: 'destructive' });
        setScan(null);
        return;
      }
      setScan(prev => prev ? ({ ...prev, product: data.product!, existingInLists: data.existingInLists ?? [], step: 'list' }) : null);
    } catch {
      toast({ title: 'Lookup failed', variant: 'destructive' });
      setScan(null);
    }
  }, []);

  // After list is chosen — check for cross-list duplicates, then go to category picker
  const handleListChosen = useCallback((listId: string, listName: string) => {
    setScan(prev => {
      if (!prev) return null;
      const inOtherLists = prev.existingInLists.filter(e => e.listId !== listId);
      return { ...prev, targetListId: listId, targetListName: listName, step: inOtherLists.length > 0 ? 'duplicate' : 'category' };
    });
  }, []);

  // Execute the actual add
  const doAdd = useCallback(async (category: string | null) => {
    if (!scan?.product || !scan.targetListId) return;
    setScan(prev => prev ? { ...prev, step: null } : null);
    try {
      const r = await fetch('/api/shopping/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: scan.barcode, listId: scan.targetListId, ...(category ? { category } : {}) }),
      });
      const data = await r.json() as { found: boolean; item?: { name: string }; action?: string; itemId?: string };
      setScan(null);
      if (!data.found) { toast({ title: 'Product not found', variant: 'destructive' }); return; }
      window.dispatchEvent(new CustomEvent('prism:scan-result', { detail: data }));
      toast({ title: data.action === 'updated_existing' ? `Already on list — ${data.item!.name}` : `Added — ${data.item!.name}` });
    } catch {
      setScan(null);
      toast({ title: 'Add failed', variant: 'destructive' });
    }
  }, [scan]);

  return { scan, clearScan, handleCameraScan, handleListChosen, doAdd };
}
