'use client';

import React, { memo, useMemo, useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { cn } from '@/lib/utils';
import { useDashboardData } from './useDashboardData';
import { useMobileCardOrder, loadHiddenCards } from './useMobileCardOrder';
import { useBusTracking } from '@/lib/hooks/useBusTracking';
import {
  WeatherCard,
  ClockCard,
  CalendarCard,
  ChoresCard,
  TasksCard,
  ShoppingCard,
  MealsCard,
  MessagesCard,
  BirthdaysCard,
  PointsCard,
  WishesCard,
  PhotosCard,
  RecipesCard,
  BusTrackingCard,
} from './MobileCards';

function SortableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative transition-shadow',
        isDragging && 'scale-[1.03] shadow-xl z-10 opacity-90 rounded-xl'
      )}
    >
      {/* Drag handle — wide touch target at top of card */}
      <div
        {...attributes}
        {...listeners}
        onContextMenu={(e) => e.preventDefault()}
        className="absolute top-0 left-1/2 -translate-x-1/2 z-10 w-2/3 py-3 flex justify-center cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
      >
        <div className="w-10 h-1 rounded-full bg-muted-foreground/40" />
      </div>
      {children}
    </div>
  );
}

export const MobileDashboard = memo(function MobileDashboard() {
  const data = useDashboardData();
  const { order, setOrder } = useMobileCardOrder();
  const { routes: busRoutes } = useBusTracking();
  const [hiddenCards] = useState(loadHiddenCards);
  const [reorderMode, setReorderMode] = useState(false);

  // Listen for reorder mode toggle from FAB
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setReorderMode(detail?.active ?? false);
    };
    window.addEventListener('prism:mobile-reorder', handler);
    return () => window.removeEventListener('prism:mobile-reorder', handler);
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = order.indexOf(active.id as string);
      const newIndex = order.indexOf(over.id as string);
      setOrder(arrayMove(order, oldIndex, newIndex));
    }
  }, [order, setOrder]);

  const cardMap: Record<string, React.ReactNode> = useMemo(() => ({
    weather: <WeatherCard data={data.weather} />,
    clock: <ClockCard />,
    calendar: <CalendarCard data={data.calendar} />,
    chores: <ChoresCard data={data.chores} />,
    tasks: <TasksCard data={data.tasks} />,
    shopping: <ShoppingCard data={data.shopping} />,
    meals: <MealsCard data={data.meals} />,
    messages: <MessagesCard data={data.messages} />,
    birthdays: <BirthdaysCard data={data.birthdays} />,
    points: <PointsCard data={data.points} />,
    wishes: <WishesCard />,
    photos: <PhotosCard />,
    recipes: <RecipesCard />,
    busTracking: <BusTrackingCard routes={busRoutes} />,
  }), [data, busRoutes]);

  const cardHasContent: Record<string, boolean> = useMemo(() => ({
    weather: !data.weather.loading && !!data.weather.data,
    clock: true,
    calendar: true,
    chores: true,
    tasks: true,
    shopping: true,
    meals: true,
    messages: true,
    birthdays: (data.birthdays.birthdays?.length ?? 0) > 0,
    points: !data.points.loading && (data.points.goals?.length ?? 0) > 0,
    wishes: true,
    photos: true,
    recipes: true,
    busTracking: (busRoutes?.length ?? 0) > 0,
  }), [data, busRoutes]);

  const visibleOrder = useMemo(
    () => order.filter((id) => !hiddenCards.includes(id) && cardHasContent[id] !== false),
    [order, hiddenCards, cardHasContent],
  );

  if (reorderMode) {
    return (
      <div className="p-4 pb-24 space-y-3 max-w-lg mx-auto">
        <div className="text-center text-sm text-muted-foreground py-2">
          Drag cards to reorder
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext items={visibleOrder} strategy={verticalListSortingStrategy}>
            {visibleOrder.map((id) => (
              <SortableCard key={id} id={id}>
                {cardMap[id]}
              </SortableCard>
            ))}
          </SortableContext>
        </DndContext>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-3 max-w-lg mx-auto">
      {visibleOrder.map((id) => (
        <div key={id}>{cardMap[id]}</div>
      ))}
    </div>
  );
});
