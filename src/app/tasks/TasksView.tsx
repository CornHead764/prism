'use client';

import { useState, useMemo, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { format, isPast, differenceInDays, formatDistanceToNow } from 'date-fns';
import {
  CheckSquare,
  Plus,
  AlertCircle,
  Clock,
  RefreshCw,
  Users,
  CalendarDays,
  Settings,
  List,
  GripVertical,
  X,
} from 'lucide-react';
import { PlaneCelebration } from '@/components/ui/PlaneCelebration';
import { UserAvatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageWrapper, SubpageHeader, FilterBar, SortSelect, FilterDropdown, PersonFilter, UndoButton } from '@/components/layout';
import type { OverflowItem } from '@/components/layout';
import { TaskModal } from '@/app/tasks/TaskModal';
import { useTasksViewData } from './useTasksViewData';
import { useAuth } from '@/components/providers';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useDragReorder } from '@/lib/hooks/useDragReorder';
import type { Task } from '@/types';

// ---------- Shared task row used by all modes ----------

function TaskRow({
  task,
  onToggle,
  onEdit,
  showAvatar = false,
  showList = false,
  taskLists = [],
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  showAvatar?: boolean;
  showList?: boolean;
  taskLists?: Array<{ id: string; name: string; color?: string | null }>;
}) {
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && !task.completed && isPast(dueDate);
  const daysUntil = dueDate ? differenceInDays(dueDate, new Date()) : null;
  const taskList = showList ? taskLists.find(l => l.id === (task as typeof task & { listId?: string }).listId) : null;

  return (
    <div
      className={cn(
        'p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors',
        task.completed ? 'opacity-60 bg-green-50/50 dark:bg-green-950/20 border-green-500/30' : '',
        isOverdue ? 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20' : !task.completed ? 'border-border' : ''
      )}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {showAvatar && task.assignedTo && (
            <UserAvatar name={task.assignedTo.name} color={task.assignedTo.color} size="sm" className="h-5 w-5 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className={cn(
              'font-medium text-sm truncate',
              task.completed && 'line-through text-muted-foreground'
            )}>
              {task.title}
            </p>
            {(dueDate || taskList) && !task.completed && (
              <div className="flex items-center gap-2 mt-0.5">
                {dueDate && (
                  <div className={cn(
                    'flex items-center gap-1 text-xs',
                    isOverdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                  )}>
                    <CalendarDays className="h-3 w-3" />
                    {isOverdue ? (
                      <span>Due {formatDistanceToNow(dueDate, { addSuffix: true })}</span>
                    ) : daysUntil === 0 ? (
                      <span>Due today</span>
                    ) : daysUntil === 1 ? (
                      <span>Due tomorrow</span>
                    ) : (
                      <span>Due {format(dueDate, 'MMM d')}</span>
                    )}
                  </div>
                )}
                {taskList && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: taskList.color || '#6B7280' }} />
                    <span>{taskList.name}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {task.priority === 'high' && (
            <Badge variant="destructive" className="text-xs">!</Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Grouped task grid (shared by Person & List modes) ----------

interface GroupDef {
  key: string;
  label: string;
  color: string;
  avatar: React.ReactNode;
  tasks: Task[];
  inlineValue: string;
  onInlineChange: (v: string) => void;
  onInlineSubmit: () => void;
  celebrationTarget?: { id: string; name: string };
}

function GroupedTaskGrid({
  groups,
  toggleTask,
  editTask,
  setCelebratingUser,
  taskLists,
  isMobile = false,
}: {
  groups: GroupDef[];
  toggleTask: (id: string) => Promise<boolean>;
  editTask: (task: Task) => void;
  setCelebratingUser: (user: { id: string; name: string } | null) => void;
  taskLists: Array<{ id: string; name: string; color?: string | null }>;
  isMobile?: boolean;
}) {
  const groupKeys = useMemo(() => groups.map(g => g.key), [groups]);
  const [groupOrder, setGroupOrder] = useState<string[]>([]);

  // Merge new groups into order (preserving existing order, appending new ones)
  const effectiveOrder = useMemo(() => {
    const known = groupOrder.filter(k => groupKeys.includes(k));
    const newKeys = groupKeys.filter(k => !known.includes(k));
    return [...known, ...newKeys];
  }, [groupOrder, groupKeys]);

  const saveOrder = useCallback((order: string[]) => {
    setGroupOrder(order);
    try { localStorage.setItem('prism:task-group-order', JSON.stringify(order)); } catch {}
  }, []);

  // Load saved order on mount
  useState(() => {
    try {
      const saved = localStorage.getItem('prism:task-group-order');
      if (saved) setGroupOrder(JSON.parse(saved));
    } catch {}
  });

  const { draggedId, getDragProps } = useDragReorder({ order: effectiveOrder, onReorder: saveOrder });

  const sortedGroups = useMemo(() => {
    const map = new Map(groups.map(g => [g.key, g]));
    return effectiveOrder.map(k => map.get(k)).filter(Boolean) as GroupDef[];
  }, [groups, effectiveOrder]);

  return (
    <div className={cn(
      'grid gap-2 h-full',
      isMobile ? 'grid-cols-1' :
      sortedGroups.length <= 2 ? 'grid-cols-1 md:grid-cols-2' :
      sortedGroups.length <= 4 ? 'grid-cols-2' :
      'grid-cols-2 md:grid-cols-3'
    )}>
      {sortedGroups.map((group) => {
        const completedCount = group.tasks.filter((t) => t.completed).length;
        const isDragging = draggedId === group.key;
        return (
          <div
            key={group.key}
            {...(isMobile ? {} : getDragProps(group.key))}
            className={cn(
              'flex flex-col border-2 rounded-lg overflow-hidden bg-card/90 backdrop-blur-sm transition-all',
              !isMobile && 'cursor-grab active:cursor-grabbing touch-none',
              isDragging && 'opacity-50 scale-95 ring-4 ring-primary/50'
            )}
            style={{ borderColor: group.color }}
          >
            <div
              className="flex items-center gap-2 px-3 py-2 shrink-0"
              style={{ backgroundColor: group.color + '20' }}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 hidden md:block" />
              {group.avatar}
              <h3 className="font-bold text-lg" style={{ color: group.color }}>
                {group.label}
              </h3>
              <Badge variant="outline" className="ml-auto">
                {completedCount}/{group.tasks.length}
              </Badge>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <div className="pb-1">
                <Input
                  placeholder="Add a task..."
                  value={group.inlineValue}
                  onChange={(e) => group.onInlineChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      group.onInlineSubmit();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="h-8 text-sm"
                  draggable={false}
                />
              </div>
              {group.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={async () => {
                    const success = await toggleTask(task.id);
                    if (success && group.celebrationTarget && !task.completed) {
                      const otherTasks = group.tasks.filter((t) => t.id !== task.id);
                      const allOthersCompleted = otherTasks.every((t) => t.completed);
                      if (allOthersCompleted) {
                        setCelebratingUser(group.celebrationTarget);
                      }
                    }
                  }}
                  onEdit={() => editTask(task)}
                  showList={true}
                  taskLists={taskLists}
                />
              ))}
              {group.tasks.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">No tasks</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Main TasksView ----------

export function TasksView() {
  const { requireAuth } = useAuth();
  const {
    loading, error, refreshTasks, familyMembers,
    filterPerson, setFilterPerson,
    filterPriority, setFilterPriority,
    showCompleted, setShowCompleted,
    filterList, setFilterList,
    sortBy, setSortBy,
    showAddModal, setShowAddModal,
    editingTask, setEditingTask,
    filteredTasks,
    toggleTask, editTask, deleteTask, handleAddClick,
    completedCount, totalCount,
    taskLists,
    autoSyncing,
    confirmDialogProps,
  } = useTasksViewData();

  const isMobile = useIsMobile();

  // Group mode: 'none' | 'person' | 'list'
  const [groupMode, setGroupMode] = useState<'none' | 'person' | 'list'>('person');

  // Inline task add state
  const [inlineTask, setInlineTask] = useState('');
  const [inlineTaskByUser, setInlineTaskByUser] = useState<Record<string, string>>({});
  const [inlineTaskByList, setInlineTaskByList] = useState<Record<string, string>>({});

  // Celebration state
  const [celebratingUser, setCelebratingUser] = useState<{ id: string; name: string } | null>(null);

  // Check if any non-default filters are active
  const hasActiveFilters = filterPerson !== null || filterPriority !== null || filterList !== null;

  const clearFilters = () => {
    setFilterPerson(null);
    setFilterPriority(null);
    setFilterList(null);
  };

  // Group tasks by assigned user
  const tasksByUser = useMemo(() => {
    if (groupMode !== 'person') return null;

    const groups: { user: { id: string; name: string; color: string } | null; tasks: typeof filteredTasks }[] = [];

    familyMembers.forEach((member) => {
      const userTasks = filteredTasks.filter((t) => t.assignedTo?.id === member.id);
      if (userTasks.length > 0) {
        groups.push({ user: member, tasks: userTasks });
      }
    });

    const unassigned = filteredTasks.filter((t) => !t.assignedTo);
    if (unassigned.length > 0) {
      groups.push({ user: null, tasks: unassigned });
    }

    return groups;
  }, [groupMode, filteredTasks, familyMembers]);

  // Group tasks by list
  const tasksByList = useMemo(() => {
    if (groupMode !== 'list') return null;

    const groups: { list: { id: string; name: string; color: string } | null; tasks: typeof filteredTasks }[] = [];

    taskLists.forEach((list) => {
      const listTasks = filteredTasks.filter((t) => (t as typeof t & { listId?: string }).listId === list.id);
      if (listTasks.length > 0) {
        groups.push({ list: { id: list.id, name: list.name, color: list.color || '#6B7280' }, tasks: listTasks });
      }
    });

    const noList = filteredTasks.filter((t) => !(t as typeof t & { listId?: string }).listId);
    if (noList.length > 0) {
      groups.push({ list: null, tasks: noList });
    }

    return groups;
  }, [groupMode, filteredTasks, taskLists]);

  const handleInlineAdd = async (assignedTo?: string, listId?: string) => {
    let value: string | undefined;
    if (assignedTo) {
      value = inlineTaskByUser[assignedTo]?.trim();
    } else if (listId) {
      value = inlineTaskByList[listId]?.trim();
    } else {
      value = inlineTask.trim();
    }
    if (!value) return;

    const user = await requireAuth('Add Task', 'Please log in to add a task');
    if (!user) return;

    try {
      const body: Record<string, string> = { title: value };
      if (assignedTo) body.assignedTo = assignedTo;
      const effectiveListId = listId || (filterList && filterList !== 'none' ? filterList : undefined);
      if (effectiveListId) body.listId = effectiveListId;
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Failed to create task');
      refreshTasks();
      if (assignedTo) {
        setInlineTaskByUser(prev => ({ ...prev, [assignedTo]: '' }));
      } else if (listId) {
        setInlineTaskByList(prev => ({ ...prev, [listId]: '' }));
      } else {
        setInlineTask('');
      }
    } catch (err) {
      console.error('Error creating task:', err);
      toast({ title: 'Failed to create task', variant: 'destructive' });
    }
  };

  const handleAddWithAuth = async () => {
    const user = await requireAuth('Add Task', 'Please log in to add a task');
    if (!user) return;
    handleAddClick();
  };

  // Build overflow items
  const overflowItems: OverflowItem[] = [
    { label: 'Show Completed', checked: showCompleted, onClick: () => setShowCompleted(!showCompleted) },
  ];

  // Build list filter options for dropdown
  const listOptions = useMemo(() => {
    const opts = [{ value: 'none', label: 'No List' }];
    taskLists.forEach((list) => {
      opts.push({
        value: list.id,
        label: list.name,
      });
    });
    return opts;
  }, [taskLists]);

  // Build group mode options for dropdown
  const groupOptions = useMemo(() => {
    const opts = [
      { value: 'none', label: 'None' },
      { value: 'person', label: 'Person' },
    ];
    if (taskLists.length > 0) {
      opts.push({ value: 'list', label: 'List' });
    }
    return opts;
  }, [taskLists]);

  return (
    <PageWrapper>
      <div className="h-full flex flex-col">
        <SubpageHeader
          icon={<CheckSquare className="h-5 w-5 text-primary" />}
          title="Tasks"
          badge={<>
            <Badge variant="secondary">{completedCount}/{totalCount}</Badge>
            {autoSyncing && (
              <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
            )}
          </>}
          actions={<>
            <UndoButton />
            <Button onClick={handleAddWithAuth} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Task
            </Button>
          </>}
          overflow={overflowItems}
        />

        <FilterBar>
          <PersonFilter
            members={familyMembers}
            selected={filterPerson}
            onSelect={setFilterPerson}
          />
          {!isMobile && (
            <>
              <div className="w-px h-5 bg-border shrink-0" />
              {/* Priority: inline 3-button group (too few options for a dropdown) */}
              <div className="flex gap-1 shrink-0">
                <Button variant={filterPriority === null ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterPriority(null)} className="h-8">All</Button>
                {(['high', 'medium', 'low'] as const).map((priority) => (
                  <Button key={priority} variant={filterPriority === priority ? 'secondary' : 'ghost'} size="sm"
                    onClick={() => setFilterPriority(priority)} className="capitalize h-8">{priority}</Button>
                ))}
              </div>
              {taskLists.length > 0 && (
                <>
                  <div className="w-px h-5 bg-border shrink-0" />
                  <FilterDropdown
                    label="List"
                    options={listOptions}
                    selected={filterList ? new Set([filterList]) : new Set()}
                    onSelectionChange={(s) => setFilterList(s.size > 0 ? [...s][0]! : null)}
                    mode="single"
                    icon={<List className="h-3.5 w-3.5" />}
                  />
                </>
              )}
            </>
          )}
          <div className="w-px h-5 bg-border shrink-0" />
          <FilterDropdown
            label="Group"
            options={groupOptions}
            selected={new Set([groupMode])}
            onSelectionChange={(s) => {
              const val = s.size > 0 ? [...s][0] : 'none';
              setGroupMode(val as 'none' | 'person' | 'list');
            }}
            mode="single"
            icon={<Users className="h-3.5 w-3.5" />}
          />
          <SortSelect
            value={sortBy}
            onValueChange={(v) => setSortBy(v as typeof sortBy)}
            options={[
              { value: 'dueDate', label: 'Due Date' },
              { value: 'priority', label: 'Priority' },
              { value: 'title', label: 'Title' },
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
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Clock className="h-12 w-12 mb-4 opacity-50 animate-pulse" /><p>Loading tasks...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-destructive">
              <AlertCircle className="h-12 w-12 mb-4 opacity-50" /><p>{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => refreshTasks()}>Try Again</Button>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <CheckSquare className="h-12 w-12 mb-4 opacity-50" /><p>No tasks found</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleAddWithAuth}>Add your first task</Button>
            </div>
          ) : groupMode === 'person' && tasksByUser ? (
            <GroupedTaskGrid
              groups={tasksByUser.map(({ user, tasks }) => ({
                key: user?.id || 'unassigned',
                label: user?.name || 'Unassigned',
                color: user?.color || '#6B7280',
                avatar: user ? <UserAvatar name={user.name} color={user.color} size="sm" className="h-7 w-7" /> : <CheckSquare className="h-5 w-5 text-muted-foreground" />,
                tasks,
                inlineValue: user ? (inlineTaskByUser[user.id] || '') : inlineTask,
                onInlineChange: (v) => user ? setInlineTaskByUser(prev => ({ ...prev, [user.id]: v })) : setInlineTask(v),
                onInlineSubmit: () => handleInlineAdd(user?.id),
                celebrationTarget: user ? { id: user.id, name: user.name } : undefined,
              }))}
              toggleTask={toggleTask}
              editTask={editTask}
              setCelebratingUser={setCelebratingUser}
              taskLists={taskLists}
              isMobile={isMobile}
            />
          ) : groupMode === 'list' && tasksByList ? (
            <GroupedTaskGrid
              groups={tasksByList.map(({ list, tasks }) => ({
                key: list?.id || 'no-list',
                label: list?.name || 'No List',
                color: list?.color || '#6B7280',
                avatar: <List className="h-5 w-5" style={{ color: list?.color || '#6B7280' }} />,
                tasks,
                inlineValue: list ? (inlineTaskByList[list.id] || '') : inlineTask,
                onInlineChange: (v) => list ? setInlineTaskByList(prev => ({ ...prev, [list.id]: v })) : setInlineTask(v),
                onInlineSubmit: () => handleInlineAdd(undefined, list?.id),
              }))}
              toggleTask={toggleTask}
              editTask={editTask}
              setCelebratingUser={setCelebratingUser}
              taskLists={taskLists}
              isMobile={isMobile}
            />
          ) : (
            <div className="space-y-1 max-w-4xl mx-auto">
              <Input
                placeholder="Add a task..."
                value={inlineTask}
                onChange={(e) => setInlineTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleInlineAdd();
                  }
                }}
                className="h-9 mb-2"
              />
              {filteredTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={() => toggleTask(task.id)}
                  onEdit={() => editTask(task)}
                  showAvatar={true}
                  showList={true}
                  taskLists={taskLists}
                />
              ))}
            </div>
          )}
        </div>

        {showAddModal && (
          <TaskModal
            onClose={() => setShowAddModal(false)}
            onSave={async (task) => {
              try {
                const response = await fetch('/api/tasks', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: task.title, description: task.description, priority: task.priority,
                    category: task.category, assignedTo: task.assignedTo?.id, dueDate: task.dueDate?.toISOString(),
                    listId: task.listId,
                  }),
                });
                if (!response.ok) throw new Error('Failed to create task');
                refreshTasks();
                setShowAddModal(false);
              } catch (err) {
                console.error('Error creating task:', err);
                toast({ title: 'Failed to create task', variant: 'destructive' });
              }
            }}
            familyMembers={familyMembers}
            taskLists={taskLists}
            defaultListId={filterList === 'none' ? null : filterList}
          />
        )}

        {editingTask && (
          <TaskModal
            task={editingTask}
            onClose={() => setEditingTask(null)}
            onSave={async (updatedTask) => {
              try {
                const response = await fetch(`/api/tasks/${editingTask.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: updatedTask.title, description: updatedTask.description, priority: updatedTask.priority,
                    category: updatedTask.category, assignedTo: updatedTask.assignedTo?.id,
                    dueDate: updatedTask.dueDate?.toISOString(), completed: updatedTask.completed,
                    listId: updatedTask.listId,
                  }),
                });
                if (!response.ok) throw new Error('Failed to update task');
                refreshTasks();
                setEditingTask(null);
              } catch (err) {
                console.error('Error updating task:', err);
                toast({ title: 'Failed to update task', variant: 'destructive' });
              }
            }}
            familyMembers={familyMembers}
            taskLists={taskLists}
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
