-- Time-of-day fields for meals and chores so calendar time-grid views
-- can render them at a specific hour. Both are HH:mm varchar(5) and
-- nullable; null = "top of day" / floats above the hour grid.
ALTER TABLE meals ADD COLUMN IF NOT EXISTS meal_time varchar(5);
ALTER TABLE chores ADD COLUMN IF NOT EXISTS next_due_time varchar(5);
