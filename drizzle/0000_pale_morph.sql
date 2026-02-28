CREATE TABLE "api_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service" varchar(100) NOT NULL,
	"encrypted_credentials" text NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_credentials_service_unique" UNIQUE("service")
);
--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"created_by" uuid NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "babysitter_info" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section" varchar(50) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"content" jsonb NOT NULL,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "birthdays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"birth_date" date NOT NULL,
	"event_type" varchar(20) DEFAULT 'birthday' NOT NULL,
	"user_id" uuid,
	"gift_ideas" text,
	"send_card_days_before" integer DEFAULT 7,
	"google_calendar_source" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"color" varchar(7) DEFAULT '#3B82F6' NOT NULL,
	"type" varchar(20) DEFAULT 'custom' NOT NULL,
	"user_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"provider" varchar(50) NOT NULL,
	"source_calendar_id" varchar(255) NOT NULL,
	"dashboard_calendar_name" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"color" varchar(7),
	"enabled" boolean DEFAULT true NOT NULL,
	"show_in_event_modal" boolean DEFAULT true NOT NULL,
	"is_family" boolean DEFAULT false NOT NULL,
	"group_id" uuid,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"last_synced" timestamp,
	"sync_errors" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chore_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chore_id" uuid NOT NULL,
	"completed_by" uuid NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp,
	"points_awarded" integer,
	"photo_url" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "chores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"assigned_to" uuid,
	"frequency" varchar(20) NOT NULL,
	"custom_interval_days" integer,
	"start_day" varchar(10),
	"last_completed" timestamp,
	"next_due" date,
	"point_value" integer DEFAULT 0 NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_source_id" uuid,
	"external_event_id" varchar(255),
	"title" varchar(255) NOT NULL,
	"description" text,
	"location" varchar(255),
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"recurring" boolean DEFAULT false NOT NULL,
	"recurrence_rule" text,
	"created_by" uuid,
	"color" varchar(7),
	"reminder_minutes" integer,
	"last_synced" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message" text NOT NULL,
	"author_id" uuid NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"important" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"achieved_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"point_cost" integer NOT NULL,
	"emoji" varchar(10),
	"priority" integer DEFAULT 0 NOT NULL,
	"recurring" boolean DEFAULT false NOT NULL,
	"recurrence_period" varchar(20),
	"active" boolean DEFAULT true NOT NULL,
	"last_reset_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100),
	"is_default" boolean DEFAULT false NOT NULL,
	"display_id" varchar(100),
	"widgets" jsonb NOT NULL,
	"screensaver_widgets" jsonb,
	"orientation" varchar(20) DEFAULT 'landscape',
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "layouts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "maintenance_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reminder_id" uuid NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"completed_by" uuid,
	"cost" numeric(10, 2),
	"vendor" varchar(255),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "maintenance_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"description" text,
	"schedule" varchar(20) NOT NULL,
	"custom_interval_days" integer,
	"last_completed" timestamp,
	"next_due" date NOT NULL,
	"assigned_to" uuid,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"recipe_id" uuid,
	"recipe" text,
	"recipe_url" text,
	"prep_time" integer,
	"cook_time" integer,
	"servings" integer,
	"ingredients" text,
	"week_of" date NOT NULL,
	"day_of_week" varchar(20) NOT NULL,
	"meal_type" varchar(20) NOT NULL,
	"cooked_at" timestamp,
	"cooked_by" uuid,
	"source" varchar(50) DEFAULT 'internal' NOT NULL,
	"source_id" varchar(255),
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"onedrive_folder_id" varchar(255),
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"last_synced" timestamp,
	"sync_errors" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(50) NOT NULL,
	"width" integer,
	"height" integer,
	"size_bytes" integer,
	"taken_at" timestamp,
	"external_id" varchar(255),
	"thumbnail_path" varchar(255),
	"favorite" boolean DEFAULT false NOT NULL,
	"orientation" varchar(20),
	"usage" varchar(100) DEFAULT 'wallpaper,gallery,screensaver' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"url" text,
	"source_type" varchar(50) DEFAULT 'manual' NOT NULL,
	"ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"instructions" text,
	"prep_time" integer,
	"cook_time" integer,
	"servings" integer,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cuisine" varchar(100),
	"category" varchar(100),
	"image_url" text,
	"rating" integer,
	"notes" text,
	"times_made" integer DEFAULT 0 NOT NULL,
	"last_made_at" timestamp,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "shopping_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"quantity" integer,
	"unit" varchar(50),
	"category" varchar(50),
	"checked" boolean DEFAULT false NOT NULL,
	"source" varchar(50) DEFAULT 'internal' NOT NULL,
	"source_id" varchar(255),
	"recurring" boolean DEFAULT false NOT NULL,
	"recurrence_interval" varchar(20),
	"added_by" uuid,
	"notes" text,
	"shopping_list_source_id" uuid,
	"external_id" varchar(255),
	"external_updated_at" timestamp,
	"last_synced" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_list_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"external_list_id" varchar(255) NOT NULL,
	"external_list_name" varchar(255),
	"shopping_list_id" uuid NOT NULL,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"last_sync_at" timestamp,
	"last_sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"icon" varchar(50),
	"color" varchar(7),
	"list_type" varchar(20) DEFAULT 'grocery' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"visible_categories" jsonb,
	"assigned_to" uuid,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"color" varchar(7),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"external_list_id" varchar(255) NOT NULL,
	"external_list_name" varchar(255),
	"task_list_id" uuid NOT NULL,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"last_sync_at" timestamp,
	"last_sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"list_id" uuid,
	"assigned_to" uuid,
	"due_date" timestamp,
	"priority" varchar(20),
	"category" varchar(100),
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"completed_by" uuid,
	"task_source_id" uuid,
	"external_id" varchar(255),
	"external_updated_at" timestamp,
	"last_synced" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"role" varchar(20) NOT NULL,
	"color" varchar(7) NOT NULL,
	"pin" varchar(255),
	"email" varchar(255),
	"avatar_url" text,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wish_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" text,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"claimed" boolean DEFAULT false NOT NULL,
	"claimed_by" uuid,
	"claimed_at" timestamp,
	"added_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthdays" ADD CONSTRAINT "birthdays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_groups" ADD CONSTRAINT "calendar_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sources" ADD CONSTRAINT "calendar_sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sources" ADD CONSTRAINT "calendar_sources_group_id_calendar_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."calendar_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_completions" ADD CONSTRAINT "chore_completions_chore_id_chores_id_fk" FOREIGN KEY ("chore_id") REFERENCES "public"."chores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_completions" ADD CONSTRAINT "chore_completions_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_completions" ADD CONSTRAINT "chore_completions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_calendar_source_id_calendar_sources_id_fk" FOREIGN KEY ("calendar_source_id") REFERENCES "public"."calendar_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_messages" ADD CONSTRAINT "family_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_achievements" ADD CONSTRAINT "goal_achievements_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_achievements" ADD CONSTRAINT "goal_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layouts" ADD CONSTRAINT "layouts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_completions" ADD CONSTRAINT "maintenance_completions_reminder_id_maintenance_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."maintenance_reminders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_completions" ADD CONSTRAINT "maintenance_completions_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_reminders" ADD CONSTRAINT "maintenance_reminders_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_reminders" ADD CONSTRAINT "maintenance_reminders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_cooked_by_users_id_fk" FOREIGN KEY ("cooked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_source_id_photo_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."photo_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_list_id_shopping_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_shopping_list_source_id_shopping_list_sources_id_fk" FOREIGN KEY ("shopping_list_source_id") REFERENCES "public"."shopping_list_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_sources" ADD CONSTRAINT "shopping_list_sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_sources" ADD CONSTRAINT "shopping_list_sources_shopping_list_id_shopping_lists_id_fk" FOREIGN KEY ("shopping_list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_lists" ADD CONSTRAINT "task_lists_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_sources" ADD CONSTRAINT "task_sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_sources" ADD CONSTRAINT "task_sources_task_list_id_task_lists_id_fk" FOREIGN KEY ("task_list_id") REFERENCES "public"."task_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_list_id_task_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."task_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_task_source_id_task_sources_id_fk" FOREIGN KEY ("task_source_id") REFERENCES "public"."task_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wish_items" ADD CONSTRAINT "wish_items_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wish_items" ADD CONSTRAINT "wish_items_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wish_items" ADD CONSTRAINT "wish_items_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_tokens_token_hash_idx" ON "api_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "api_tokens_created_by_idx" ON "api_tokens" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "babysitter_info_section_idx" ON "babysitter_info" USING btree ("section");--> statement-breakpoint
CREATE INDEX "babysitter_info_sort_order_idx" ON "babysitter_info" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "birthdays_name_event_type_idx" ON "birthdays" USING btree ("name","event_type");--> statement-breakpoint
CREATE INDEX "calendar_groups_type_idx" ON "calendar_groups" USING btree ("type");--> statement-breakpoint
CREATE INDEX "calendar_sources_user_id_idx" ON "calendar_sources" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "calendar_sources_enabled_idx" ON "calendar_sources" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "chore_completions_chore_id_idx" ON "chore_completions" USING btree ("chore_id");--> statement-breakpoint
CREATE INDEX "chore_completions_completed_at_idx" ON "chore_completions" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "chore_completions_approved_by_idx" ON "chore_completions" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "chore_completions_chore_approved_by_idx" ON "chore_completions" USING btree ("chore_id","approved_by");--> statement-breakpoint
CREATE INDEX "chores_next_due_idx" ON "chores" USING btree ("next_due");--> statement-breakpoint
CREATE INDEX "chores_assigned_to_idx" ON "chores" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "events_start_time_idx" ON "events" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "events_end_time_idx" ON "events" USING btree ("end_time");--> statement-breakpoint
CREATE INDEX "events_calendar_source_idx" ON "events" USING btree ("calendar_source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_source_external_unique" ON "events" USING btree ("calendar_source_id","external_event_id");--> statement-breakpoint
CREATE INDEX "family_messages_created_at_idx" ON "family_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "family_messages_expires_at_idx" ON "family_messages" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "goal_achievements_goal_user_period_idx" ON "goal_achievements" USING btree ("goal_id","user_id","period_start");--> statement-breakpoint
CREATE INDEX "goal_achievements_user_id_idx" ON "goal_achievements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "goal_achievements_goal_id_idx" ON "goal_achievements" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "goals_active_idx" ON "goals" USING btree ("active");--> statement-breakpoint
CREATE INDEX "goals_active_priority_idx" ON "goals" USING btree ("active","priority");--> statement-breakpoint
CREATE INDEX "maintenance_reminders_next_due_idx" ON "maintenance_reminders" USING btree ("next_due");--> statement-breakpoint
CREATE INDEX "meals_week_of_idx" ON "meals" USING btree ("week_of");--> statement-breakpoint
CREATE INDEX "meals_day_of_week_idx" ON "meals" USING btree ("day_of_week");--> statement-breakpoint
CREATE INDEX "photos_source_id_idx" ON "photos" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "photos_taken_at_idx" ON "photos" USING btree ("taken_at");--> statement-breakpoint
CREATE INDEX "photos_favorite_idx" ON "photos" USING btree ("favorite");--> statement-breakpoint
CREATE INDEX "photos_usage_idx" ON "photos" USING btree ("usage");--> statement-breakpoint
CREATE INDEX "recipes_name_idx" ON "recipes" USING btree ("name");--> statement-breakpoint
CREATE INDEX "recipes_favorite_idx" ON "recipes" USING btree ("is_favorite");--> statement-breakpoint
CREATE INDEX "recipes_source_type_idx" ON "recipes" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "shopping_items_list_id_idx" ON "shopping_items" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "shopping_items_category_idx" ON "shopping_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "shopping_items_checked_idx" ON "shopping_items" USING btree ("checked");--> statement-breakpoint
CREATE INDEX "shopping_items_source_idx" ON "shopping_items" USING btree ("shopping_list_source_id");--> statement-breakpoint
CREATE INDEX "shopping_items_external_id_idx" ON "shopping_items" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "shopping_list_sources_user_provider_idx" ON "shopping_list_sources" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "shopping_list_sources_shopping_list_idx" ON "shopping_list_sources" USING btree ("shopping_list_id");--> statement-breakpoint
CREATE INDEX "task_sources_user_provider_idx" ON "task_sources" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "task_sources_task_list_idx" ON "task_sources" USING btree ("task_list_id");--> statement-breakpoint
CREATE INDEX "tasks_list_id_idx" ON "tasks" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "tasks_assigned_to_idx" ON "tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "tasks_due_date_idx" ON "tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "tasks_completed_idx" ON "tasks" USING btree ("completed");--> statement-breakpoint
CREATE INDEX "tasks_task_source_idx" ON "tasks" USING btree ("task_source_id");--> statement-breakpoint
CREATE INDEX "tasks_external_id_idx" ON "tasks" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "wish_items_member_id_idx" ON "wish_items" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "wish_items_claimed_idx" ON "wish_items" USING btree ("claimed");