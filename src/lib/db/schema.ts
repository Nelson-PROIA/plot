import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// v1 schema — MVP_PLAN.md §3. Per-SHA snapshots, no temporal graph.

export const repos = pgTable(
  "repos",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    defaultBranch: text("default_branch").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("repos_owner_name_idx").on(t.owner, t.name)],
);

export const snapshots = pgTable(
  "snapshots",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    repoId: integer("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    commitSha: text("commit_sha").notNull(),
    indexedAt: timestamp("indexed_at", { withTimezone: true }),
    fileCount: integer("file_count"),
    status: text("status").notNull().default("pending"), // pending | indexing | ready | failed
    /** Set when an indexer claims this snapshot; stale claims are reapable. */
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("snapshots_repo_sha_idx").on(t.repoId, t.commitSha)],
);

export const files = pgTable(
  "files",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    snapshotId: integer("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    lang: text("lang"),
    size: integer("size"),
    hash: text("hash"),
  },
  (t) => [uniqueIndex("files_snapshot_path_idx").on(t.snapshotId, t.path)],
);

export const symbols = pgTable(
  "symbols",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    snapshotId: integer("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    fileId: integer("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(), // function | class | interface | type | const | ...
    startLine: integer("start_line").notNull(),
    endLine: integer("end_line").notNull(),
    signature: text("signature"),
    exported: boolean("exported").notNull().default(false),
    stableKey: text("stable_key").notNull(), // `${path}::${name}` — survives reindexing
  },
  (t) => [
    index("symbols_snapshot_key_idx").on(t.snapshotId, t.stableKey),
    index("symbols_file_idx").on(t.fileId),
  ],
);

// Polymorphic endpoints: exactly one of src_symbol_id/src_file_id set (same for dst).
export const edges = pgTable(
  "edges",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    snapshotId: integer("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    srcSymbolId: integer("src_symbol_id").references(() => symbols.id, {
      onDelete: "cascade",
    }),
    srcFileId: integer("src_file_id").references(() => files.id, {
      onDelete: "cascade",
    }),
    dstSymbolId: integer("dst_symbol_id").references(() => symbols.id, {
      onDelete: "cascade",
    }),
    dstFileId: integer("dst_file_id").references(() => files.id, {
      onDelete: "cascade",
    }),
    kind: text("kind").notNull(), // import | call | contains
  },
  (t) => [
    index("edges_snapshot_kind_idx").on(t.snapshotId, t.kind),
    index("edges_src_symbol_idx").on(t.srcSymbolId),
    index("edges_dst_symbol_idx").on(t.dstSymbolId),
    // Turn malformed-endpoint indexer bugs into insert failures.
    check(
      "edges_src_one_endpoint",
      sql`num_nonnulls(${t.srcSymbolId}, ${t.srcFileId}) = 1`,
    ),
    check(
      "edges_dst_one_endpoint",
      sql`num_nonnulls(${t.dstSymbolId}, ${t.dstFileId}) = 1`,
    ),
  ],
);

export const prs = pgTable(
  "prs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    repoId: integer("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    author: text("author"),
    headSha: text("head_sha").notNull(),
    baseSha: text("base_sha").notNull(),
    state: text("state").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("prs_repo_number_idx").on(t.repoId, t.number)],
);

export const atoms = pgTable(
  "atoms",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    prId: integer("pr_id")
      .notNull()
      .references(() => prs.id, { onDelete: "cascade" }),
    headSha: text("head_sha").notNull(),
    idxOrder: integer("idx_order").notNull(), // reading order within the PR
    title: text("title").notNull(),
    category: text("category").notNull(),
    risk: text("risk").notNull(),
    summary: text("summary"),
    constraints: jsonb("constraints"),
    cues: jsonb("cues"),
    watchOuts: jsonb("watch_outs"),
    files: jsonb("files"),
    hunks: jsonb("hunks"),
    symbolKeys: jsonb("symbol_keys"),
    evidence: jsonb("evidence"),
  },
  (t) => [index("atoms_pr_sha_idx").on(t.prId, t.headSha)],
);

export const atomReviews = pgTable("atom_reviews", {
  atomId: integer("atom_id")
    .primaryKey()
    .references(() => atoms.id, { onDelete: "cascade" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  reviewedAtSha: text("reviewed_at_sha").notNull(),
});

export const chats = pgTable("chats", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  repoId: integer("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  prId: integer("pr_id").references(() => prs.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const messages = pgTable(
  "messages",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    chatId: integer("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // user | assistant
    content: text("content").notNull(),
    claims: jsonb("claims"), // [{text, label: observed|stated|inferred, citations[]}]
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("messages_chat_idx").on(t.chatId)],
);

export const events = pgTable("events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  kind: text("kind").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
