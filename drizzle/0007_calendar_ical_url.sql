-- Migration: iCal subscription URL on calendar_sources
-- Adds ical_url column so sources with provider='ical' can store the
-- subscription URL their events are fetched from.

ALTER TABLE calendar_sources ADD COLUMN IF NOT EXISTS ical_url text;
