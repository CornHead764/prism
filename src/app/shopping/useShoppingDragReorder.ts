'use client';

import { useState, useRef, useCallback } from 'react';
import type { ShoppingCategoryDef } from '@/lib/hooks/useShoppingCategories';

interface UseShoppingDragReorderProps {
  categoryOrder: string[];
  dynamicCategories: ShoppingCategoryDef[];
  reorderCategories: (categories: ShoppingCategoryDef[]) => void;
}

export function useShoppingDragReorder({
  categoryOrder,
  dynamicCategories,
  reorderCategories,
}: UseShoppingDragReorderProps) {
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; element: HTMLElement | null }>({ x: 0, y: 0, element: null });

  const saveCategoryOrder = useCallback((order: string[]) => {
    const reordered = order.map(id => dynamicCategories.find(c => c.id === id)).filter(Boolean) as typeof dynamicCategories;
    reorderCategories(reordered);
  }, [dynamicCategories, reorderCategories]);

  const handleDragStart = useCallback((category: string) => {
    setDraggedCategory(category);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    if (!draggedCategory || draggedCategory === targetCategory) return;

    const newOrder = [...categoryOrder];
    const draggedIndex = newOrder.indexOf(draggedCategory);
    const targetIndex = newOrder.indexOf(targetCategory);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedCategory);
      saveCategoryOrder(newOrder);
    }
  }, [draggedCategory, categoryOrder, saveCategoryOrder]);

  const handleDragEnd = useCallback(() => {
    setDraggedCategory(null);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent, category: string) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      element: e.currentTarget as HTMLElement,
    };
    setDraggedCategory(category);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!draggedCategory) return;
    const touch = e.touches[0];
    if (!touch) return;

    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    for (const el of elements) {
      const categoryAttr = el.getAttribute('data-category');
      if (categoryAttr && categoryAttr !== draggedCategory) {
        const targetCategory = categoryAttr;
        const newOrder = [...categoryOrder];
        const draggedIndex = newOrder.indexOf(draggedCategory);
        const targetIndex = newOrder.indexOf(targetCategory);

        if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
          newOrder.splice(draggedIndex, 1);
          newOrder.splice(targetIndex, 0, draggedCategory);
          saveCategoryOrder(newOrder);
        }
        break;
      }
    }
  }, [draggedCategory, categoryOrder, saveCategoryOrder]);

  const handleTouchEnd = useCallback(() => {
    setDraggedCategory(null);
    touchStartRef.current = { x: 0, y: 0, element: null };
  }, []);

  return {
    draggedCategory,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
