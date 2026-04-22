'use client';

import Image from 'next/image';
import { useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import {
  Heart,
  Plus,
  ExternalLink,
  Trash2,
  Edit2,
  ShoppingCart,
  Minus,
  ChevronDown,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Recipe } from '@/lib/hooks/useRecipes';
import { AddToMealPlanSection } from './AddToMealPlanSection';

export interface RecipeDetailModalProps {
  recipe: Recipe;
  shoppingLists: Array<{ id: string; name: string }>;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onAddToShoppingList: (listId: string, ingredients: Array<{ text: string }>) => Promise<void>;
}

export function RecipeDetailModal({
  recipe,
  shoppingLists,
  onClose,
  onEdit,
  onDelete,
  onToggleFavorite,
  onAddToShoppingList,
}: RecipeDetailModalProps) {
  const [desiredServings, setDesiredServings] = useState(recipe.servings || 1);
  const [showListPicker, setShowListPicker] = useState(false);
  const [addingToList, setAddingToList] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());

  const handleClose = () => {
    setCheckedIngredients(new Set());
    onClose();
  };

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const scaleFactor = recipe.servings ? desiredServings / recipe.servings : 1;

  // Scale ingredient text by adjusting numbers
  const scaleIngredient = (text: string): string => {
    if (scaleFactor === 1) return text;
    // Match numbers (including fractions like 1/2, decimals like 1.5)
    return text.replace(/(\d+\/\d+|\d+\.?\d*)/g, (match) => {
      if (match.includes('/')) {
        const parts = match.split('/').map(Number);
        const num = parts[0] ?? 0;
        const denom = parts[1] ?? 1;
        const scaled = (num / denom) * scaleFactor;
        // Return as fraction if close to common fractions, otherwise decimal
        if (Math.abs(scaled - 0.25) < 0.01) return '1/4';
        if (Math.abs(scaled - 0.33) < 0.01) return '1/3';
        if (Math.abs(scaled - 0.5) < 0.01) return '1/2';
        if (Math.abs(scaled - 0.67) < 0.01) return '2/3';
        if (Math.abs(scaled - 0.75) < 0.01) return '3/4';
        return scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1);
      }
      const scaled = parseFloat(match) * scaleFactor;
      return scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1);
    });
  };

  const handleAddToList = async (listId: string) => {
    if (!recipe.ingredients || recipe.ingredients.length === 0) return;
    setAddingToList(true);
    try {
      // Scale ingredients before adding
      const scaledIngredients = recipe.ingredients.map((ing) => ({
        text: scaleIngredient(ing.text),
      }));
      await onAddToShoppingList(listId, scaledIngredients);
      setShowListPicker(false);
      toast({ title: `Added ${scaledIngredients.length} ingredients to shopping list!`, variant: 'success' });
    } catch {
      toast({ title: 'Failed to add ingredients to shopping list', variant: 'destructive' });
    } finally {
      setAddingToList(false);
    }
  };

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className={cn(
        'overflow-y-auto',
        isMaximized
          ? 'max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh]'
          : 'max-w-2xl max-h-[90vh]'
      )}>
        <DialogHeader>
          <div className="flex items-start justify-between pr-8">
            <DialogTitle className="text-xl">{recipe.name}</DialogTitle>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                title={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </button>
              <button
                onClick={onToggleFavorite}
                className="p-1"
                title={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart
                  className={cn(
                    'h-5 w-5 transition-colors',
                    recipe.isFavorite
                      ? 'fill-red-500 text-red-500'
                      : 'text-muted-foreground hover:text-red-500'
                  )}
                />
              </button>
            </div>
          </div>
        </DialogHeader>

        {recipe.imageUrl && (
          <div className="relative h-48 -mx-6 -mt-2 bg-muted overflow-hidden">
            <Image
              src={recipe.imageUrl}
              alt={recipe.name}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        )}

        <div className="space-y-4">
          {recipe.description && (
            <p className="text-muted-foreground">{recipe.description}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm items-center">
            {recipe.prepTime && (
              <div>
                <span className="text-muted-foreground">Prep:</span>{' '}
                {recipe.prepTime} min
              </div>
            )}
            {recipe.cookTime && (
              <div>
                <span className="text-muted-foreground">Cook:</span>{' '}
                {recipe.cookTime} min
              </div>
            )}
            {recipe.servings && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Servings:</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setDesiredServings(Math.max(1, desiredServings - 1))}
                    disabled={desiredServings <= 1}
                    aria-label="Decrease servings"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-medium">{desiredServings}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setDesiredServings(desiredServings + 1)}
                    aria-label="Increase servings"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                {scaleFactor !== 1 && (
                  <span className="text-xs text-muted-foreground">
                    (scaled {scaleFactor > 1 ? 'up' : 'down'})
                  </span>
                )}
              </div>
            )}
            {recipe.timesMade > 0 && (
              <div>
                <span className="text-muted-foreground">Made:</span>{' '}
                {recipe.timesMade} time{recipe.timesMade !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Ingredients</h4>
                {shoppingLists.length > 0 && recipe.ingredients.length > 0 && (
                  <div className="relative">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowListPicker(!showListPicker)}
                      disabled={addingToList}
                    >
                      <ShoppingCart className="h-3 w-3 mr-1" />
                      Add to Shopping List
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                    {showListPicker && (
                      <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-md shadow-lg z-10 min-w-[150px]">
                        {shoppingLists.map((list) => (
                          <button
                            key={list.id}
                            onClick={() => handleAddToList(list.id)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent first:rounded-t-md last:rounded-b-md"
                          >
                            {list.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <ul className="space-y-1">
                {recipe.ingredients.map((ing, i) => (
                  <li
                    key={i}
                    onClick={() => toggleIngredient(i)}
                    className={cn(
                      'text-sm flex items-start gap-2 cursor-pointer select-none hover:bg-accent/50 rounded px-1 -mx-1 transition-colors',
                      checkedIngredients.has(i) && 'line-through text-muted-foreground'
                    )}
                  >
                    <span className="text-muted-foreground">&bull;</span>
                    {scaleIngredient(ing.text)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recipe.instructions && (
            <div>
              <h4 className="font-semibold mb-2">Instructions</h4>
              <div className="text-sm whitespace-pre-wrap">{recipe.instructions}</div>
            </div>
          )}

          {recipe.notes && (
            <div>
              <h4 className="font-semibold mb-2">Notes</h4>
              <p className="text-sm text-muted-foreground">{recipe.notes}</p>
            </div>
          )}

          {recipe.url && (
            <div>
              <a
                href={recipe.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                View original recipe
              </a>
            </div>
          )}
        </div>

        <AddToMealPlanSection recipe={recipe} />

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <Button variant="outline" onClick={onEdit}>
              <Edit2 className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button onClick={handleClose}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
