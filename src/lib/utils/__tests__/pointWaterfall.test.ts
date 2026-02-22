import { computeWaterfall, getGoalPeriodKey } from '../pointWaterfall';

// Helper to create dates relative to a fixed "now"
// Use midday UTC so local-time conversion (date-fns uses local) stays on the same calendar day
const NOW = new Date('2026-02-16T18:00:00Z'); // a Monday
const THIS_WEEK_MON = new Date('2026-02-16T15:00:00Z');
const LAST_WEEK_MON = new Date('2026-02-09T15:00:00Z');

function makeGoal(overrides: Partial<{
  id: string;
  pointCost: number;
  priority: number;
  recurring: boolean;
  recurrencePeriod: 'weekly' | 'monthly' | 'yearly' | null;
  lastResetAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? 'goal-1',
    pointCost: overrides.pointCost ?? 10,
    priority: overrides.priority ?? 1,
    recurring: overrides.recurring ?? false,
    recurrencePeriod: overrides.recurrencePeriod ?? null,
    lastResetAt: overrides.lastResetAt ?? new Date('2026-01-01'),
  };
}

function makeCompletion(points: number, date: Date) {
  return { pointsAwarded: points, completedAt: date };
}

describe('computeWaterfall', () => {
  describe('earned counters', () => {
    it('counts weekly/monthly/yearly earned points from completions', () => {
      const completions = [
        makeCompletion(5, new Date('2026-02-16T10:00:00Z')),  // this week + month + year
        makeCompletion(3, new Date('2026-02-10T10:00:00Z')),  // last week but this month + year
        makeCompletion(7, new Date('2026-01-15T10:00:00Z')),  // last month but this year
      ];

      const result = computeWaterfall([makeGoal()], completions, NOW);

      expect(result.weeklyEarned).toBe(5);
      expect(result.monthlyEarned).toBe(8);   // 5 + 3
      expect(result.yearlyEarned).toBe(15);   // 5 + 3 + 7
    });

    it('treats null pointsAwarded as 0', () => {
      const completions = [
        { pointsAwarded: null, completedAt: new Date('2026-02-16T10:00:00Z') },
        makeCompletion(5, new Date('2026-02-16T11:00:00Z')),
      ];

      const result = computeWaterfall([makeGoal()], completions, NOW);
      expect(result.weeklyEarned).toBe(5);
    });

    it('returns zeros when no completions exist', () => {
      const result = computeWaterfall([makeGoal()], [], NOW);
      expect(result.weeklyEarned).toBe(0);
      expect(result.monthlyEarned).toBe(0);
      expect(result.yearlyEarned).toBe(0);
    });
  });

  describe('non-recurring goals', () => {
    it('accumulates points across weeks toward a non-recurring goal', () => {
      const goal = makeGoal({ pointCost: 20, priority: 1, recurring: false });
      const completions = [
        makeCompletion(8, LAST_WEEK_MON),      // week 1: 8 pts
        makeCompletion(7, THIS_WEEK_MON),       // week 2: 7 pts → total 15
      ];

      const result = computeWaterfall([goal], completions, NOW);
      expect(result.goals[0].allocated).toBe(15);
      expect(result.goals[0].achieved).toBe(false);
    });

    it('marks goal as achieved when accumulated points >= cost', () => {
      const goal = makeGoal({ pointCost: 10, priority: 1, recurring: false });
      const completions = [
        makeCompletion(6, LAST_WEEK_MON),
        makeCompletion(5, THIS_WEEK_MON),
      ];

      const result = computeWaterfall([goal], completions, NOW);
      expect(result.goals[0].allocated).toBe(10);
      expect(result.goals[0].achieved).toBe(true);
    });

    it('caps allocation at pointCost (no over-allocation)', () => {
      const goal = makeGoal({ pointCost: 5, priority: 1, recurring: false });
      const completions = [makeCompletion(20, THIS_WEEK_MON)];

      const result = computeWaterfall([goal], completions, NOW);
      expect(result.goals[0].allocated).toBe(5);
    });
  });

  describe('recurring goals', () => {
    it('only uses current week points for recurring weekly goal progress', () => {
      const goal = makeGoal({ pointCost: 10, priority: 1, recurring: true, recurrencePeriod: 'weekly' });
      const completions = [
        makeCompletion(100, LAST_WEEK_MON),  // old week, doesn't count for progress display
        makeCompletion(7, THIS_WEEK_MON),
      ];

      const result = computeWaterfall([goal], completions, NOW);
      expect(result.goals[0].allocated).toBe(7);
      expect(result.goals[0].achieved).toBe(false);
    });

    it('marks recurring goal achieved when current week points >= cost', () => {
      const goal = makeGoal({ pointCost: 5, priority: 1, recurring: true, recurrencePeriod: 'weekly' });
      const completions = [makeCompletion(5, THIS_WEEK_MON)];

      const result = computeWaterfall([goal], completions, NOW);
      expect(result.goals[0].achieved).toBe(true);
    });
  });

  describe('priority ordering', () => {
    it('fills higher-priority goals first (lower priority number)', () => {
      const goals = [
        makeGoal({ id: 'low', pointCost: 10, priority: 2, recurring: false }),
        makeGoal({ id: 'high', pointCost: 10, priority: 1, recurring: false }),
      ];
      const completions = [makeCompletion(12, THIS_WEEK_MON)];

      const result = computeWaterfall(goals, completions, NOW);
      const high = result.goals.find(g => g.goalId === 'high')!;
      const low = result.goals.find(g => g.goalId === 'low')!;

      expect(high.allocated).toBe(10);
      expect(high.achieved).toBe(true);
      expect(low.allocated).toBe(2);
      expect(low.achieved).toBe(false);
    });

    it('overflow from filled goals spills to next priority', () => {
      const goals = [
        makeGoal({ id: 'first', pointCost: 3, priority: 1, recurring: false }),
        makeGoal({ id: 'second', pointCost: 5, priority: 2, recurring: false }),
      ];
      const completions = [makeCompletion(7, THIS_WEEK_MON)];

      const result = computeWaterfall(goals, completions, NOW);
      expect(result.goals.find(g => g.goalId === 'first')!.allocated).toBe(3);
      expect(result.goals.find(g => g.goalId === 'second')!.allocated).toBe(4);
    });
  });

  describe('priority ties and ordering', () => {
    it('processes goals with same priority in stable input order', () => {
      const goals = [
        makeGoal({ id: 'a', pointCost: 5, priority: 1, recurring: false }),
        makeGoal({ id: 'b', pointCost: 5, priority: 1, recurring: false }),
        makeGoal({ id: 'c', pointCost: 5, priority: 1, recurring: false }),
      ];
      // Only 7 points — should fill in order: a gets 5, b gets 2, c gets 0
      const completions = [makeCompletion(7, THIS_WEEK_MON)];

      const result = computeWaterfall(goals, completions, NOW);
      const a = result.goals.find(g => g.goalId === 'a')!;
      const b = result.goals.find(g => g.goalId === 'b')!;
      const c = result.goals.find(g => g.goalId === 'c')!;

      expect(a.allocated).toBe(5);
      expect(a.achieved).toBe(true);
      expect(b.allocated).toBe(2);
      expect(b.achieved).toBe(false);
      expect(c.allocated).toBe(0);
      expect(c.achieved).toBe(false);
    });
  });

  describe('recurring before non-recurring waterfall', () => {
    it('recurring goals consume points first, overflow goes to non-recurring', () => {
      const goals = [
        makeGoal({ id: 'recurring', pointCost: 6, priority: 1, recurring: true, recurrencePeriod: 'weekly' }),
        makeGoal({ id: 'savings', pointCost: 20, priority: 2, recurring: false }),
      ];
      // 10 points this week: recurring takes 6, 4 overflows to savings
      const completions = [makeCompletion(10, THIS_WEEK_MON)];

      const result = computeWaterfall(goals, completions, NOW);
      const recurring = result.goals.find(g => g.goalId === 'recurring')!;
      const savings = result.goals.find(g => g.goalId === 'savings')!;

      expect(recurring.allocated).toBe(6);
      expect(recurring.achieved).toBe(true);
      expect(savings.allocated).toBe(4);
      expect(savings.achieved).toBe(false);
    });

    it('non-recurring goals accumulate overflow across multiple weeks', () => {
      const goals = [
        makeGoal({ id: 'weekly-chore', pointCost: 5, priority: 1, recurring: true, recurrencePeriod: 'weekly' }),
        makeGoal({ id: 'bike', pointCost: 10, priority: 2, recurring: false }),
      ];
      // Week 1: 8 pts (5 to recurring, 3 overflow to bike)
      // Week 2: 8 pts (5 to recurring, 3 overflow to bike → bike total = 6)
      const completions = [
        makeCompletion(8, LAST_WEEK_MON),
        makeCompletion(8, THIS_WEEK_MON),
      ];

      const result = computeWaterfall(goals, completions, NOW);
      const bike = result.goals.find(g => g.goalId === 'bike')!;

      expect(bike.allocated).toBe(6); // 3 + 3
      expect(bike.achieved).toBe(false);
    });
  });

  describe('zero and edge point values', () => {
    it('skips completions with 0 points in week buckets', () => {
      const goal = makeGoal({ pointCost: 10, recurring: false });
      const completions = [
        makeCompletion(0, THIS_WEEK_MON),
        makeCompletion(5, THIS_WEEK_MON),
      ];

      const result = computeWaterfall([goal], completions, NOW);
      expect(result.goals[0].allocated).toBe(5);
      // weeklyEarned still counts 0-point completions (they add 0)
      expect(result.weeklyEarned).toBe(5);
    });

    it('skips completions with negative points in week buckets', () => {
      const goal = makeGoal({ pointCost: 10, recurring: false });
      const completions = [
        makeCompletion(-3, THIS_WEEK_MON),
        makeCompletion(5, THIS_WEEK_MON),
      ];

      const result = computeWaterfall([goal], completions, NOW);
      // weekBuckets skips pts <= 0, so only 5 goes into waterfall
      expect(result.goals[0].allocated).toBe(5);
      // But weeklyEarned counter includes negative points
      expect(result.weeklyEarned).toBe(2); // 5 + (-3)
    });

    it('handles goal with pointCost of 0 (always achieved)', () => {
      const goal = makeGoal({ pointCost: 0, recurring: false });
      const completions = [makeCompletion(5, THIS_WEEK_MON)];

      const result = computeWaterfall([goal], completions, NOW);
      expect(result.goals[0].achieved).toBe(true);
      expect(result.goals[0].allocated).toBe(0);
    });
  });

  describe('many goals scenario', () => {
    it('distributes points across many goals by priority', () => {
      // 5 goals, priorities 1-5, each costing 3 points
      const goals = Array.from({ length: 5 }, (_, i) =>
        makeGoal({ id: `goal-${i + 1}`, pointCost: 3, priority: i + 1, recurring: false })
      );
      // 10 points: fills goal-1 (3), goal-2 (3), goal-3 (3), goal-4 gets 1
      const completions = [makeCompletion(10, THIS_WEEK_MON)];

      const result = computeWaterfall(goals, completions, NOW);

      expect(result.goals.find(g => g.goalId === 'goal-1')!.achieved).toBe(true);
      expect(result.goals.find(g => g.goalId === 'goal-2')!.achieved).toBe(true);
      expect(result.goals.find(g => g.goalId === 'goal-3')!.achieved).toBe(true);
      expect(result.goals.find(g => g.goalId === 'goal-4')!.allocated).toBe(1);
      expect(result.goals.find(g => g.goalId === 'goal-5')!.allocated).toBe(0);
    });
  });

  describe('empty inputs', () => {
    it('handles no goals gracefully', () => {
      const result = computeWaterfall([], [makeCompletion(10, THIS_WEEK_MON)], NOW);
      expect(result.goals).toEqual([]);
      expect(result.weeklyEarned).toBe(10);
    });

    it('handles no completions and no goals', () => {
      const result = computeWaterfall([], [], NOW);
      expect(result.goals).toEqual([]);
      expect(result.weeklyEarned).toBe(0);
    });
  });
});

describe('getGoalPeriodKey', () => {
  it('returns weekly period start for recurring weekly goal', () => {
    const goal = makeGoal({ recurring: true, recurrencePeriod: 'weekly' });
    const key = getGoalPeriodKey(goal, NOW);
    expect(key).toBe('2026-02-16'); // Monday of the week
  });

  it('returns monthly period start for recurring monthly goal', () => {
    const goal = makeGoal({ recurring: true, recurrencePeriod: 'monthly' });
    const key = getGoalPeriodKey(goal, NOW);
    expect(key).toBe('2026-02-01');
  });

  it('returns yearly period start for recurring yearly goal', () => {
    const goal = makeGoal({ recurring: true, recurrencePeriod: 'yearly' });
    const key = getGoalPeriodKey(goal, NOW);
    expect(key).toBe('2026-01-01');
  });

  it('returns lastResetAt for non-recurring goal', () => {
    const resetDate = new Date('2026-01-15T10:00:00Z');
    const goal = makeGoal({ recurring: false, lastResetAt: resetDate });
    const key = getGoalPeriodKey(goal, NOW);
    expect(key).toBe('2026-01-15');
  });
});
