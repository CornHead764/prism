'use client';

import { useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import {
  ShoppingCart,
  Plus,
  Settings,
  Maximize2,
  Minimize2,
  Tags,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PageWrapper, SubpageHeader, UndoButton } from '@/components/layout';
import type { OverflowItem } from '@/components/layout';
import { ShoppingItemRow } from '@/app/shopping/ShoppingItemRow';
import { ShoppingCategoryCard } from '@/app/shopping/ShoppingCategoryCard';
import { ItemModal } from '@/app/shopping/ItemModal';
import { ListModal } from '@/app/shopping/ListModal';
import { ShoppingCelebration } from '@/app/shopping/ShoppingCelebration';
import { ManageCategoriesModal } from '@/app/shopping/ManageCategoriesModal';
import { useShoppingViewData } from './useShoppingViewData';
import { useShoppingCategories } from '@/lib/hooks/useShoppingCategories';
import { useShoppingDragReorder } from './useShoppingDragReorder';
import { useShoppingInlineInput, BASE_EMPTY_LINES } from './useShoppingInlineInput';
import { useShoppingCelebration } from './useShoppingCelebration';
import { useOrientation } from '@/lib/hooks/useOrientation';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { cn } from '@/lib/utils';
import type { ShoppingItem } from '@/types';

export function getCategoryEmoji(category: string): string {
  // Fallback function — components should prefer the hook's getCategoryEmoji
  const defaults: Record<string, string> = {
    produce: '🥬', dairy: '🥛', meat: '🥩', bakery: '🥖',
    frozen: '🧊', pantry: '🥫', household: '🧴',
  };
  return defaults[category] || '🛒';
}

export function ShoppingView() {
  const {
    lists, loading, error, refreshLists, familyMembers,
    requireAuth, apiAddItem,
    activeListId, setActiveListId,
    showChecked, setShowChecked,
    showAddItemModal, setShowAddItemModal,
    editingItem, setEditingItem,
    showListModal, setShowListModal,
    editingList, setEditingList,
    activeList, filteredItems,
    toggleItem, deleteItem,
    totalItems, checkedItems, progress,
  } = useShoppingViewData();

  const {
    categories: dynamicCategories,
    addCategory, removeCategory, reorderCategories,
    getCategoryEmoji: getDynCategoryEmoji,
    getCategoryColor: getDynCategoryColor,
  } = useShoppingCategories();

  const [defaultCategory, setDefaultCategory] = useState<string | null>(null);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);

  const categoryOrder = dynamicCategories.map(c => c.id);
  const effectiveCategoryOrder = activeList?.visibleCategories
    ? categoryOrder.filter(id => activeList.visibleCategories!.includes(id))
    : categoryOrder;

  const {
    draggedCategory,
    handleDragStart, handleDragOver, handleDragEnd,
    handleTouchStart, handleTouchMove, handleTouchEnd,
  } = useShoppingDragReorder({ categoryOrder, dynamicCategories, reorderCategories });

  const {
    inlineInputs, setInlineInputs, inputRefs, extraRows,
    handleInlineKeyDown, handleInlineBlur, addExtraRows,
  } = useShoppingInlineInput({ activeList, requireAuth, apiAddItem });

  const { showCelebration, setShowCelebration } = useShoppingCelebration(activeListId, checkedItems, totalItems);

  const orientation = useOrientation();
  const isMobile = useIsMobile();
  const isPortrait = orientation === 'portrait';
  const [shoppingMode, setShoppingMode] = useState(false);

  const groceryCategoryItems = effectiveCategoryOrder.map((cat) => ({
    category: cat,
    items: (filteredItems[cat] || []) as ShoppingItem[],
  }));

  const otherItems = Object.entries(filteredItems).filter(
    ([cat]) => !effectiveCategoryOrder.includes(cat)
  );

  const handleAddItem = async (category?: string) => {
    const user = await requireAuth("Who's adding an item?");
    if (!user) return;
    if (category) {
      setDefaultCategory(category);
    }
    setShowAddItemModal(true);
  };

  const handleNewList = async () => {
    const user = await requireAuth("Who's creating a list?");
    if (user) {
      setEditingList(null);
      setShowListModal(true);
    }
  };

  const handleEditItem = async (item: ShoppingItem) => {
    const user = await requireAuth("Who's editing this item?");
    if (user) {
      setEditingItem(item);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const user = await requireAuth("Who's deleting this item?");
    if (user) {
      deleteItem(itemId);
    }
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
    } catch (err) {
      console.error('Failed to add item:', err);
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
    } catch (err) {
      console.error('Failed to update item:', err);
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
      console.error('Failed to save list:', err);
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
      console.error('Failed to delete list:', err);
      toast({ title: err instanceof Error ? err.message : 'Failed to delete list. Please try again.', variant: 'destructive' });
    }
  } : undefined;

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        {!shoppingMode && (
          <>
            <SubpageHeader
              icon={<ShoppingCart className="h-5 w-5 text-primary" />}
              title="Shopping"
              badge={activeList ? <Badge variant="secondary">{checkedItems}/{totalItems}</Badge> : undefined}
              actions={<>
                <UndoButton />
                <Button variant="ghost" size="icon" onClick={() => setShoppingMode(true)} title="Enter shopping mode">
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button onClick={handleNewList} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add List
                </Button>
              </>}
              overflow={[
                ...(activeList ? [{
                  label: 'Edit List',
                  icon: Settings,
                  onClick: async () => {
                    const user = await requireAuth("Who's editing this list?");
                    if (user && user.role === 'parent') { setEditingList(activeList); setShowListModal(true); }
                    else if (user) toast({ title: 'Only parents can edit list settings', variant: 'warning' });
                  },
                }] : []),
                { label: 'Manage Categories', icon: Tags, onClick: () => setShowCategoriesModal(true) },
                { label: showChecked ? 'Hide Checked Items' : 'Show Checked Items', checked: showChecked, onClick: () => setShowChecked(!showChecked) },
              ] as OverflowItem[]}
            />

            <div className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-3 py-1">
              <div className="overflow-x-auto">
                <div className="flex gap-1 items-center min-w-max">
                  {lists.map((list) => {
                    const assignedMember = list.assignedTo ? familyMembers.find(m => m.id === list.assignedTo) : null;
                    return (
                      <Button key={list.id} variant={activeListId === list.id ? 'secondary' : 'ghost'} size="sm"
                        onClick={() => setActiveListId(list.id)} className="relative">
                        {list.name}
                        {assignedMember && (
                          <span className="ml-1.5 w-3 h-3 rounded-full inline-block"
                            style={{ backgroundColor: assignedMember.color }} title={`Assigned to ${assignedMember.name}`} />
                        )}
                        <Badge variant="outline" className="ml-2 text-xs">{list.items.length}</Badge>
                      </Button>
                    );
                  })}
                  <Button variant="outline" size="sm" className="border-dashed" onClick={handleNewList}>
                    <Plus className="h-3 w-3 mr-1" />New List
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {shoppingMode && (
          <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-3 py-1 safe-area-top">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <span className="font-medium">{activeList?.name}</span>
                <Badge variant="secondary" className="text-xs">{checkedItems}/{totalItems}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={progress} className="h-2 w-24" />
                <Button variant="ghost" size="sm" onClick={() => setShoppingMode(false)} title="Exit shopping mode">
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>
        )}

        {activeList && totalItems > 0 && !shoppingMode && (
          <div className="flex-shrink-0 px-3 py-1 bg-card/85 backdrop-blur-sm">
            <div className="max-w-6xl mx-auto flex items-center gap-3">
              <Progress value={progress} className="h-2 flex-1" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {checkedItems}/{totalItems} ({Math.round(progress)}%)
              </span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 pb-24">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4 opacity-50 animate-pulse" /><p className="text-lg">Loading shopping lists...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-destructive text-lg">Error: {error}</p>
              <p className="text-base mt-2">Please check your connection</p>
            </div>
          ) : !activeList ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4 opacity-50" /><p className="text-lg">No shopping lists yet</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleNewList}>Create your first list</Button>
            </div>
          ) : activeList ? (
            <div className="max-w-7xl mx-auto">
              <div className={cn(
                'grid gap-2',
                isMobile ? 'grid-cols-1' : isPortrait ? 'grid-cols-2' : 'grid-cols-3'
              )}>
                {groceryCategoryItems.map(({ category, items }) => {
                  const categoryExtraRows = extraRows[category] || 0;
                  const totalEmptyLines = BASE_EMPTY_LINES + categoryExtraRows;
                  const emptyLinesNeeded = Math.max(0, totalEmptyLines - items.length);

                  return (
                    <ShoppingCategoryCard
                      key={category}
                      category={category}
                      items={items}
                      categoryColor={getDynCategoryColor(category)}
                      categoryEmoji={getDynCategoryEmoji(category)}
                      isDragging={draggedCategory === category}
                      emptyLinesNeeded={emptyLinesNeeded}
                      extraRowCount={categoryExtraRows}
                      baseEmptyLines={BASE_EMPTY_LINES}
                      inlineInputValue={inlineInputs[category] || ''}
                      inputRefs={inputRefs}
                      onDragStart={() => handleDragStart(category)}
                      onDragOver={(e) => handleDragOver(e, category)}
                      onDragEnd={handleDragEnd}
                      onTouchStart={(e) => handleTouchStart(e, category)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      onToggleItem={(itemId) => toggleItem(itemId)}
                      onEditItem={handleEditItem}
                      onDeleteItem={(itemId) => handleDeleteItem(itemId)}
                      onAddItem={handleAddItem}
                      onInlineInputChange={(cat, value) => setInlineInputs(prev => ({ ...prev, [cat]: value }))}
                      onInlineKeyDown={handleInlineKeyDown}
                      onInlineBlur={handleInlineBlur}
                      onAddExtraRows={addExtraRows}
                      isMobile={isMobile}
                    />
                  );
                })}
              </div>

              {otherItems.length > 0 && (
                <div className="mt-6 space-y-4">
                  <h3 className="text-lg font-semibold text-muted-foreground">Other Items</h3>
                  {otherItems.map(([category, items]) => (
                    <div key={category} className="border rounded-lg p-3 bg-card/90 backdrop-blur-sm">
                      <h4 className="text-base font-semibold text-muted-foreground mb-2 capitalize flex items-center gap-2">
                        <span>{getDynCategoryEmoji(category)}</span><span>{category}</span>
                      </h4>
                      <div className="space-y-1">
                        {(items as ShoppingItem[]).map((item) => (
                          <ShoppingItemRow key={item.id} item={item}
                            onToggle={() => toggleItem(item.id)}
                            onEdit={() => handleEditItem(item)}
                            onDelete={() => handleDeleteItem(item.id)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {showAddItemModal && activeList && (
          <ItemModal listId={activeList.id} lists={lists} defaultCategory={defaultCategory || undefined}
            onClose={() => { setShowAddItemModal(false); setDefaultCategory(null); }}
            onSave={handleSaveNewItem} />
        )}

        {editingItem && (
          <ItemModal listId={editingItem.listId} item={editingItem}
            onClose={() => setEditingItem(null)} onSave={handleUpdateItem} />
        )}

        {showListModal && (
          <ListModal list={editingList} familyMembers={familyMembers} categories={dynamicCategories}
            onClose={() => { setShowListModal(false); setEditingList(null); }}
            onSave={handleSaveList} onDelete={handleDeleteList} />
        )}

        <ManageCategoriesModal open={showCategoriesModal} onOpenChange={setShowCategoriesModal} />

        <ShoppingCelebration
          show={showCelebration}
          onComplete={() => setShowCelebration(false)}
        />
      </div>
    </PageWrapper>
  );
}
