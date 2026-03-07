'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface ImportPaprikaModalProps {
  onClose: () => void;
  onImport: (html: string, preview?: boolean) => Promise<unknown>;
}

export function ImportPaprikaModal({ onClose, onImport }: ImportPaprikaModalProps) {
  const [html, setHtml] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!html.trim()) return;

    setImporting(true);
    setError(null);

    try {
      await onImport(html.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import recipes');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from Paprika</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Export your recipes from Paprika as HTML, then paste the content
            below. We&apos;ll import all recipes found in the export.
          </p>

          <div className="space-y-2">
            <Label htmlFor="html">Paprika HTML Export</Label>
            <Textarea
              id="html"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder="Paste Paprika HTML export here..."
              rows={10}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!html.trim() || importing}>
            {importing ? 'Importing...' : 'Import Recipes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
