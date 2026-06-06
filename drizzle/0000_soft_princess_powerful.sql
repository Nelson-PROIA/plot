CREATE TABLE "atom_reviews" (
	"atom_id" integer PRIMARY KEY NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at_sha" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "atoms" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "atoms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"pr_id" integer NOT NULL,
	"head_sha" text NOT NULL,
	"idx_order" integer NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"risk" text NOT NULL,
	"summary" text,
	"constraints" jsonb,
	"cues" jsonb,
	"watch_outs" jsonb,
	"files" jsonb,
	"hunks" jsonb,
	"symbol_keys" jsonb,
	"evidence" jsonb
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chats_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"repo_id" integer NOT NULL,
	"pr_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edges" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "edges_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"snapshot_id" integer NOT NULL,
	"src_symbol_id" integer,
	"src_file_id" integer,
	"dst_symbol_id" integer,
	"dst_file_id" integer,
	"kind" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "files_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"snapshot_id" integer NOT NULL,
	"path" text NOT NULL,
	"lang" text,
	"size" integer,
	"hash" text
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"chat_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"claims" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "prs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"repo_id" integer NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"author" text,
	"head_sha" text NOT NULL,
	"base_sha" text NOT NULL,
	"state" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "repos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"default_branch" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"repo_id" integer NOT NULL,
	"commit_sha" text NOT NULL,
	"indexed_at" timestamp with time zone,
	"file_count" integer,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "symbols" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "symbols_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"snapshot_id" integer NOT NULL,
	"file_id" integer NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"start_line" integer NOT NULL,
	"end_line" integer NOT NULL,
	"signature" text,
	"exported" boolean DEFAULT false NOT NULL,
	"stable_key" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "atom_reviews" ADD CONSTRAINT "atom_reviews_atom_id_atoms_id_fk" FOREIGN KEY ("atom_id") REFERENCES "public"."atoms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atoms" ADD CONSTRAINT "atoms_pr_id_prs_id_fk" FOREIGN KEY ("pr_id") REFERENCES "public"."prs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_pr_id_prs_id_fk" FOREIGN KEY ("pr_id") REFERENCES "public"."prs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_src_symbol_id_symbols_id_fk" FOREIGN KEY ("src_symbol_id") REFERENCES "public"."symbols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_src_file_id_files_id_fk" FOREIGN KEY ("src_file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_dst_symbol_id_symbols_id_fk" FOREIGN KEY ("dst_symbol_id") REFERENCES "public"."symbols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_dst_file_id_files_id_fk" FOREIGN KEY ("dst_file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prs" ADD CONSTRAINT "prs_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbols" ADD CONSTRAINT "symbols_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbols" ADD CONSTRAINT "symbols_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "atoms_pr_sha_idx" ON "atoms" USING btree ("pr_id","head_sha");--> statement-breakpoint
CREATE INDEX "edges_snapshot_kind_idx" ON "edges" USING btree ("snapshot_id","kind");--> statement-breakpoint
CREATE INDEX "edges_src_symbol_idx" ON "edges" USING btree ("src_symbol_id");--> statement-breakpoint
CREATE INDEX "edges_dst_symbol_idx" ON "edges" USING btree ("dst_symbol_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_snapshot_path_idx" ON "files" USING btree ("snapshot_id","path");--> statement-breakpoint
CREATE INDEX "messages_chat_idx" ON "messages" USING btree ("chat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prs_repo_number_idx" ON "prs" USING btree ("repo_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "repos_owner_name_idx" ON "repos" USING btree ("owner","name");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_repo_sha_idx" ON "snapshots" USING btree ("repo_id","commit_sha");--> statement-breakpoint
CREATE INDEX "symbols_snapshot_key_idx" ON "symbols" USING btree ("snapshot_id","stable_key");--> statement-breakpoint
CREATE INDEX "symbols_file_idx" ON "symbols" USING btree ("file_id");