'use client';

import { format, parseISO, formatDistanceToNow, isPast, differenceInDays } from 'date-fns';
import { useState, useMemo, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  ClipboardList,
  Plus,
  AlertCircle,
  Clock,
  History,
  CheckCircle2,
  Hourglass,
  ShieldCheck,
  Users,
  CalendarDays,
  Settings,
  GripVertical,
  Trash2,
  X,
  Undo2,
} from 'lucide-react';
import { useOrientation } from '@/lib/hooks/useOrientation';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useDragReorder } from '@/lib/hooks/useDragReorder';
import { PlaneCelebration } from '@/components/ui/PlaneCelebration';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/ui/avatar';
import { PageWrapper, SubpageHeader, FilterBar, SortSelect, FilterDropdown, PersonFilter } from '@/components/layout';
import type { OverflowItem } from '@/components/layout';
import { ChoreItem, getCategoryEmoji } from '@/app/chores/ChoreItem';
import { ChoreModal } from '@/app/chores/ChoreModal';
import { useChoresViewData } from './useChoresViewData';
import { useAuth } from '@/components/providers';
import { cn } from '@/lib/utils';

const CHORE_CATEGORIES = [
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'dishes', label: 'Dishes' },
  { value: 'yard', label: 'Yard' },
  { value: 'pets', label: 'Pets' },
  { value: 'trash', label: 'Trash' },
];

// ---------- Grouped chore grid with drag reorder ----------

interface ChoreGroupGridProps {
  choresByUser: { user: { id: string; name: string; color: string } | null; chores: any[] }[];
  inlineChoreByUser: Record<string, string>;
  setInlineChoreByUser: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  inlineAddChore: (title: string, assignedTo?: string) => Promise<boolean>;
  completeChore: (id: string) => Promise<boolean>;
  editChore: (chore: any) => void;
  deleteChore: (id: string) => void;
  setCelebratingUser: (user: { id: string; name: string } | null) => void;
  isMobile?: boolean;
}

function ChoreGroupGrid({
  choresByUser,
  inlineChoreByUser,
  setInlineChoreByUser,
  inlineAddChore,
  completeChore,
  editChore,
  deleteChore,
  setCelebratingUser,
  isMobile = false,
}: ChoreGroupGridProps) {
  const groupKeys = useMemo(() => choresByUser.map(g => g.user?.id || 'unassigned'), [choresByUser]);
  const [groupOrder, setGroupOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('prism:chore-group-order');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const effectiveOrder = useMemo(() => {
    const known = groupOrder.filter(k => groupKeys.includes(k));
    const newKeys = groupKeys.filter(k => !known.includes(k));
    return [...known, ...newKeys];
  }, [groupOrder, groupKeys]);

  const saveOrder = useCallback((order: string[]) => {
    setGroupOrder(order);
    try { localStorage.setItem('prism:chore-group-order', JSON.stringify(order)); } catch {}
  }, []);

  const { draggedId, getDragProps } = useDragReorder({ order: effectiveOrder, onReorder: saveOrder });

  const sortedGroups = useMemo(() => {
    const map = new Map(choresByUser.map(g => [g.user?.id || 'unassigned', g]));
    return effectiveOrder.map(k => map.get(k)).filter(Boolean) as typeof choresByUser;
  }, [choresByUser, effectiveOrder]);

  return (
    <div className={cn(
      'grid gap-2 h-full',
      isMobile ? 'grid-cols-1' :
      sortedGroups.length <= 2 ? 'grid-cols-1 md:grid-cols-2' :
      sortedGroups.length <= 4 ? 'grid-cols-2' :
      'grid-cols-2 md:grid-cols-3'
    )}>
      {sortedGroups.map(({ user, chores }) => {
        const userColor = user?.color || '#6B7280';
        const key = user?.id || 'unassigned';
        const isDragging = draggedId === key;
        return (
          <div
            key={key}
            {...(isMobile ? {} : getDragProps(key))}
            className={cn(
              'flex flex-col border-2 rounded-lg overflow-hidden bg-card/90 backdrop-blur-sm transition-all',
              !isMobile && 'cursor-grab active:cursor-grabbing touch-none',
              isDragging && 'opacity-50 scale-95 ring-4 ring-primary/50'
            )}
            style={{ borderColor: userColor }}
          >
            <div
              className="flex items-center gap-2 px-3 py-2 shrink-0"
              style={{ backgroundColor: userColor + '20' }}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 hidden md:block" />
              {user ? (
                <UserAvatar name={user.name} color={user.color} size="sm" className="h-7 w-7" />
              ) : (
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
              )}
              <h3 className="font-bold text-lg" style={{ color: userColor }}>
                {user?.name || 'Unassigned'}
              </h3>
              <Badge variant="outline" className="ml-auto">
                {chores.length}
              </Badge>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <Input
                placeholder="Add chore..."
                value={inlineChoreByUser[key] || ''}
                onChange={(e) => setInlineChoreByUser(prev => ({ ...prev, [key]: e.target.value }))}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = (inlineChoreByUser[key] || '').trim();
                    if (!val) return;
                    const success = await inlineAddChore(val, user?.id);
                    if (success) setInlineChoreByUser(prev => ({ ...prev, [key]: '' }));
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                draggable={false}
                className="h-8 text-sm mb-1"
              />
              {chores.map((chore) => {
                const nextDue = chore.nextDue ? new Date(chore.nextDue) : null;
                const isOverdue = nextDue && isPast(nextDue);
                const daysUntil = nextDue ? differenceInDays(nextDue, new Date()) : null;
                const isCompletedToday = chore.lastCompleted &&
                  new Date(chore.lastCompleted) > new Date(Date.now() - 24 * 60 * 60 * 1000);
                const isPendingApproval = !!chore.pendingApproval;

                return (
                  <div
                    key={chore.id}
                    className={cn(
                      'p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors group',
                      isPendingApproval ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-500/50' :
                      isCompletedToday ? 'opacity-60 bg-green-50/50 dark:bg-green-950/20 border-green-500/30' :
                      isOverdue ? 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20' : 'border-border'
                    )}
                    onClick={async () => {
                      const success = await completeChore(chore.id);
                      if (success && user) {
                        const otherChores = chores.filter((c: any) => c.id !== chore.id);
                        const allOthersCompleted = otherChores.every((c: any) =>
                          c.lastCompleted && new Date(c.lastCompleted) > new Date(Date.now() - 24 * 60 * 60 * 1000)
                        );
                        if (allOthersCompleted && !isCompletedToday) {
                          setCelebratingUser({ id: user.id, name: user.name });
                        }
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isPendingApproval && (
                            <Hourglass className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          )}
                          <p className={cn(
                            'font-medium text-sm truncate',
                            isCompletedToday && !isPendingApproval && 'line-through',
                            isPendingApproval && 'text-amber-700 dark:text-amber-400'
                          )}>{chore.title}</p>
                        </div>
                        {isPendingApproval && chore.pendingApproval && (
                          <div className="flex items-center gap-1 text-xs mt-0.5 text-amber-600 dark:text-amber-400">
                            <span>Awaiting approval</span>
                            <span className="text-muted-foreground">
                              &middot; {chore.pendingApproval.completedBy.name}
                            </span>
                          </div>
                        )}
                        {!isPendingApproval && nextDue && !isCompletedToday && (
                          <div className={cn(
                            'flex items-center gap-1 text-xs mt-0.5',
                            isOverdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                          )}>
                            <CalendarDays className="h-3 w-3" />
                            {isOverdue ? (
                              <span>Due {formatDistanceToNow(nextDue, { addSuffix: true })}</span>
                            ) : daysUntil === 0 ? (
                              <span>Due today</span>
                            ) : daysUntil === 1 ? (
                              <span>Due tomorrow</span>
                            ) : (
                              <span>Due {format(nextDue, 'MMM d')}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isPendingApproval && (
                          <Badge variant="default" className="text-[10px] bg-amber-500 hover:bg-amber-500 px-1.5 py-0">
                            Pending
                          </Badge>
                        )}
                        {chore.pointValue > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {chore.pointValue} pts
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            editChore(chore);
                          }}
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteChore(chore.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {chores.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">No chores</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ChoresView() {
  const isMobile = useIsMobile();
  const { requireAuth } = useAuth();
  const {
    loading, error, refreshChores, familyMembers,
    filterPerson, setFilterPerson,
    filterCategory, setFilterCategory,
    showDisabled, setShowDisabled,
    hideCompleted, setHideCompleted,
    showCompletions, setShowCompletions,
    completions, completionsLoading,
    sortBy, setSortBy,
    showAddModal, setShowAddModal,
    editingChore, setEditingChore,
    filteredChores,
    completeChore, toggleEnabled, deleteChore, editChore, undoCompletion,
    inlineAddChore,
    enabledCount, dueCount,
    confirmDialogProps,
  } = useChoresViewData();

  // Group by user toggle (default to true)
  const [groupByUser, setGroupByUser] = useState(true);

  // Celebration state
  const [celebratingUser, setCelebratingUser] = useState<{ id: string; name: string } | null>(null);

  // Inline add state
  const [inlineChore, setInlineChore] = useState('');
  const [inlineChoreByUser, setInlineChoreByUser] = useState<Record<string, string>>({});

  // Category multi-select state (adapter: hook uses string | null, dropdown uses Set<string>)
  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(new Set());

  // Sync multi-select back to hook's single-select (for filtering logic)
  // Since the hook expects string | null, we adapt: multi-select filtering done client-side
  const effectiveFilteredChores = useMemo(() => {
    if (categoryFilters.size === 0) return filteredChores;
    return filteredChores.filter((chore) => categoryFilters.has(chore.category));
  }, [filteredChores, categoryFilters]);

  // Check if any non-default filters active
  const hasActiveFilters = filterPerson !== null || categoryFilters.size > 0;

  const clearFilters = () => {
    setFilterPerson(null);
    setCategoryFilters(new Set());
    setFilterCategory(null);
  };

  // Group chores by assigned user
  const choresByUser = useMemo(() => {
    if (!groupByUser) return null;

    const groups: { user: { id: string; name: string; color: string } | null; chores: typeof effectiveFilteredChores }[] = [];

    familyMembers.forEach((member) => {
      const userChores = effectiveFilteredChores.filter((c) => c.assignedTo?.id === member.id);
      if (userChores.length > 0) {
        groups.push({ user: member, chores: userChores });
      }
    });

    const unassigned = effectiveFilteredChores.filter((c) => !c.assignedTo);
    if (unassigned.length > 0) {
      groups.push({ user: null, chores: unassigned });
    }

    return groups;
  }, [groupByUser, effectiveFilteredChores, familyMembers]);

  const handleAddWithAuth = async () => {
    const user = await requireAuth('Add Chore', 'Please log in to add a chore');
    if (!user) return;
    setShowAddModal(true);
  };

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        <SubpageHeader
          icon={<ClipboardList className="h-5 w-5 text-primary" />}
          title="Chores"
          badge={<>
            <Badge variant="secondary">{enabledCount} active</Badge>
            {dueCount > 0 && <Badge variant="destructive">{dueCount} due</Badge>}
          </>}
          actions={<>
            <Button
              variant={showCompletions ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowCompletions(!showCompletions)}
            >
              <History className="h-4 w-4 mr-1" />
              History
            </Button>
            <Button onClick={handleAddWithAuth} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Chore
            </Button>
          </>}
          overflow={[
            { label: 'Hide Completed', checked: hideCompleted, onClick: () => setHideCompleted(!hideCompleted) },
            { label: 'Show Disabled', checked: showDisabled, onClick: () => setShowDisabled(!showDisabled) },
          ] as OverflowItem[]}
        />

        <FilterBar>
          <PersonFilter
            members={familyMembers}
            selected={filterPerson}
            onSelect={setFilterPerson}
          />
          <div className="w-px h-5 bg-border shrink-0" />
          <FilterDropdown
            label="Category"
            options={CHORE_CATEGORIES}
            selected={categoryFilters}
            onSelectionChange={setCategoryFilters}
            mode="multi"
          />
          <Button
            variant={groupByUser ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setGroupByUser(!groupByUser)}
            className="gap-1 shrink-0 h-8"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Group by Person</span>
          </Button>
          <SortSelect
            value={sortBy}
            onValueChange={(v) => setSortBy(v as typeof sortBy)}
            options={[
              { value: 'nextDue', label: 'Next Due' },
              { value: 'category', label: 'Category' },
              { value: 'frequency', label: 'Frequency' },
            ]}
            showSortIcon
            className="ml-auto"
          />
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0 text-muted-foreground h-8">
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </FilterBar>

        <div className="flex-1 overflow-y-auto p-4">
          {showCompletions ? (
            <div className="max-w-4xl mx-auto space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Completions (Last 14 Days)
              </h2>
              {completionsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : completions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No completed chores in the last 14 days.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {completions.map((c) => (
                    <div
                      key={c.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border bg-card/85 backdrop-blur-sm',
                        c.approvedBy ? 'border-border' : 'border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/30'
                      )}
                    >
                      <span className="text-lg shrink-0">{getCategoryEmoji(c.choreCategory)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{c.choreTitle}</span>
                          {c.pointsAwarded > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              +{c.pointsAwarded} pts
                            </Badge>
                          )}
                          {c.approvedBy ? (
                            <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">
                              <ShieldCheck className="h-3 w-3 mr-0.5" />Approved
                            </Badge>
                          ) : (
                            <Badge variant="default" className="text-xs bg-amber-500 hover:bg-amber-500">
                              Pending Approval
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <UserAvatar
                              name={c.completedBy.name}
                              color={c.completedBy.color}
                              size="sm"
                              className="h-4 w-4 text-[8px]"
                            />
                            <span>{c.completedBy.name}</span>
                          </div>
                          {c.approvedBy && (
                            <div className="flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3 text-green-500" />
                              <span>{c.approvedBy.name}</span>
                            </div>
                          )}
                          <span title={format(parseISO(c.completedAt), 'PPpp')}>
                            {formatDistanceToNow(parseISO(c.completedAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => undoCompletion(c.id, c.choreId)}
                        title="Undo completion and reverse points"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Clock className="h-12 w-12 mb-4 opacity-50 animate-pulse" /><p>Loading chores...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-destructive">
              <AlertCircle className="h-12 w-12 mb-4 opacity-50" /><p>{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => refreshChores()}>Try Again</Button>
            </div>
          ) : effectiveFilteredChores.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ClipboardList className="h-12 w-12 mb-4 opacity-50" /><p>No chores found</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleAddWithAuth}>Add your first chore</Button>
            </div>
          ) : groupByUser && choresByUser ? (
            <ChoreGroupGrid
              choresByUser={choresByUser}
              inlineChoreByUser={inlineChoreByUser}
              setInlineChoreByUser={setInlineChoreByUser}
              inlineAddChore={inlineAddChore}
              completeChore={completeChore}
              editChore={editChore}
              deleteChore={deleteChore}
              setCelebratingUser={setCelebratingUser}
              isMobile={isMobile}
            />
          ) : (
            <div className="space-y-2 max-w-4xl mx-auto">
              <Input
                placeholder="Add chore..."
                value={inlineChore}
                onChange={(e) => setInlineChore(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!inlineChore.trim()) return;
                    const success = await inlineAddChore(inlineChore.trim());
                    if (success) setInlineChore('');
                  }
                }}
                className="h-9 mb-2"
              />
              {effectiveFilteredChores.map((chore) => (
                <ChoreItem key={chore.id} chore={chore}
                  onComplete={() => completeChore(chore.id)}
                  onToggleEnabled={() => toggleEnabled(chore.id)}
                  onEdit={() => editChore(chore)}
                  onDelete={() => deleteChore(chore.id)} />
              ))}
            </div>
          )}
        </div>

        {showAddModal && (
          <ChoreModal
            onClose={() => setShowAddModal(false)}
            onSave={async (chore) => {
              try {
                const response = await fetch('/api/chores', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: chore.title, description: chore.description, category: chore.category,
                    frequency: chore.frequency, startDay: chore.startDay || null, pointValue: chore.pointValue,
                    requiresApproval: chore.requiresApproval, assignedTo: chore.assignedTo?.id,
                  }),
                });
                if (!response.ok) {
                  const data = await response.json().catch(() => ({}));
                  throw new Error(data.error || 'Failed to create chore');
                }
                refreshChores();
                setShowAddModal(false);
              } catch (err) {
                console.error('Error creating chore:', err);
                toast({ title: err instanceof Error ? err.message : 'Failed to create chore', variant: 'destructive' });
              }
            }}
            familyMembers={familyMembers}
          />
        )}

        {editingChore && (
          <ChoreModal
            chore={editingChore}
            onClose={() => setEditingChore(null)}
            onDelete={async () => {
              setEditingChore(null);
              deleteChore(editingChore.id);
            }}
            onSave={async (updatedChore) => {
              try {
                const response = await fetch(`/api/chores/${editingChore.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: updatedChore.title, description: updatedChore.description, category: updatedChore.category,
                    frequency: updatedChore.frequency, startDay: updatedChore.startDay || null, pointValue: updatedChore.pointValue,
                    requiresApproval: updatedChore.requiresApproval, assignedTo: updatedChore.assignedTo?.id,
                    enabled: updatedChore.enabled,
                  }),
                });
                if (!response.ok) throw new Error('Failed to update chore');
                refreshChores();
                setEditingChore(null);
              } catch (err) {
                console.error('Error updating chore:', err);
                toast({ title: 'Failed to update chore', variant: 'destructive' });
              }
            }}
            familyMembers={familyMembers}
          />
        )}

        <PlaneCelebration
          show={!!celebratingUser}
          userName={celebratingUser?.name || ''}
          onComplete={() => setCelebratingUser(null)}
        />
        <ConfirmDialog {...confirmDialogProps} />
      </div>
    </PageWrapper>
  );
}
