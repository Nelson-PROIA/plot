# Daphne MVP — Plan of Action

> The execution doc. Open it at the start of every coding session, pick the next
> unchecked tasks, check them off when the milestone's demo passes. Product
> vision lives in Notion ("Nelson | Product Vision", authoritative); this file
> only says how we build it. Updated as we go.

Status: **M0 + M1 done (2026-06-07) · next: M2 (Brain) / M3 (Atomizer), parallelizable** · `main` deployed at plot-orpin.vercel.app · DB: Neon `neon-pink-window` (Vercel marketplace)

---

## 1. What we are building (MVP definition)

One sentence: **onboard a single GitHub repo, get a living knowledge base, open
a PR, and review it as change atoms placed on the system graph, with every
explanation cited from the actual code.**

The MVP is done when the demo script in §8 runs end to end on the deployed app,
on a real repository, without faking anything.

Core loop the MVP must nail:

1. Connect repo → Daphne indexes it (real parsing, persisted KB)
2. Open a PR → Daphne decomposes it into **change atoms** (the smallest changes
   with independent meaning), ordered for reading
3. The review opens on the **system graph** (founder decision: graph is the
   default), atoms pinned on the map, reading path drawn through them, zoomed
   on atom 1. Classic linear view is one key away, same state.
4. Per atom, the **Context Inspector** shows: what changed, constraints, review
   cues, watch-outs, scope, evidence. The raw diff is right there (Workbench).
5. The **Repository Brain** answers questions with clickable citations and
   labeled claims (observed / author-stated / inferred).
6. Reviewer approves **atom by atom**; all atoms reviewed → approve the PR on
   GitHub. On a PR update, only what changed since last visit needs re-review.

## 2. Scope: in / out

**IN (MVP):** single repo · GitHub only · TS/JS parsing first · one user (the
existing token model, no accounts) · atoms + lane + inspector + workbench +
graph-default + classic toggle · cited brain with claim labels · per-atom
review state + delta-since-last-visit · manual reindex + reindex-on-PR-open.

**OUT (explicitly, do not build):** multi-repo · GitLab/Bitbucket · adaptive
reviewer modes · Agent Command Center / autonomous agents · evidence-strength
grading (labels only, no scoring) · Graphiti / temporal knowledge graph
(per-SHA snapshots are enough) · Qdrant (pgvector at most) · SCIP
(tree-sitter only) · comment threads / team features · webhooks live sync
(manual refresh is fine) · mobile · local/VPC packaging.

When tempted to add something, reread this list.

## 3. Architecture target

```
GitHub (existing /api/gh proxy + tarball download)
   │
   ▼
INDEXER  (web-tree-sitter WASM: ts/tsx/js/jsx)         ← M1
   files, symbols, import edges, call edges, per-SHA snapshots
   │
   ▼
KB STORE (Postgres: Neon via Vercel marketplace, drizzle ORM)
   │                │                  │
   ▼                ▼                  ▼
BRAIN (M2)      ATOMIZER (M3)      GRAPH API (M1)
chat w/ tools   LLM over diff+KB   feeds the canvas
cited answers   → atoms persisted  (existing UI kept alive)
   │                │
   └────────┬───────┘
            ▼
REVIEW SURFACE (M4)
Header · Semantic Lane · Graph-default canvas with atom pins + reading path
· Context Inspector · Workbench · classic linear toggle · per-atom approve
```

### Tech decisions (MVP-pragmatic; the Notion tech doc is the later target)

| Decision | MVP choice | Later (not now) |
|---|---|---|
| Parsing | web-tree-sitter (WASM grammars, runs in Node route handlers) | SCIP cross-refs, more languages |
| Store | Postgres (Neon) + drizzle migrations | Qdrant, Graphiti |
| Retrieval | pg full-text + trigram on symbols/files; pgvector only if needed | hybrid dense retrieval, reranker |
| LLM | OpenAI (already wired: key, streaming, JSON mode); gpt-4o-mini default, bigger model for atomizer if quality demands | provider abstraction, Claude |
| Repo fetch | GitHub tarball endpoint through the existing proxy (no git binary) | git clone, incremental fetch |
| Jobs | route handlers + chunked processing (Fluid, 300s) with progress polling | real queue |
| Telemetry | simple events table (view switches, citation clicks) | product analytics |

### Database schema sketch (drizzle, v1)

```
repos        (id, owner, name, default_branch, created_at)
snapshots    (id, repo_id, commit_sha, indexed_at, file_count, status)
files        (id, snapshot_id, path, lang, size, hash)
symbols      (id, snapshot_id, file_id, name, kind, start_line, end_line,
              signature, exported)            -- stable_key = path::name
edges        (id, snapshot_id, src_symbol_id|src_file_id, dst_..., kind)
              -- kind: import | call | contains
prs          (id, repo_id, number, title, body, author, head_sha, base_sha,
              state, fetched_at)
atoms        (id, pr_id, head_sha, idx_order, title, category, risk,
              summary, constraints jsonb, cues jsonb, watch_outs jsonb,
              files jsonb, hunks jsonb, symbol_keys jsonb, evidence jsonb)
atom_reviews (atom_id, reviewed_at, reviewed_at_sha)
chats        (id, repo_id, pr_id?, created_at)  + messages (role, content,
              claims jsonb)   -- claims: [{text, label, citations[]}]
events       (id, kind, payload jsonb, created_at)
```

### API route map (target)

```
POST /api/kb/index            start/refresh indexing  (repo, ref) → job id
GET  /api/kb/status           indexing progress
GET  /api/kb/graph            graph payload (compat with current canvas shape)
GET  /api/kb/symbol/[key]     symbol detail + callers/callees + source slice
POST /api/brain/chat          streaming chat; returns claim blocks w/ citations
POST /api/pr/[n]/ingest       fetch PR, diff, persist
POST /api/pr/[n]/atomize      run atomizer → atoms
GET  /api/pr/[n]/atoms        atoms + review state
POST /api/atoms/[id]/review   mark reviewed (at head sha)
POST /api/events              telemetry
(existing /api/gh/* proxy unchanged)
```

## 4. What happens to the current code

| Current asset | Action |
|---|---|
| `lib/repo-graph/*` (regex extraction, imports resolver) | **Replace internals** with tree-sitter indexer; keep the alias resolver logic (port it); keep graph payload shape during M1 so the canvas keeps working |
| `/api/repo/graph`, `/api/repo/signatures`, `/api/repo/sources` | Superseded by `/api/kb/*` in M1; delete after the canvas is switched over |
| `RepoGraphView` (4-level canvas, granularity ladder, multi-PR overlay) | **Keep**, becomes the base of the M4 review canvas + the repo-exploration view; gets atom pins + reading path |
| `FunctionTracePanel` (animated data flow) | Keep as-is for now; M6 grounds it in KB edges |
| `Assistant` | **Gut and rebuild** in M2 as the cited Brain (same FAB/UX shell) |
| `PRDetailPanel`, per-PR canvas (`/pr/[n]`, nodes, tour) | Content migrates into Inspector (M4); old page stays reachable until M4 ships, then delete |
| `AuditPanel`, `ApproveMerge`, GitHub proxy, Onboarding, presentation mode | Keep (ApproveMerge gets gated by all-atoms-reviewed in M4) |
| `/api/ai/canvas`, `/api/ai/function-trace`, `/api/ai/explain-file` | Keep until their consumers migrate; the atomizer is new code, not built on these |
| Mock mode | Keep minimally working for offline demo fallback; do not invest |

## 5. Milestones

Estimates are working sessions (one focused Claude Code session ≈ half a day).

### M0 — Foundation (0.5 session) — ✅ done 2026-06-07
Goal: clean base to build on.
- [x] Merge `unified-graph` → `main`, deploy, tag `v0-prototype`
- [x] Provision Neon Postgres (Vercel marketplace), env vars local + prod
      (resource `neon-pink-window`; `DATABASE_URL` in dev/preview/prod)
- [x] Add drizzle + first migration with the §3 schema
      (`drizzle/0000_*.sql` applied; `pnpm db:generate` / `db:migrate`;
      `/api/db/health` proves connectivity from the deployed app)
- [x] Decide and pin the demo repos: **Plot itself + `colinhacks/zod`**
      (zod: 401 TS files, layered v4 core←classic/mini import graph, real
      5–9-file PRs — e.g. #5926 circular-import refactor, #5929 preprocess
      optionality. Scope indexing to `packages/zod`, filter tests. Runner-up
      if zod disappoints: `excalidraw/excalidraw`)
- [x] **Spike (go/no-go): GO** — `/api/spike/parse` parses TS with
      web-tree-sitter 0.26 on Vercel (iad1): init 42ms + grammar 26ms +
      parse 7ms. No local-indexing fallback needed. Hard-won details for M1:
      grammars from `@vscode/tree-sitter-wasm` (`tree-sitter-wasms` ships
      legacy-dylink wasm, incompatible); `serverExternalPackages:
      ["web-tree-sitter"]` + `outputFileTracingIncludes` ships the .wasm;
      load grammar bytes from `process.cwd()/node_modules/...` (createRequire
      subpath resolution fails under the package's exports map)

**Demoable:** nothing new; green build on main with DB connected. ✅

### M1 — Real knowledge base (2–3 sessions) — ✅ done 2026-06-07 (merged `m1-kb`)
Goal: replace regex with truth; persist it; lift the caps.
- [x] Tarball fetch of a repo at a ref through the proxy
      (one authed request via `lib/kb/github.ts`; hono's 268 files in ~4s)
- [x] Tree-sitter parse: files, exported + top-level symbols (name, kind,
      line span, signature), import statements (`lib/kb/parse.ts`; real
      `exported` flags, end lines, namespace + JSX call refs)
- [x] Resolve imports (port the existing tsconfig-alias resolver onto AST
      output), build file→file and symbol→symbol edges (real call expressions,
      not regex word-matching). Resolver gained ESM `.js→.ts` specifier
      remapping (zod imports `./x.js` for `./x.ts`: 0→378 edges).
      Known gap: `export * from` barrels aren't chased to the declaring file
      (valibot-style codebases get few call edges; old code had the same
      blindness) — revisit with M2 retrieval quality.
- [x] Persist as a snapshot keyed by commit SHA; stable symbol keys `path::name`
      (claim-based concurrency: single-statement CAS on `snapshots.claimed_at`,
      stale claims reapable after 10min; racing indexers get `indexing` + poll)
- [x] Incremental: reindex only files whose hash changed between snapshots
      (adjacent-commit test: 79/84 files copied, 4 parsed; same-SHA: reused 1.5s)
- [x] `/api/kb/graph` serving the existing canvas payload shape; switch the
      canvas to it; delete the old `/api/repo/*` routes (graph route deleted;
      `signatures`/`sources` deliberately kept — file-expand + code level still
      consume them; migrate + delete in a follow-up)
- [x] Raise limits: target ≤3k files, chunked indexing with progress endpoint
      (3k cap, batched writes, `/api/kb/status` files-as-progress; envelope
      proven: vitest 1442 files/3953 symbols in 15s — a full 3k repo fits one
      300s invocation with 10x margin, so chunk-resume machinery is not needed
      at this cap; revisit only if the cap is ever raised)
- [x] Onboarding shows real indexing progress (not a spinner)
      (progress bar + n/m counter in the canvas loading state, fed by status
      polling — the only loading path; status transitions verified live)

**Demoable:** onboard Plot + the OSS repo; graph view runs off Postgres; a
stats line proves it (files/symbols/edges/snapshot SHA). Re-running ingest on
an unchanged repo is near-instant. ✅ verified on prod 2026-06-07: Plot
85f/446s/168i/211c @6d50b7d, zod 124f/1954s/378i/727c full pipeline in 3.6s,
same-SHA re-ingest 0.47s ("reused").

### M2 — Repository Brain with citations (2 sessions)
Goal: the credibility mechanism, working.
- [ ] Retrieval: pg FTS + trigram over symbol names, signatures, file paths;
      `get_file_slice` for source windows
- [ ] Tool-calling chat loop (server): `search_kb`, `get_symbol`,
      `list_callers`, `list_callees`, `get_file_slice`, `get_pr_context`
- [ ] Response contract: streamed blocks of claims, each
      `{text, label: observed|stated|inferred, citations: [{path, lines, symbolKey}]}`
- [ ] UI: rebuild Assistant content rendering: label chips on claims,
      citations as clickable pills that navigate (graph focus / workbench
      scroll); keep the FAB shell
- [ ] PR-aware mode: when opened from a PR, PR title/body/diff summary are in
      context and "stated by the author" becomes a real label source
- [ ] Hard rule enforced server-side: a claim with no citation can only be
      labeled `inferred`

**Demoable:** on our repo, ask the 5 canned questions ("what does X do",
"what depends on Y", "where do I start reviewing this PR", "what would break
if Z changes", "explain this module") and click every citation to land on the
code. No uncited `observed` claims anywhere.

### M3 — Change atoms (2–3 sessions)
Goal: the core primitive, trustworthy and persistent.
- [ ] PR ingestion: files, patches, base/head SHA → persisted (`prs` table)
- [ ] Atomizer v1: LLM pass over (diff + KB context for touched symbols:
      callers, callees, tests nearby) → atoms with: behavioral title
      ("session refresh now validates expiry", never "validator.ts changed"),
      category, risk, ordered reading sequence, files + hunk ranges,
      symbol keys, constraints, review cues, watch-outs (each with an
      evidence pointer), evidence links
- [ ] Traceability invariant: every atom maps to concrete hunks; every hunk
      of the PR belongs to exactly one atom (leftovers go to a "chore" atom)
- [ ] Re-atomize on head change with state carry-over (match atoms by
      title/file overlap; carried atoms keep review state, changed ones reset)
- [ ] Per-atom review state: mark reviewed at SHA; delta-since-last-visit =
      atoms new or changed since your last reviewed SHA
- [ ] **Quality gate:** golden set of 5 real PRs (mix: feature, fix, refactor,
      AI-generated slop, mixed-concern). Manually score atom titles, grouping,
      cue usefulness. Iterate the prompt until 4/5 feel right. This gate
      decides if M4 starts.

**Demoable:** `GET /api/pr/[n]/atoms` on a real PR returns atoms you would
actually review by; a crude list UI shows them with their hunks.

### M4 — The review surface (3 sessions)
Goal: the product. Graph-default review, lane, inspector, workbench, approve.
- [ ] New review layout at `/review/[pr]` (replaces `/pr/[n]` when done):
      Header (boring: repo, PR identity, progress "3/7 atoms", approve button)
- [ ] **Semantic Lane**: one chip per atom (`02 Session flow · Logic · 4 files`
      + state ring), keyboard navigation, orderings: story (default) and risk
- [ ] **Graph as default view**: the system map (existing canvas) with atom
      pins placed at the centroid of their touched files/symbols, the reading
      path drawn as numbered edges atom→atom, non-involved nodes dimmed.
      Opens zoomed on atom 1. Guardrails implemented: never opens on the
      whole-repo hairball; `v` toggles classic view; selection state shared
      between both views
- [ ] **Classic view**: linear atom list with inline diffs, same components
- [ ] **Context Inspector** (right panel, per selected atom): what changed /
      why it matters → constraints → review cues (checkboxes; all checked or
      dismissed gates "mark reviewed") → watch-outs with evidence links →
      compact scope (files, deps, +/-) → evidence/actions (open in workbench,
      ask the Brain pre-filled)
- [ ] **Workbench** (center bottom or modal): the atom's hunks rendered as a
      real diff, with KB context links (callers, tests) alongside
- [ ] Approve flow: all atoms reviewed → PR approve button arms (existing
      ApproveMerge); partial state persists across visits; PR updated banner
      shows "2 atoms changed since your review"
- [ ] Telemetry events: view switches (graph↔classic), citation clicks,
      cue interactions. One `/api/events` sink, one tiny stats page
- [ ] Brain FAB available in review, PR-aware

**Demoable:** full review of a real PR end to end: open → land on atom 1 on
the map → walk the path → check cues → approve atoms → approve PR → push a
new commit → see the delta. Switch to classic and back without losing state.

### M5 — Hardening + demo readiness (1–2 sessions)
Goal: it does not embarrass us in front of a stranger.
- [ ] Onboarding polish: repo URL → progress → lands on the graph
- [ ] Error/empty states: indexing failure, atomizer failure (fallback:
      file-group atoms so review never blocks), rate limits, big-repo refusal
      with a clear message
- [ ] Perf pass: lane/inspector interactions instant; graph stable at demo
      repo size; ingest progress honest
- [ ] Demo seed: pick the demo PRs (2 prepared on the demo repo: one feature
      with mixed concerns, one AI-generated PR), verify atom quality on them
- [ ] Record a backup demo video; deploy prod; run the §8 script twice
- [ ] Check telemetry actually recorded during the rehearsal

**Demoable:** the §8 script, twice in a row, no incidents.

### M6 — Stretch (post-MVP backlog, do not start before M5 ships)
- Data-flow animation grounded in real KB edges (inspector evidence action)
- Audit rollup across PRs fed by atom risk
- Co-change evidence tier (git history mining) in watch-outs
- Webhook sync (replace manual refresh)
- Adaptive views (junior/senior/QA/security)
- Investigation drawer lenses beyond the graph
- Local/VPC story

## 6. Sequencing and dependencies

```
M0 → M1 → M2 ─┐
         └────┴→ M3 → M4 → M5
```
M2 and M3 both depend on M1 only; if two people/sessions run in parallel,
Brain (M2) and Atomizer (M3) can be built side by side. M4 needs both.

## 7. Risks while building

| Risk | Mitigation |
|---|---|
| Atomizer quality is the product (biggest unknown) | Golden-PR gate at M3 before any UI investment; fallback file-group atoms keeps the surface usable |
| tree-sitter WASM on Vercel misbehaves | M0 spike decides; fallback local indexing script posting to the API |
| Graph-with-atoms is illegible on real repos | Guardrails are tasks, not ideas (zoom on atom 1, dimming, classic toggle); telemetry tells us the truth; founder pre-committed to flip default if users flee |
| Indexing time/cost on real repos | 3k-file cap, chunking, per-SHA caching, changed-files-only incremental |
| Token costs | mini model everywhere except atomizer; atomize once per head SHA, cached |
| Scope creep toward the Notion's full design | §2 OUT list is the contract; M6 is where temptations go |

## 8. The demo script (the MVP's definition of done)

3–4 minutes, on the deployed app, real repo, no mocks:

1. *"This is Daphne. You ship code you didn't write and approve changes you
   don't fully understand. Daphne gives you back understanding of the system,
   starting with every PR."*
2. Paste repo URL → indexing progress → **the system graph appears**. 10 sec
   tour: groups, edges, "this is the live map of the codebase, built from the
   AST, stored, updated per commit."
3. Open the demo PR → **lands zoomed on atom 1, on the map**, reading path
   visible. *"Daphne broke this PR into 6 changes that mean something. Not
   files. We review in this order."*
4. Walk atoms 1→2: inspector shows constraints, cues, watch-outs. Check the
   cues, mark reviewed. *"Every claim here links to the code that proves it"*
   → click a citation, land on the code.
5. Ask the Brain: *"what breaks if this function changes?"* → cited, labeled
   answer. Click the citation.
6. Press `v`: classic linear view, same state. *"If you hate maps, fine."*
   Press `v` back.
7. Approve remaining atoms → approve PR on GitHub, live.
8. *"Push a new commit to the PR"* (prepared) → refresh → *"only this atom
   changed since my review."* Close: *"Understanding, atom by atom, with
   proof. That's Daphne."*

## 9. Working agreements (how sessions run)

- Start of session: open this file, pick the current milestone's next
  unchecked tasks. End of session: check boxes, add a one-line log below,
  deploy if green.
- A milestone is done when its **Demoable** line works on the deployed app,
  not when the code merges.
- No starting M(n+1) before M(n)'s demoable passes (exception: M2/M3 parallel).
- Vision questions go to the Notion doc, not this file. If a build decision
  contradicts the vision, stop and flag it instead of silently deciding.
- Keep `main` deployable; feature branches per milestone (`m1-kb`,
  `m2-brain`, ...).

## 10. Session log

| Date | Session | Done |
|---|---|---|
| 2026-06-07 | M0 | Merged `unified-graph`→`main`, tagged `v0-prototype`; Neon provisioned + drizzle v1 schema migrated; demo repos pinned (Plot + zod); tree-sitter-on-Vercel spike = **GO** (75ms, `@vscode/tree-sitter-wasm` grammars). |
| 2026-06-07 | M1 (1/2) | KB indexer on `m1-kb`: tarball→AST→Postgres snapshots, incremental hash-diff, `/api/kb/{index,status,graph}`, canvas switched to KB + progress UI + snapshot SHA; `/api/repo/graph` + spike deleted. Review: 2 races found+fixed (claim CAS). Verified on Vercel preview: Plot 85f/446s/168i/211c, zod 124f/1954s/378i/727c. Left: chunk-resume (M1.7), onboarding visual pass (M1.8), merge. |
| 2026-06-07 | M1 (2/2) | Envelope test vitest 1442f/15s → M1.7 closed without chunk-resume; merged `m1-kb`→`main`, prod deployed; demoable verified on prod (zod pipeline 3.6s, re-ingest 0.47s). **M1 done.** Known gaps parked: barrel re-export chasing (M2), monorepo group clustering (M5 demo polish), GITHUB_TOKEN missing in Vercel *Preview* env (user one-liner). |
