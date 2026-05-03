CREATE TABLE IF NOT EXISTS goal_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    redeemed_by_parent UUID REFERENCES users(id) ON DELETE SET NULL,
    points_cost INTEGER NOT NULL,
    notes TEXT,
    redeemed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS goal_redemptions_goal_id_idx ON goal_redemptions(goal_id);
CREATE INDEX IF NOT EXISTS goal_redemptions_user_id_idx ON goal_redemptions(user_id);
CREATE INDEX IF NOT EXISTS goal_redemptions_redeemed_at_idx ON goal_redemptions(redeemed_at);
