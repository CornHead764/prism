'use client';

import { useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Recipe } from '@/lib/hooks/useRecipes';

export interface RecipeFormModalProps {
  recipe?: Recipe;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description?: string;
    ingredients?: Array<{ text: string }>;
    instructions?: string;
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    cuisine?: string;
    category?: string;
    imageUrl?: string;
    notes?: string;
  }) => Promise<void>;
}

export function RecipeFormModal({ recipe, onClose, onSave }: RecipeFormModalProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(recipe?.name || '');
  const [description, setDescription] = useState(recipe?.description || '');
  const [ingredientsText, setIngredientsText] = useState(
    recipe?.ingredients?.map((i) => i.text).join('\n') || ''
  );
  const [instructions, setInstructions] = useState(recipe?.instructions || '');
  const [prepTime, setPrepTime] = useState(recipe?.prepTime?.toString() || '');
  const [cookTime, setCookTime] = useState(recipe?.cookTime?.toString() || '');
  const [servings, setServings] = useState(recipe?.servings?.toString() || '');
  const [cuisine, setCuisine] = useState(recipe?.cuisine || '');
  const [category, setCategory] = useState(recipe?.category || '');
  const [imageUrl, setImageUrl] = useState(recipe?.imageUrl || '');
  const [notes, setNotes] = useState(recipe?.notes || '');

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Recipe name is required', variant: 'warning' });
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        ingredients: ingredientsText
          .split('\n')
          .filter((line) => line.trim())
          .map((text) => ({ text: text.trim() })),
        instructions: instructions.trim() || undefined,
        prepTime: prepTime ? parseInt(prepTime, 10) : undefined,
        cookTime: cookTime ? parseInt(cookTime, 10) : undefined,
        servings: servings ? parseInt(servings, 10) : undefined,
        cuisine: cuisine.trim() || undefined,
        category: category.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      toast({ title: 'Failed to save recipe', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{recipe ? 'Edit Recipe' : 'Add Recipe'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Recipe Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Chicken Parmesan"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prepTime">Prep Time (min)</Label>
              <Input
                id="prepTime"
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cookTime">Cook Time (min)</Label>
              <Input
                id="cookTime"
                type="number"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="servings">Servings</Label>
              <Input
                id="servings"
                type="number"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cuisine">Cuisine</Label>
              <Input
                id="cuisine"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                placeholder="e.g., Italian"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Main Dish"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ingredients">Ingredients (one per line)</Label>
            <Textarea
              id="ingredients"
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              placeholder="1 lb chicken breast&#10;1 cup breadcrumbs&#10;..."
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Step-by-step instructions..."
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input
              id="imageUrl"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Personal notes, tips, variations..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : recipe ? 'Save Changes' : 'Add Recipe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
