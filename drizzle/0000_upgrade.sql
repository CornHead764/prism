-- 0000_upgrade.sql
-- Idempotent catch-up migration for all Prism installations.
-- Runs once when the migration system initializes on a database for the first time.
--
-- For fresh installs:  Docker Postgres already created the schema from 02-schema.sql,
--                      so every CREATE/ALTER here is a no-op. Safe.
-- For existing installs: adds any tables and columns introduced since the initial release.
--                        All operations use IF NOT EXISTS — safe on any schema version.
--
-- After this file runs, the database is guaranteed to match the current schema.ts
-- regardless of when the instance was originally installed.

-- ============================================================
-- New tables (may not exist on older installs)
-- All use inline PRIMARY KEY so no separate ALTER TABLE is needed.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.goals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    name varchar(255) NOT NULL,
    description text,
    point_cost integer NOT NULL,
    emoji varchar(10),
    priority integer DEFAULT 0 NOT NULL,
    recurring boolean DEFAULT false NOT NULL,
    recurrence_period varchar(20),
    active boolean DEFAULT true NOT NULL,
    last_reset_at timestamp DEFAULT now() NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.goal_achievements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    goal_id uuid NOT NULL,
    user_id uuid NOT NULL,
    period_start date NOT NULL,
    achieved_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.task_lists (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    name varchar(255) NOT NULL,
    color varchar(7),
    sort_order integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.task_sources (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    user_id uuid NOT NULL,
    provider varchar(50) NOT NULL,
    external_list_id varchar(255) NOT NULL,
    external_list_name varchar(255),
    task_list_id uuid NOT NULL,
    sync_enabled boolean DEFAULT true NOT NULL,
    access_token text,
    refresh_token text,
    token_expires_at timestamp,
    last_sync_at timestamp,
    last_sync_error text,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.recipes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    name varchar(255) NOT NULL,
    description text,
    url text,
    source_type varchar(50) DEFAULT 'manual' NOT NULL,
    ingredients jsonb DEFAULT '[]' NOT NULL,
    instructions text,
    prep_time integer,
    cook_time integer,
    servings integer,
    tags jsonb DEFAULT '[]' NOT NULL,
    cuisine varchar(100),
    category varchar(100),
    image_url text,
    rating integer,
    notes text,
    times_made integer DEFAULT 0 NOT NULL,
    last_made_at timestamp,
    is_favorite boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.shopping_list_sources (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    user_id uuid NOT NULL,
    provider varchar(50) NOT NULL,
    external_list_id varchar(255) NOT NULL,
    external_list_name varchar(255),
    shopping_list_id uuid NOT NULL,
    sync_enabled boolean DEFAULT true NOT NULL,
    access_token text,
    refresh_token text,
    token_expires_at timestamp,
    last_sync_at timestamp,
    last_sync_error text,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.babysitter_info (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    section varchar(50) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    content jsonb NOT NULL,
    is_sensitive boolean DEFAULT false NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.api_tokens (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    name varchar(100) NOT NULL,
    token_hash varchar(64) NOT NULL,
    created_by uuid NOT NULL,
    scopes jsonb DEFAULT '["*"]' NOT NULL,
    last_used_at timestamp,
    created_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wish_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    member_id uuid NOT NULL,
    name varchar(255) NOT NULL,
    url text,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    claimed boolean DEFAULT false NOT NULL,
    claimed_by uuid,
    claimed_at timestamp,
    added_by uuid,
    wish_item_source_id uuid,
    external_id varchar(255),
    external_updated_at timestamp,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wish_item_sources (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    user_id uuid NOT NULL,
    provider varchar(50) NOT NULL,
    external_list_id varchar(255) NOT NULL,
    external_list_name varchar(255),
    member_id uuid NOT NULL,
    sync_enabled boolean DEFAULT true NOT NULL,
    access_token text,
    refresh_token text,
    token_expires_at timestamp,
    last_sync_at timestamp,
    last_sync_error text,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    user_id uuid,
    action varchar(50) NOT NULL,
    entity_type varchar(50) NOT NULL,
    entity_id varchar(255),
    summary varchar(500) NOT NULL,
    metadata jsonb,
    created_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.bus_routes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    student_name varchar(100) NOT NULL,
    user_id uuid,
    trip_id varchar(50) NOT NULL,
    direction varchar(10) NOT NULL,
    label varchar(255) NOT NULL,
    scheduled_time varchar(5) NOT NULL,
    active_days jsonb DEFAULT '[1,2,3,4,5]' NOT NULL,
    checkpoints jsonb DEFAULT '[]' NOT NULL,
    stop_name varchar(255),
    school_name varchar(255),
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.bus_geofence_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    route_id uuid NOT NULL,
    event_type varchar(30) NOT NULL,
    checkpoint_name varchar(255) NOT NULL,
    checkpoint_index integer NOT NULL,
    event_time timestamp NOT NULL,
    day_of_week integer NOT NULL,
    trip_date date NOT NULL,
    gmail_message_id varchar(255) NOT NULL,
    raw_data jsonb,
    created_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.calendar_notes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    date date NOT NULL,
    content text DEFAULT '' NOT NULL,
    created_by uuid,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.gift_ideas (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    created_by uuid NOT NULL,
    for_user_id uuid NOT NULL,
    name varchar(255) NOT NULL,
    url text,
    notes text,
    price numeric(10,2),
    purchased boolean DEFAULT false NOT NULL,
    purchased_at timestamp,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
);

-- ============================================================
-- New columns on tables that existed from the initial release
-- ============================================================

-- calendar_sources (group support, family flag, event modal toggle)
ALTER TABLE public.calendar_sources ADD COLUMN IF NOT EXISTS show_in_event_modal boolean DEFAULT true NOT NULL;
ALTER TABLE public.calendar_sources ADD COLUMN IF NOT EXISTS is_family boolean DEFAULT false NOT NULL;
ALTER TABLE public.calendar_sources ADD COLUMN IF NOT EXISTS group_id uuid;

-- tasks (external sync fields, list association)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS list_id uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_source_id uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS external_id varchar(255);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS external_updated_at timestamp;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS last_synced timestamp;

-- chores (start day for weekly scheduling)
ALTER TABLE public.chores ADD COLUMN IF NOT EXISTS start_day varchar(10);

-- shopping_items (external sync fields, list source)
ALTER TABLE public.shopping_items ADD COLUMN IF NOT EXISTS shopping_list_source_id uuid;
ALTER TABLE public.shopping_items ADD COLUMN IF NOT EXISTS external_id varchar(255);
ALTER TABLE public.shopping_items ADD COLUMN IF NOT EXISTS external_updated_at timestamp;
ALTER TABLE public.shopping_items ADD COLUMN IF NOT EXISTS last_synced timestamp;

-- shopping_lists (type, timestamps, visibility, assignment)
ALTER TABLE public.shopping_lists ADD COLUMN IF NOT EXISTS list_type varchar(20) DEFAULT 'grocery' NOT NULL;
ALTER TABLE public.shopping_lists ADD COLUMN IF NOT EXISTS updated_at timestamp;
ALTER TABLE public.shopping_lists ADD COLUMN IF NOT EXISTS visible_categories jsonb;
ALTER TABLE public.shopping_lists ADD COLUMN IF NOT EXISTS assigned_to uuid;

-- family_messages (updated_at for edit tracking)
ALTER TABLE public.family_messages ADD COLUMN IF NOT EXISTS updated_at timestamp;

-- birthdays (event type for anniversary support, Google Calendar source)
ALTER TABLE public.birthdays ADD COLUMN IF NOT EXISTS event_type varchar(20) DEFAULT 'birthday' NOT NULL;
ALTER TABLE public.birthdays ADD COLUMN IF NOT EXISTS google_calendar_source varchar(50);

-- layouts (multi-dashboard: slug, screensaver config, orientation, font scale)
ALTER TABLE public.layouts ADD COLUMN IF NOT EXISTS slug varchar(100);
ALTER TABLE public.layouts ADD COLUMN IF NOT EXISTS screensaver_widgets jsonb;
ALTER TABLE public.layouts ADD COLUMN IF NOT EXISTS orientation varchar(20) DEFAULT 'landscape';
ALTER TABLE public.layouts ADD COLUMN IF NOT EXISTS font_scale integer;

-- photos (orientation and usage flags)
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS orientation varchar(20);
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS usage varchar(100) DEFAULT 'wallpaper,gallery,screensaver' NOT NULL;

-- meals (recipe association)
ALTER TABLE public.meals ADD COLUMN IF NOT EXISTS recipe_id uuid;

-- users (display sort order)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0 NOT NULL;

-- api_tokens: scopes added Apr 2026 (table itself added Feb 2026 — some installs may lack this column)
ALTER TABLE public.api_tokens ADD COLUMN IF NOT EXISTS scopes jsonb DEFAULT '["*"]' NOT NULL;

-- bus_routes: sort_order added Apr 2026 (table added Mar 2026 — some installs may lack this column)
ALTER TABLE public.bus_routes ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0 NOT NULL;

-- ============================================================
-- Indexes for new tables
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS api_tokens_token_hash_idx ON public.api_tokens (token_hash);
CREATE INDEX IF NOT EXISTS api_tokens_created_by_idx ON public.api_tokens (created_by);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_type_idx ON public.audit_logs (entity_type);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at);
CREATE INDEX IF NOT EXISTS babysitter_info_section_idx ON public.babysitter_info (section);
CREATE INDEX IF NOT EXISTS babysitter_info_sort_order_idx ON public.babysitter_info (sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS bus_geofence_log_gmail_message_id_idx ON public.bus_geofence_log (gmail_message_id);
CREATE INDEX IF NOT EXISTS bus_geofence_log_route_id_idx ON public.bus_geofence_log (route_id);
CREATE INDEX IF NOT EXISTS bus_geofence_log_trip_date_idx ON public.bus_geofence_log (trip_date);
CREATE INDEX IF NOT EXISTS bus_geofence_log_event_time_idx ON public.bus_geofence_log (event_time);
CREATE UNIQUE INDEX IF NOT EXISTS bus_routes_trip_direction_idx ON public.bus_routes (trip_id, direction);
CREATE INDEX IF NOT EXISTS bus_routes_enabled_idx ON public.bus_routes (enabled);
CREATE UNIQUE INDEX IF NOT EXISTS calendar_notes_date_idx ON public.calendar_notes (date);
CREATE INDEX IF NOT EXISTS gift_ideas_created_by_idx ON public.gift_ideas (created_by);
CREATE INDEX IF NOT EXISTS gift_ideas_for_user_id_idx ON public.gift_ideas (for_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS goal_achievements_unique_idx ON public.goal_achievements (goal_id, user_id, period_start);
CREATE INDEX IF NOT EXISTS goal_achievements_goal_id_idx ON public.goal_achievements (goal_id);
CREATE INDEX IF NOT EXISTS goal_achievements_user_id_idx ON public.goal_achievements (user_id);
CREATE INDEX IF NOT EXISTS wish_items_member_id_idx ON public.wish_items (member_id);
CREATE INDEX IF NOT EXISTS wish_items_added_by_idx ON public.wish_items (added_by);
CREATE INDEX IF NOT EXISTS wish_items_wish_item_source_id_idx ON public.wish_items (wish_item_source_id);
CREATE UNIQUE INDEX IF NOT EXISTS wish_items_external_id_idx ON public.wish_items (wish_item_source_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wish_item_sources_user_id_idx ON public.wish_item_sources (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS wish_item_sources_unique_idx ON public.wish_item_sources (user_id, member_id, provider);

-- Indexes for new columns on existing tables
CREATE UNIQUE INDEX IF NOT EXISTS layouts_slug_unique_idx ON public.layouts (slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS birthdays_name_event_type_idx ON public.birthdays (name, event_type);
CREATE INDEX IF NOT EXISTS shopping_items_shopping_list_source_id_idx ON public.shopping_items (shopping_list_source_id);
CREATE INDEX IF NOT EXISTS shopping_items_external_id_idx ON public.shopping_items (external_id);
CREATE INDEX IF NOT EXISTS tasks_list_id_idx ON public.tasks (list_id);
CREATE INDEX IF NOT EXISTS tasks_task_source_id_idx ON public.tasks (task_source_id);
CREATE INDEX IF NOT EXISTS tasks_external_id_idx ON public.tasks (external_id);
