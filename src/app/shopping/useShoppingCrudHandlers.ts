'use client';

import { toast } from '@/components/ui/use-toast';
import type { ShoppingItem, ShoppingList } from '@/types';

interface AddItemData {
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
  notes?: string;
  addedBy?: string;
}

interface CrudDeps {
  requireAuth: (prompt: string) => Promise<unknown>;
  refreshLists: () => void;
  setShowAddItemModal: (v: boolean) => void;
  setDefaultCategory: (v: string | null) => void;
  setEditingItem: (v: ShoppingItem | null) => void;
  setShowListModal: (v: boolean) => void;
  setEditingList: (v: ShoppingList | null) => void;
  setActiveListId: (v: string) => void;
  deleteItem: (id: string) => void;
  apiAddItem: (listId: string, item: AddItemData) => Promise<unknown>;
  activeList: { id: string } | null | undefined;
  editingItem: ShoppingItem | null;
  editingList: ShoppingList | null;
  lists: { id: string }[];
}

export function useShoppingCrudHandlers(deps: CrudDeps) {
  const {
    requireAuth, refreshLists,
    setShowAddItemModal, setDefaultCategory, setEditingItem,
    setShowListModal, setEditingList, setActiveListId,
    deleteItem, apiAddItem,
    activeList, editingItem, editingList, lists,
  } = deps;

  const handleAddItem = async (category?: string) => {
    const user = await requireAuth("Who's adding an item?");
    if (!user) return;
    if (category) setDefaultCategory(category);
    setShowAddItemModal(true);
  };

  const handleNewList = async () => {
    const user = await requireAuth("Who's creating a list?");
    if (user) { setEditingList(null); setShowListModal(true); }
  };

  const handleEditItem = async (item: ShoppingItem) => {
    const user = await requireAuth("Who's editing this item?");
    if (user) setEditingItem(item);
  };

  const handleDeleteItem = async (itemId: string) => {
    const user = await requireAuth("Who's deleting this item?");
    if (user) deleteItem(itemId);
  };

  const handleSaveNewItem = async (item: Omit<ShoppingItem, 'id' | 'createdAt'>) => {
    const user = await requireAuth("Who's adding an item?");
    if (!user) { setShowAddItemModal(false); setDefaultCategory(null); return; }
    try {
      await apiAddItem(item.listId, {
        name: item.name, quantity: item.quantity ?? undefined,
        unit: item.unit ?? undefined, category: item.category ?? undefined,
        notes: item.notes ?? undefined,
      });
      setShowAddItemModal(false);
      setDefaultCategory(null);
      if (activeList && item.listId !== activeList.id) setActiveListId(item.listId);
    } catch {
      toast({ title: 'Failed to add item. Please try again.', variant: 'destructive' });
    }
  };

  const handleUpdateItem = async (updatedItem: Omit<ShoppingItem, 'id' | 'createdAt'>) => {
    if (!editingItem) return;
    try {
      const response = await fetch(`/api/shopping-items/${editingItem.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updatedItem.name, quantity: updatedItem.quantity,
          unit: updatedItem.unit, category: updatedItem.category, notes: updatedItem.notes,
        }),
      });
      if (!response.ok) throw new Error('Failed to update item');
      setEditingItem(null);
      refreshLists();
    } catch {
      toast({ title: 'Failed to update item. Please try again.', variant: 'destructive' });
    }
  };

  const handleSaveList = async (listData: { name: string; description?: string; assignedTo?: string; listType?: string; visibleCategories?: string[] | null }) => {
    try {
      if (editingList) {
        const response = await fetch(`/api/shopping-lists/${editingList.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(listData),
        });
        if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Failed to update list'); }
      } else {
        const response = await fetch('/api/shopping-lists', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(listData),
        });
        if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Failed to create list'); }
        const newList = await response.json();
        setActiveListId(newList.id);
      }
      setShowListModal(false);
      setEditingList(null);
      refreshLists();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Failed to save list. Please try again.', variant: 'destructive' });
    }
  };

  const handleDeleteList = editingList ? async () => {
    try {
      const response = await fetch(`/api/shopping-lists/${editingList.id}`, { method: 'DELETE' });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Failed to delete list'); }
      setShowListModal(false);
      setEditingList(null);
      const remainingLists = lists.filter(l => l.id !== editingList.id);
      setActiveListId(remainingLists[0]?.id || '');
      refreshLists();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Failed to delete list. Please try again.', variant: 'destructive' });
    }
  } : undefined;

  return { handleAddItem, handleNewList, handleEditItem, handleDeleteItem, handleSaveNewItem, handleUpdateItem, handleSaveList, handleDeleteList };
}
