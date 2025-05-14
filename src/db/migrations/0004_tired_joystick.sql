CREATE TABLE "content_source" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"base_url" text,
	"api_endpoint" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "content_source_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "enrichment_interaction" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"enrichment_id" bigint NOT NULL,
	"interaction_type" varchar(50) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrichment_interaction_user_id_enrichment_id_interaction_type_pk" PRIMARY KEY("user_id","enrichment_id","interaction_type")
);
--> statement-breakpoint
CREATE TABLE "enrichment_tag" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"category" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrichment_tag_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "enrichment_to_tag" (
	"enrichment_id" bigint NOT NULL,
	"tag_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrichment_to_tag_enrichment_id_tag_id_pk" PRIMARY KEY("enrichment_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "game_enrichment" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"game_id" bigint NOT NULL,
	"source_id" bigint NOT NULL,
	"content_type" varchar(50) NOT NULL,
	"title" text,
	"description" text,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"author_name" text,
	"author_url" text,
	"published_at" timestamp with time zone,
	"metadata" jsonb,
	"embedding" vector(1536),
	"relevance_score" integer,
	"is_verified" boolean DEFAULT false,
	"is_featured" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "has_completed_onboarding" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "enrichment_interaction" ADD CONSTRAINT "enrichment_interaction_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_interaction" ADD CONSTRAINT "enrichment_interaction_enrichment_id_game_enrichment_id_fk" FOREIGN KEY ("enrichment_id") REFERENCES "public"."game_enrichment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_to_tag" ADD CONSTRAINT "enrichment_to_tag_enrichment_id_game_enrichment_id_fk" FOREIGN KEY ("enrichment_id") REFERENCES "public"."game_enrichment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_to_tag" ADD CONSTRAINT "enrichment_to_tag_tag_id_enrichment_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."enrichment_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_enrichment" ADD CONSTRAINT "game_enrichment_game_id_external_source_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."external_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_enrichment" ADD CONSTRAINT "game_enrichment_source_id_content_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_enrichment" ADD CONSTRAINT "game_enrichment_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_content_source_name" ON "content_source" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_enrichment_interaction_user_id" ON "enrichment_interaction" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_enrichment_interaction_enrichment_id" ON "enrichment_interaction" USING btree ("enrichment_id");--> statement-breakpoint
CREATE INDEX "idx_enrichment_interaction_type" ON "enrichment_interaction" USING btree ("interaction_type");--> statement-breakpoint
CREATE INDEX "idx_enrichment_tag_name" ON "enrichment_tag" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_enrichment_tag_category" ON "enrichment_tag" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_enrichment_to_tag_enrichment_id" ON "enrichment_to_tag" USING btree ("enrichment_id");--> statement-breakpoint
CREATE INDEX "idx_enrichment_to_tag_tag_id" ON "enrichment_to_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_game_enrichment_game_id" ON "game_enrichment" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_enrichment_source_id" ON "game_enrichment" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_game_enrichment_content_type" ON "game_enrichment" USING btree ("content_type");--> statement-breakpoint
CREATE INDEX "idx_game_enrichment_relevance_score" ON "game_enrichment" USING btree ("relevance_score");--> statement-breakpoint
CREATE INDEX "idx_game_enrichment_published_at" ON "game_enrichment" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_game_enrichment_game_content_type" ON "game_enrichment" USING btree ("game_id","content_type");