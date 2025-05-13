CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_source" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"platform" text DEFAULT 'steam' NOT NULL,
	"external_id" text NOT NULL,
	"title" text,
	"developer" text,
	"description_short" text,
	"description_detailed" text,
	"genres" text[],
	"tags" text[],
	"embedding" vector(1536),
	"raw_data" jsonb,
	"enrichment_status" text DEFAULT 'pending' NOT NULL,
	"is_featured" boolean DEFAULT false,
	"steam_appid" text,
	"last_fetched" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "external_source_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "external_source_steam_appid_unique" UNIQUE("steam_appid")
);
--> statement-breakpoint
CREATE TABLE "library" (
	"user_id" uuid NOT NULL,
	"game_ref_id" bigint NOT NULL,
	"added_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "library_user_id_game_ref_id_pk" PRIMARY KEY("user_id","game_ref_id")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"bio" text,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "library" ADD CONSTRAINT "library_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library" ADD CONSTRAINT "library_game_ref_id_external_source_id_fk" FOREIGN KEY ("game_ref_id") REFERENCES "public"."external_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_external_source_external_id" ON "external_source" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_external_source_enrichment_status" ON "external_source" USING btree ("enrichment_status");--> statement-breakpoint
CREATE INDEX "idx_library_user_id" ON "library" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_profiles_username" ON "profiles" USING btree ("username");