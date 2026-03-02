'use client';

import { useCallback } from 'react';
import { useFetch } from './useFetch';

export type { Meal } from '@/types';
import type { Meal } from '@/types';

interface UseMealsOptions {
  weekOf?: string;
  refreshInterval?: number;
  enabled?: boolean;
}

function transformMeals(json: unknown): Meal[] {
  const data = json as {
    meals: Array<{
      id: string;
      name: string;
      description: string | null;
      recipe: string | null;
      recipeUrl: string | null;
      prepTime: number | null;
      cookTime: number | null;
      servings: number | null;
      ingredients: string | null;
      weekOf: string;
      dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
      mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
      cookedAt: string | null;
      cookedBy: { id: string; name: string; color: string } | null;
      createdBy: { id: string; name: string; color: string } | null;
      createdAt: string;
    }>;
  };
  return data.meals.map((meal) => ({
    id: meal.id,
    name: meal.name,
    description: meal.description || undefined,
    recipe: meal.recipe || undefined,
    recipeUrl: meal.recipeUrl || undefined,
    prepTime: meal.prepTime || undefined,
    cookTime: meal.cookTime || undefined,
    servings: meal.servings || undefined,
    ingredients: meal.ingredients || undefined,
    weekOf: meal.weekOf,
    dayOfWeek: meal.dayOfWeek,
    mealType: meal.mealType,
    cookedAt: meal.cookedAt ? new Date(meal.cookedAt) : undefined,
    cookedBy: meal.cookedBy || undefined,
    createdBy: meal.createdBy || undefined,
    createdAt: new Date(meal.createdAt),
  }));
}

export function useMeals(options: UseMealsOptions = {}) {
  const { weekOf, refreshInterval = 5 * 60 * 1000, enabled } = options;

  const params = new URLSearchParams();
  if (weekOf) params.set('weekOf', weekOf);

  const { data: meals, loading, error, refresh } = useFetch<Meal[]>({
    url: `/api/meals?${params.toString()}`,
    initialData: [],
    transform: transformMeals,
    refreshInterval,
    label: 'meals',
    enabled,
  });

  const markCooked = useCallback(
    async (mealId: string, cookedBy?: string) => {
      try {
        const response = await fetch(`/api/meals/${mealId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cookedAt: new Date().toISOString(),
            cookedBy: cookedBy || null,
          }),
        });

        if (!response.ok) throw new Error('Failed to mark meal as cooked');
        await refresh();
      } catch (err) {
        console.error('Error marking meal as cooked:', err);
        throw err;
      }
    },
    [refresh]
  );

  return { meals, loading, error, refresh, markCooked };
}
