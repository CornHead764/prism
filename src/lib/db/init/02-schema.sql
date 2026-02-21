CREATE TABLE IF NOT EXISTS public.api_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service character varying(100) NOT NULL,
    encrypted_credentials text NOT NULL,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.api_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    token_hash character varying(64) NOT NULL,
    created_by uuid NOT NULL,
    last_used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.babysitter_info (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section character varying(50) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    content jsonb NOT NULL,
    is_sensitive boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.birthdays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    birth_date date NOT NULL,
    event_type character varying(20) DEFAULT 'birthday'::character varying NOT NULL,
    user_id uuid,
    gift_ideas text,
    send_card_days_before integer DEFAULT 7,
    google_calendar_source character varying(50),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.calendar_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    color character varying(7) DEFAULT '#3B82F6'::character varying NOT NULL,
    type character varying(20) DEFAULT 'custom'::character varying NOT NULL,
    user_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.calendar_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    provider character varying(50) NOT NULL,
    source_calendar_id character varying(255) NOT NULL,
    dashboard_calendar_name character varying(255) NOT NULL,
    display_name character varying(255),
    color character varying(7),
    enabled boolean DEFAULT true NOT NULL,
    show_in_event_modal boolean DEFAULT true NOT NULL,
    is_family boolean DEFAULT false NOT NULL,
    group_id uuid,
    access_token text,
    refresh_token text,
    token_expires_at timestamp without time zone,
    last_synced timestamp without time zone,
    sync_errors jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.chore_completions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chore_id uuid NOT NULL,
    completed_by uuid NOT NULL,
    completed_at timestamp without time zone DEFAULT now() NOT NULL,
    approved_by uuid,
    approved_at timestamp without time zone,
    points_awarded integer,
    photo_url text,
    notes text
);

CREATE TABLE IF NOT EXISTS public.chores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    category character varying(50) NOT NULL,
    assigned_to uuid,
    frequency character varying(20) NOT NULL,
    custom_interval_days integer,
    start_day character varying(10),
    last_completed timestamp without time zone,
    next_due date,
    point_value integer DEFAULT 0 NOT NULL,
    requires_approval boolean DEFAULT false NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    calendar_source_id uuid,
    external_event_id character varying(255),
    title character varying(255) NOT NULL,
    description text,
    location character varying(255),
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone NOT NULL,
    all_day boolean DEFAULT false NOT NULL,
    recurring boolean DEFAULT false NOT NULL,
    recurrence_rule text,
    created_by uuid,
    color character varying(7),
    reminder_minutes integer,
    last_synced timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.family_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message text NOT NULL,
    author_id uuid NOT NULL,
    pinned boolean DEFAULT false NOT NULL,
    important boolean DEFAULT false NOT NULL,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.goal_achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    goal_id uuid NOT NULL,
    user_id uuid NOT NULL,
    period_start date NOT NULL,
    achieved_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    point_cost integer NOT NULL,
    emoji character varying(10),
    priority integer DEFAULT 0 NOT NULL,
    recurring boolean DEFAULT false NOT NULL,
    recurrence_period character varying(20),
    active boolean DEFAULT true NOT NULL,
    last_reset_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.layouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    display_id character varying(100),
    widgets jsonb NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    slug character varying(100),
    screensaver_widgets jsonb,
    orientation character varying(20) DEFAULT 'landscape'::character varying
);

CREATE TABLE IF NOT EXISTS public.maintenance_completions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reminder_id uuid NOT NULL,
    completed_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_by uuid,
    cost numeric(10,2),
    vendor character varying(255),
    notes text
);

CREATE TABLE IF NOT EXISTS public.maintenance_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    category character varying(50) NOT NULL,
    description text,
    schedule character varying(20) NOT NULL,
    custom_interval_days integer,
    last_completed timestamp without time zone,
    next_due date NOT NULL,
    assigned_to uuid,
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.meals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    recipe_id uuid,
    recipe text,
    recipe_url text,
    prep_time integer,
    cook_time integer,
    servings integer,
    ingredients text,
    week_of date NOT NULL,
    day_of_week character varying(20) NOT NULL,
    meal_type character varying(20) NOT NULL,
    cooked_at timestamp without time zone,
    cooked_by uuid,
    source character varying(50) DEFAULT 'internal'::character varying NOT NULL,
    source_id character varying(255),
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.photo_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    onedrive_folder_id character varying(255),
    access_token text,
    refresh_token text,
    token_expires_at timestamp without time zone,
    last_synced timestamp without time zone,
    sync_errors jsonb,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id uuid NOT NULL,
    filename character varying(255) NOT NULL,
    original_filename character varying(255) NOT NULL,
    mime_type character varying(50) NOT NULL,
    width integer,
    height integer,
    size_bytes integer,
    taken_at timestamp without time zone,
    external_id character varying(255),
    thumbnail_path character varying(255),
    favorite boolean DEFAULT false NOT NULL,
    orientation character varying(20),
    usage character varying(100) DEFAULT 'wallpaper,gallery,screensaver'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.recipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    url text,
    source_type character varying(50) DEFAULT 'manual'::character varying NOT NULL,
    ingredients jsonb DEFAULT '[]'::jsonb NOT NULL,
    instructions text,
    prep_time integer,
    cook_time integer,
    servings integer,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    cuisine character varying(100),
    category character varying(100),
    image_url text,
    rating integer,
    notes text,
    times_made integer DEFAULT 0 NOT NULL,
    last_made_at timestamp without time zone,
    is_favorite boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key character varying(100) NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.shopping_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    list_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    quantity integer,
    unit character varying(50),
    category character varying(50),
    checked boolean DEFAULT false NOT NULL,
    source character varying(50) DEFAULT 'internal'::character varying NOT NULL,
    source_id character varying(255),
    recurring boolean DEFAULT false NOT NULL,
    recurrence_interval character varying(20),
    added_by uuid,
    notes text,
    shopping_list_source_id uuid,
    external_id character varying(255),
    external_updated_at timestamp without time zone,
    last_synced timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.shopping_list_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider character varying(50) NOT NULL,
    external_list_id character varying(255) NOT NULL,
    external_list_name character varying(255),
    shopping_list_id uuid NOT NULL,
    sync_enabled boolean DEFAULT true NOT NULL,
    access_token text,
    refresh_token text,
    token_expires_at timestamp without time zone,
    last_sync_at timestamp without time zone,
    last_sync_error text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.shopping_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    color character varying(7),
    list_type character varying(20) DEFAULT 'grocery'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    assigned_to uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.task_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    color character varying(7),
    sort_order integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.task_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider character varying(50) NOT NULL,
    external_list_id character varying(255) NOT NULL,
    external_list_name character varying(255),
    task_list_id uuid NOT NULL,
    sync_enabled boolean DEFAULT true NOT NULL,
    access_token text,
    refresh_token text,
    token_expires_at timestamp without time zone,
    last_sync_at timestamp without time zone,
    last_sync_error text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    list_id uuid,
    assigned_to uuid,
    due_date timestamp without time zone,
    priority character varying(20),
    category character varying(100),
    completed boolean DEFAULT false NOT NULL,
    completed_at timestamp without time zone,
    completed_by uuid,
    task_source_id uuid,
    external_id character varying(255),
    external_updated_at timestamp without time zone,
    last_synced timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    role character varying(20) NOT NULL,
    color character varying(7) NOT NULL,
    pin character varying(255),
    email character varying(255),
    avatar_url text,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.api_credentials
    ADD CONSTRAINT api_credentials_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.api_credentials
    ADD CONSTRAINT api_credentials_service_unique UNIQUE (service);

ALTER TABLE ONLY public.api_tokens
    ADD CONSTRAINT api_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.babysitter_info
    ADD CONSTRAINT babysitter_info_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.birthdays
    ADD CONSTRAINT birthdays_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.calendar_groups
    ADD CONSTRAINT calendar_groups_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.calendar_sources
    ADD CONSTRAINT calendar_sources_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.chore_completions
    ADD CONSTRAINT chore_completions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.chores
    ADD CONSTRAINT chores_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.family_messages
    ADD CONSTRAINT family_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.goal_achievements
    ADD CONSTRAINT goal_achievements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.layouts
    ADD CONSTRAINT layouts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.layouts
    ADD CONSTRAINT layouts_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.maintenance_completions
    ADD CONSTRAINT maintenance_completions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.maintenance_reminders
    ADD CONSTRAINT maintenance_reminders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.photo_sources
    ADD CONSTRAINT photo_sources_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_key_unique UNIQUE (key);

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shopping_items
    ADD CONSTRAINT shopping_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shopping_list_sources
    ADD CONSTRAINT shopping_list_sources_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shopping_lists
    ADD CONSTRAINT shopping_lists_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.task_lists
    ADD CONSTRAINT task_lists_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.task_sources
    ADD CONSTRAINT task_sources_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

CREATE INDEX IF NOT EXISTS api_tokens_created_by_idx ON public.api_tokens USING btree (created_by);

CREATE UNIQUE INDEX IF NOT EXISTS api_tokens_token_hash_idx ON public.api_tokens USING btree (token_hash);

CREATE INDEX IF NOT EXISTS babysitter_info_section_idx ON public.babysitter_info USING btree (section);

CREATE INDEX IF NOT EXISTS babysitter_info_sort_order_idx ON public.babysitter_info USING btree (sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS birthdays_name_event_type_idx ON public.birthdays USING btree (name, event_type);

CREATE INDEX IF NOT EXISTS calendar_groups_type_idx ON public.calendar_groups USING btree (type);

CREATE INDEX IF NOT EXISTS calendar_sources_enabled_idx ON public.calendar_sources USING btree (enabled);

CREATE INDEX IF NOT EXISTS calendar_sources_user_id_idx ON public.calendar_sources USING btree (user_id);

CREATE INDEX IF NOT EXISTS chore_completions_approved_by_idx ON public.chore_completions USING btree (approved_by);

CREATE INDEX IF NOT EXISTS chore_completions_chore_approved_by_idx ON public.chore_completions USING btree (chore_id, approved_by);

CREATE INDEX IF NOT EXISTS chore_completions_chore_id_idx ON public.chore_completions USING btree (chore_id);

CREATE INDEX IF NOT EXISTS chore_completions_completed_at_idx ON public.chore_completions USING btree (completed_at);

CREATE INDEX IF NOT EXISTS chores_assigned_to_idx ON public.chores USING btree (assigned_to);

CREATE INDEX IF NOT EXISTS chores_next_due_idx ON public.chores USING btree (next_due);

CREATE INDEX IF NOT EXISTS events_calendar_source_idx ON public.events USING btree (calendar_source_id);

CREATE INDEX IF NOT EXISTS events_end_time_idx ON public.events USING btree (end_time);

CREATE UNIQUE INDEX IF NOT EXISTS events_source_external_unique ON public.events USING btree (calendar_source_id, external_event_id);

CREATE INDEX IF NOT EXISTS events_start_time_idx ON public.events USING btree (start_time);

CREATE INDEX IF NOT EXISTS family_messages_created_at_idx ON public.family_messages USING btree (created_at);

CREATE INDEX IF NOT EXISTS family_messages_expires_at_idx ON public.family_messages USING btree (expires_at);

CREATE INDEX IF NOT EXISTS goal_achievements_goal_id_idx ON public.goal_achievements USING btree (goal_id);

CREATE UNIQUE INDEX IF NOT EXISTS goal_achievements_goal_user_period_idx ON public.goal_achievements USING btree (goal_id, user_id, period_start);

CREATE INDEX IF NOT EXISTS goal_achievements_user_id_idx ON public.goal_achievements USING btree (user_id);

CREATE INDEX IF NOT EXISTS goals_active_idx ON public.goals USING btree (active);

CREATE INDEX IF NOT EXISTS goals_active_priority_idx ON public.goals USING btree (active, priority);

CREATE INDEX IF NOT EXISTS maintenance_reminders_next_due_idx ON public.maintenance_reminders USING btree (next_due);

CREATE INDEX IF NOT EXISTS meals_day_of_week_idx ON public.meals USING btree (day_of_week);

CREATE INDEX IF NOT EXISTS meals_week_of_idx ON public.meals USING btree (week_of);

CREATE INDEX IF NOT EXISTS photos_favorite_idx ON public.photos USING btree (favorite);

CREATE INDEX IF NOT EXISTS photos_source_id_idx ON public.photos USING btree (source_id);

CREATE INDEX IF NOT EXISTS photos_taken_at_idx ON public.photos USING btree (taken_at);

CREATE INDEX IF NOT EXISTS photos_usage_idx ON public.photos USING btree (usage);

CREATE INDEX IF NOT EXISTS recipes_favorite_idx ON public.recipes USING btree (is_favorite);

CREATE INDEX IF NOT EXISTS recipes_name_idx ON public.recipes USING btree (name);

CREATE INDEX IF NOT EXISTS recipes_source_type_idx ON public.recipes USING btree (source_type);

CREATE INDEX IF NOT EXISTS shopping_items_category_idx ON public.shopping_items USING btree (category);

CREATE INDEX IF NOT EXISTS shopping_items_checked_idx ON public.shopping_items USING btree (checked);

CREATE INDEX IF NOT EXISTS shopping_items_external_id_idx ON public.shopping_items USING btree (external_id);

CREATE INDEX IF NOT EXISTS shopping_items_list_id_idx ON public.shopping_items USING btree (list_id);

CREATE INDEX IF NOT EXISTS shopping_items_source_idx ON public.shopping_items USING btree (shopping_list_source_id);

CREATE INDEX IF NOT EXISTS shopping_list_sources_shopping_list_idx ON public.shopping_list_sources USING btree (shopping_list_id);

CREATE INDEX IF NOT EXISTS shopping_list_sources_user_provider_idx ON public.shopping_list_sources USING btree (user_id, provider);

CREATE INDEX IF NOT EXISTS task_sources_task_list_idx ON public.task_sources USING btree (task_list_id);

CREATE INDEX IF NOT EXISTS task_sources_user_provider_idx ON public.task_sources USING btree (user_id, provider);

CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON public.tasks USING btree (assigned_to);

CREATE INDEX IF NOT EXISTS tasks_completed_idx ON public.tasks USING btree (completed);

CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON public.tasks USING btree (due_date);

CREATE INDEX IF NOT EXISTS tasks_external_id_idx ON public.tasks USING btree (external_id);

CREATE INDEX IF NOT EXISTS tasks_list_id_idx ON public.tasks USING btree (list_id);

CREATE INDEX IF NOT EXISTS tasks_task_source_idx ON public.tasks USING btree (task_source_id);

CREATE INDEX IF NOT EXISTS users_email_idx ON public.users USING btree (email);

ALTER TABLE ONLY public.api_tokens
    ADD CONSTRAINT api_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.birthdays
    ADD CONSTRAINT birthdays_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.birthdays
    ADD CONSTRAINT birthdays_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.calendar_groups
    ADD CONSTRAINT calendar_groups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.calendar_groups
    ADD CONSTRAINT calendar_groups_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.calendar_sources
    ADD CONSTRAINT calendar_sources_group_id_calendar_groups_id_fk FOREIGN KEY (group_id) REFERENCES public.calendar_groups(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.calendar_sources
    ADD CONSTRAINT calendar_sources_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.calendar_groups(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.calendar_sources
    ADD CONSTRAINT calendar_sources_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.calendar_sources
    ADD CONSTRAINT calendar_sources_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.chore_completions
    ADD CONSTRAINT chore_completions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.chore_completions
    ADD CONSTRAINT chore_completions_approved_by_users_id_fk FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.chore_completions
    ADD CONSTRAINT chore_completions_chore_id_chores_id_fk FOREIGN KEY (chore_id) REFERENCES public.chores(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.chore_completions
    ADD CONSTRAINT chore_completions_chore_id_fkey FOREIGN KEY (chore_id) REFERENCES public.chores(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.chore_completions
    ADD CONSTRAINT chore_completions_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.chore_completions
    ADD CONSTRAINT chore_completions_completed_by_users_id_fk FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.chores
    ADD CONSTRAINT chores_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.chores
    ADD CONSTRAINT chores_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.chores
    ADD CONSTRAINT chores_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.chores
    ADD CONSTRAINT chores_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_calendar_source_id_calendar_sources_id_fk FOREIGN KEY (calendar_source_id) REFERENCES public.calendar_sources(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_calendar_source_id_fkey FOREIGN KEY (calendar_source_id) REFERENCES public.calendar_sources(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.family_messages
    ADD CONSTRAINT family_messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.family_messages
    ADD CONSTRAINT family_messages_author_id_users_id_fk FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.goal_achievements
    ADD CONSTRAINT goal_achievements_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.goals(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.goal_achievements
    ADD CONSTRAINT goal_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.layouts
    ADD CONSTRAINT layouts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.layouts
    ADD CONSTRAINT layouts_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.maintenance_completions
    ADD CONSTRAINT maintenance_completions_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.maintenance_completions
    ADD CONSTRAINT maintenance_completions_completed_by_users_id_fk FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.maintenance_completions
    ADD CONSTRAINT maintenance_completions_reminder_id_fkey FOREIGN KEY (reminder_id) REFERENCES public.maintenance_reminders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.maintenance_completions
    ADD CONSTRAINT maintenance_completions_reminder_id_maintenance_reminders_id_fk FOREIGN KEY (reminder_id) REFERENCES public.maintenance_reminders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.maintenance_reminders
    ADD CONSTRAINT maintenance_reminders_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.maintenance_reminders
    ADD CONSTRAINT maintenance_reminders_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.maintenance_reminders
    ADD CONSTRAINT maintenance_reminders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.maintenance_reminders
    ADD CONSTRAINT maintenance_reminders_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_cooked_by_fkey FOREIGN KEY (cooked_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_cooked_by_users_id_fk FOREIGN KEY (cooked_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.photo_sources(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_source_id_photo_sources_id_fk FOREIGN KEY (source_id) REFERENCES public.photo_sources(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.shopping_items
    ADD CONSTRAINT shopping_items_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.shopping_items
    ADD CONSTRAINT shopping_items_added_by_users_id_fk FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.shopping_items
    ADD CONSTRAINT shopping_items_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.shopping_lists(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shopping_items
    ADD CONSTRAINT shopping_items_list_id_shopping_lists_id_fk FOREIGN KEY (list_id) REFERENCES public.shopping_lists(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shopping_items
    ADD CONSTRAINT shopping_items_shopping_list_source_id_fkey FOREIGN KEY (shopping_list_source_id) REFERENCES public.shopping_list_sources(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.shopping_list_sources
    ADD CONSTRAINT shopping_list_sources_shopping_list_id_fkey FOREIGN KEY (shopping_list_id) REFERENCES public.shopping_lists(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shopping_list_sources
    ADD CONSTRAINT shopping_list_sources_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shopping_lists
    ADD CONSTRAINT shopping_lists_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.shopping_lists
    ADD CONSTRAINT shopping_lists_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.shopping_lists
    ADD CONSTRAINT shopping_lists_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.shopping_lists
    ADD CONSTRAINT shopping_lists_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.task_lists
    ADD CONSTRAINT task_lists_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.task_sources
    ADD CONSTRAINT task_sources_task_list_id_fkey FOREIGN KEY (task_list_id) REFERENCES public.task_lists(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.task_sources
    ADD CONSTRAINT task_sources_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_completed_by_users_id_fk FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.task_lists(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_task_source_id_fkey FOREIGN KEY (task_source_id) REFERENCES public.task_sources(id) ON DELETE SET NULL;

