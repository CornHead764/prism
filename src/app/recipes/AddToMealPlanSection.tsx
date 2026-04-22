'use client';

import { useState } from 'react';
import { addDays, format, isSameDay, startOfWeek } from 'date-fns';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/components/providers';
import type { Recipe } from '@/lib/hooks/useRecipes';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack',
};

interface DayChip {
  label: string;
  shortLabel: string; // used in toast
  date: Date;
  weekOf: string;
  dayOfWeek: string;
}

function getDayChips(today: Date): DayChip[] {
  const tomorrow = addDays(today, 1);

  const makeChip = (d: Date, label?: string): DayChip => ({
    label: label ?? format(d, 'EEE d'),
    shortLabel: label ? label.toLowerCase() : format(d, 'EEEE'),
    date: d,
    weekOf: format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    dayOfWeek: format(d, 'EEEE').toLowerCase(),
  });

  const chips: DayChip[] = [makeChip(today, 'Today'), makeChip(tomorrow, 'Tomorrow')];

  // Fill in remaining days of the current week (Mon–Sun), skip today and tomorrow
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    if (!isSameDay(d, today) && !isSameDay(d, tomorrow)) chips.push(makeChip(d));
  }

  return chips;
}

export function AddToMealPlanSection({ recipe }: { recipe: Recipe }) {
  const { requireAuth } = useAuth();
  const chips = getDayChips(new Date());

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType>('dinner');
  const [saving, setSaving] = useState(false);

  const selectedChip = chips.find((c) => `${c.weekOf}:${c.dayOfWeek}` === selectedKey) ?? null;

  const handleAdd = async () => {
    if (!selectedChip) return;
    if (!await requireAuth('Add to Meal Plan', 'Please log in to add meals')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: recipe.name,
          recipeId: recipe.id,
          weekOf: selectedChip.weekOf,
          dayOfWeek: selectedChip.dayOfWeek,
          mealType,
        }),
      });
      if (!res.ok) throw new Error();
      toast({
        title: `Added to ${selectedChip.shortLabel}'s ${MEAL_LABELS[mealType].toLowerCase()}`,
        variant: 'success',
      });
      setSelectedKey(null);
    } catch {
      toast({ title: 'Failed to add to meal plan', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarPlus className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Add to Meal Plan</span>
      </div>

      {/* Day chips */}
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => {
          const key = `${chip.weekOf}:${chip.dayOfWeek}`;
          const selected = key === selectedKey;
          return (
            <button
              key={key}
              onClick={() => setSelectedKey(selected ? null : key)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                selected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/60 hover:text-foreground'
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Meal type toggle + confirm */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center border rounded-md overflow-hidden text-xs shrink-0">
          {MEAL_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setMealType(type)}
              className={cn(
                'px-2.5 py-1.5 transition-colors',
                mealType === type
                  ? 'bg-secondary text-secondary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              {MEAL_LABELS[type]}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          className="ml-auto"
          disabled={!selectedKey || saving}
          onClick={handleAdd}
        >
          {saving ? 'Adding…' : 'Add to Plan'}
        </Button>
      </div>
    </div>
  );
}
