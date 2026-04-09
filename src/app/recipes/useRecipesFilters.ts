'use client';

import { useState, useMemo } from 'react';
import type { Recipe } from '@/lib/hooks/useRecipes';

export function useRecipesFilters(recipes: Recipe[]) {
  const [search, setSearch] = useState('');
  const [filterCuisine, setFilterCuisine] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const cuisines = useMemo(() => {
    const unique = new Set(recipes.map(r => r.cuisine).filter(Boolean));
    return Array.from(unique).sort() as string[];
  }, [recipes]);

  const categories = useMemo(() => {
    const unique = new Set(recipes.map(r => r.category).filter(Boolean));
    return Array.from(unique).sort() as string[];
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    let result = recipes;
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(r =>
        r.name.toLowerCase().includes(s) ||
        r.description?.toLowerCase().includes(s) ||
        r.cuisine?.toLowerCase().includes(s) ||
        r.category?.toLowerCase().includes(s)
      );
    }
    if (filterCuisine) result = result.filter(r => r.cuisine === filterCuisine);
    if (filterCategory) result = result.filter(r => r.category === filterCategory);
    return result;
  }, [recipes, search, filterCuisine, filterCategory]);

  const clearFilters = () => { setFilterCuisine(null); setFilterCategory(null); };

  return {
    search, setSearch,
    filterCuisine, setFilterCuisine,
    filterCategory, setFilterCategory,
    cuisines, categories, filteredRecipes,
    clearFilters,
    hasActiveFilters: !!(filterCuisine || filterCategory),
  };
}
