# Daphne — Product Overview & MVP Plan

> Synthesized from the full **⏪ Daphne** Notion (every page, Nelson × Pietro), the
> original Plot hackathon doc, and the verified state of this repo. This is the
> working north star — iterate here.
>
> Naming: the north-star docs call the product **Daphne**. This repo ("Plot") is
> the current prototype. The Figma "Daphne – PR Review" holds the UI direction
> (not yet mirrored here — export frames into `docs/design/` when possible).

---

## 1. Thesis

> **The strategic opportunity is not "AI code review", but comprehension-first
> code review.**

The problem is not that pull requests lack information — they contain too much of
it, **arranged in the wrong shape**. This is fundamentally a **representation
problem**. Today's PR is a wall of files, diffs, comments, CI checks, screenshots,
tickets, and bot summaries. It shows what changed line by line, but rarely what
the change *means*. The reviewer's real bottleneck is **building the correct
mental model**: what changed, why, how it flows through the system, what might
break.

AI makes this urgent: code is becoming cheap to generate but still expensive to
understand. The bottleneck shifts from writing code to **approving it safely**.
Most AI review tools only add more text to an already overloaded surface — they
don't change the shape of review.

**Core argument:** review should move from *"read every changed file in provider
order"* to *"understand the change graph, then inspect the risky nodes."*

The deeper product, beyond PR review: a **cognitive compression layer for
software systems**.

### The five missing contexts (why diffs fail)

The diff shows the patch; the reviewer has to reconstruct the system. What's
missing:

1. **Behavioral** — what the system does differently after the PR.
2. **Architectural** — where this code sits; whether boundaries are violated.
3. **Dependency** — callers, callees, contracts affected, blast radius.
4. **Historical** — why the old code existed; prior incidents and decisions.
5. **Review** — what's already understood, what remains risky, what to check.

## 2. Theory foundation — Cognitive Load Theory (Sweller)

PR review is a **working-memory problem**. The design target is reducing
*extraneous* load (navigation, context reconstruction) so reviewers spend
*germane* load (building the right mental model) on judgment.

| CLT concept | PR-review translation | Product design move |
|---|---|---|
| Intrinsic load | Actual complexity of the change | Break into staged review units |
| Extraneous load | UI friction, scattered context, noisy diffs | Integrate context into the review surface |
| Germane load | Building the right mental model | Guided review tour, semantic chunks |
| Element interactivity | Many files/concepts interacting | Group by subgoal and dependency |
| Split attention | Jumping between tabs/tools | Inline architectural context |
| Isolated elements | Too much at once | Intent-first, progressive disclosure |
| Worked example | Author's mental model | Sequenced review path |
| Expertise reversal | Same explanation annoys experts | Adaptive detail level |

Guiding principle: *"Never make the reviewer reconstruct context that the system
can attach directly to the changed artifact."* And: the product doesn't need to
hide complexity — **it needs to sequence it**.

The review experience must answer five questions, fast:
**1. Intent** — what is this PR trying to accomplish? · **2. Structure** — which
semantic parts make up the change? · **3. Flow** — in what order should I inspect
it? · **4. Risk** — where is human attention most needed? · **5. Evidence** —
what code/tests/history supports the assessment?

## 3. Core primitive — Change Atoms (semantic chunks)

The unit of review is not a line, hunk, or file. It is a **semantic change atom**:
the smallest reviewable unit with independent meaning — behavioral, architectural,
or contractual.

Not *"`auth/validator.ts` changed"* but *"session refresh now validates token
expiry before scope resolution."*

Each atom must be **traceable**, expandable into: affected files · functions ·
concepts · purpose · related tests · risk level · owner/domain · links back to the
raw diff. *Bad version: AI summary paragraph. Good version: semantic chunk with
traceability.*

**Trust model (non-negotiable):** visibly separate three layers —

| Layer | Purpose |
|---|---|
| Evidence | raw diff, exact lines, files, tests, traces |
| Structure | semantic chunks, dependencies, ordering |
| Interpretation | AI explanation, likely intent, risk prompts |

Every claim distinguishes **Observed** / **Author-stated** / **Inferred**, with an
**Evidence Strength** marker (diff-only < dependency trace < failing test <
incident < runtime artifact). *"The semantic layer should be an index into
evidence, not a replacement for evidence"* — the raw diff always stays close.

## 4. The product surfaces (target UI architecture)

Six surfaces, from the Design Considerations + envisioned solution:

1. **Workspace Header** — deliberately boring and stable. Global orientation only:
   PR identity, branches, CI state, review progress ("4 chunks · 1 high risk · 2
   unresolved cues · CI failing"), submit action. No intelligence here.
2. **Semantic Lane** — horizontal chips, one per change atom: `02 Session Flow ·
   Logic · 4 files` + visual state (completed/current/pending/blocked/AI-suggested).
   Hover = preview card (~300–500ms delay; "why it matters", scope, suggested next
   action; discovery, not execution). Selecting a chip makes it the **active
   review context** — all surfaces synchronize. The order is **programmable**:
   Semantic Order (story), Risk Order (senior triage), Workflow Order (QA),
   Test-Failure Order (debugging).
3. **Context Inspector** (right panel) — fast comprehension for the selected atom,
   in this order: *What changed / Why it matters* → **Constraints** (what must
   remain true: security, API shape, perf budgets) → **Review Cues** (checklist of
   what to verify; gate "mark reviewed" on completing/dismissing them) → **Watch
   Out For** (failure modes, each evidence-backed) → **Scope** (compact: `3 files ·
   3 deps · +37 −200`, expandable) → **Evidence / Suggested Actions**. Plus sharp
   **Review Questions** derived from the atom ("Is this retry idempotent?").
4. **Workbench** (center) — the real diff for the selected atom, surrounded by
   useful context: related functions, tests, docs, similar existing patterns.
5. **Investigation Drawer** (left, collapsed by default — never required for the
   core loop) — **lenses**: Tests, Runs, Artifacts, Comments, Agents, History
   ("have we seen this before?"), **Architecture** (the structural map: modules,
   boundaries, callers/callees, ownership), Docs & Contracts. Plus user-defined
   custom lenses (e.g. "Android Auth Failures").
6. **Agent Command Center** — talk to the repo. Agents are **context routers, not
   approval machines**: replay, test generation, failure triage, coverage,
   artifact analysis, patch suggestion (approval-gated), bug reports. Includes
   **Claim Audit**: inspect why Daphne believes any claim (source: diff lines,
   dependency graph, test, doc, past PR, inference).

### Repository Brain (the center of gravity)

A conversational layer grounded in the repository: architecture, history, docs,
ownership, current PR. Broad questions ("explain auth in this repo"), PR questions
("what's riskiest? where do I start?"), line questions ("what calls this?").

- **Evidence-grounded, always** — answers cite files, symbols, tests, past PRs.
  No unsupported LLM guesses.
- **Private by default** — reviewers build understanding privately before
  contributing judgment publicly. Raw exploration never auto-publishes; only
  intentional artifacts are shared. (Anti-surveillance is an adoption
  prerequisite: the system must make reviewers effective without making them feel
  observed.)
- **Living memory** — knowledge updates as PRs merge; tracks how architecture,
  concepts, and risks evolve. Docs that maintain themselves.

### Adaptive reviewer modes (expertise reversal)

Same PR, multiple **cognitive projections**: Junior (explanations, patterns,
examples) · Senior (architectural delta, deviations, risk hotspots) · Domain owner
(owned modules, invariants, nearby history) · QA/Product (behavior delta,
screenshots, acceptance criteria) · Security (permissions, exposure, trust
boundaries).

## 5. Core MVP feature set

1. Semantic chunking (change atoms)
2. Guided review tour (worked-example sequencing: behavior → contract → logic →
   boundary effects → evidence → risk leftovers)
3. Integrated context panel (kill split attention)
4. Progressive disclosure (intent view → concept view → risk view → evidence view
   → diff view; *"intent view is a map, not proof"*)
5. Adaptive detail levels
6. Repository Brain
7. Risk & evidence indicators (missing tests, risky migrations, public API
   changes, boundary crossings, large generated sections)

Patterns deliberately stolen from incumbents:
- **Stacked review slices** (Graphite/ReviewStack): a vertical reading order of
  atoms — *"the reviewer gets a reading order."*
- **File × revision matrix** (Reviewable): review is temporal — track reviewed
  state per file/atom per revision.
- **Review delta since last visit** (Gerrit patch sets): on revisit, show only
  what changed since your last review — *"supports real review workflows, not
  just first-time exploration."*
- Change-type triage: mechanical renames collapsed, generated files hidden unless
  suspicious, contract/security changes prominent. **Make the review surface
  proportional to semantic risk.**

## 6. Competitive landscape

| Dimension | Greptile | Graphite |
|---|---|---|
| Core wedge | Independent AI code reviewer | Stacked-PR workflow platform |
| Main pain | "Did this PR introduce bugs?" | "How do we keep review moving?" |
| Primary surface | PR comments / validation | Inbox, PR page, stack, merge queue |
| Weakest area | Human comprehension UX | Deep architecture comprehension |

**"Greptile reviews code. Graphite manages code-review flow."** Daphne's open
space: **make review understandable**. Greptile validates; Graphite organizes the
stack; *Daphne organizes the system change*. The strongest position is beside
them, not head-on: their signals (review comments, stacks, CI) become inputs to
Daphne's comprehension layer.

The distinction in one line: **"AI comments help developers fix issues. AI
comprehension helps reviewers trust decisions."** Even in an autonomous-validation
future, the comprehension/trust layer survives — humans still audit, debug,
override, and decide what to believe.

What stays open (verified in their own positioning): the spatial/architectural
comprehension surface — changed files as nodes, calls/data deps as edges,
ownership & blast-radius overlays, before/after architecture, risky-path
highlighting. Graphite's Code Tours are the closest threat (narrative-first, not
architecture-aware — yet).

Strategic notes from research:
- **The security wedge is real.** CodeRabbit's incident makes "third-party AI with
  full repo access" a procurement blocker. Local / VPC / on-prem deployment is a
  serious enterprise differentiator.
- Graphite's own bet: hybrid AI augmentation + structured changes — humans keep
  architectural oversight. Consistent with Daphne's thesis.
- Even in an autonomous-validation future, the comprehension/trust layer stays
  necessary: humans audit, debug, override, and trust decisions.
- Open question (from `Questions`): niche-first go-to-market? (e.g. banking /
  compliance-heavy software, where understanding+audit trail is mandatory.) Also
  noted: early-stage AI-heavy teams that ship fast and fear invisible tech debt.

### 6.2 Web sweep (2026-06-06) — the field the Notion hadn't spotted

31-agent research sweep (full cited report:
[`docs/research/competitive-sweep-2026-06-06.md`](docs/research/competitive-sweep-2026-06-06.md)).
Headline: **comprehension-first review is no longer blue ocean.** The two
front-of-funnel pillars (change atoms + guided review path) are now a crowded
consensus; defensibility narrows to the trust contract and the temporal KB.

**Direct unspotted competitors (threat-ordered):**

| Who | What | Overlap | What they still lack |
|---|---|---|---|
| **Stage** (YC P26) | "Chapters" = mini-PRs in optimal reading order + citation-backed chat; explicit anti-CodeRabbit positioning | Atoms + path + thin inspector | Whole-repo/temporal KB, architecture lens, named trust model |
| **Devin Review** (Cognition) | Groups + reorders + explains hunks; copy/move detection; Ask Devin chat | Atoms + path + brain | Per-claim evidence citations, structured inspector, architecture lens |
| **cubic.dev** (ex-**mrge.io** — renamed!) | "Cursor for code review": grouping, ordering, diagrams, deep-research chat, downstream-impact tracing | Broadest single-product overlap | Trust model, semantic-intent atoms, temporal KB |
| **Entelligence** ($5M, Jan 2026) | Semantic graph, per-PR architecture/sequence diagrams, evidence chains to past incidents, adversarial verification — *near-verbatim Daphne pitch* | Architecture lens + brain + **evidence pillar** | Change-atom decomposition, human review path, separated Evidence/Structure/Interpretation |
| **Unblocked** (~$30M) | Evidence-grounded, contradiction-reconciling, cited repo brain over code+Slack+Jira; new review product (Feb 2026) | Heaviest Repo-Brain overlap | Code-structure-first "why", evidence-strength spectrum, atoms/path/inspector |
| **Baz** ($8M) | AST "Topics" (rigorous atoms), Change Request Graph, module memory | Atoms + diff-scoped graph + structural layer | Persistent/temporal whole-repo graph, trust model, atom-first UI |

**Known vendors moved onto our turf:** CodeRabbit shipped **Atlas/"Change Stack"**
(May 2026) — PR → ordered "change cohorts" with per-cohort summaries + diagrams,
*the closest production analog to change atoms shipping today*. Graphite shipped
**Code Tours** (Apr 2026). Also: DeepWiki/Google Code Wiki set the free baseline
for cited repo chat; GitHub Copilot code review is default-on distribution.

**Graveyard lessons (visualization-first products):** CodeSee (acqui-hired —
couldn't convert maps to revenue; language-breadth cost), Sourcetrail (archived),
Mutable.ai (acqui-hired → Google Code Wiki), Cosine/Buildt (pivoted to agents),
Pierre (dead — "a beautiful review UI alone did not sustain a business"), and
**Haystack pivoted away from its infinite-canvas review UI** ("too alien") to a
linear walkthrough, then to AI triage. Unanimous lesson: **comprehension must be
bound to the must-do PR workflow; visualization alone is a feature, not a
business.** (Directly validates demoting our canvas to a lens.)

**Hardest thesis challenges (no/partial rebuttal — treat as real risks):**
1. The named tech stack (tree-sitter/SCIP/KG/Graphiti) is fully commoditized —
   the index can never be the moat; only the UX + trust contract + workflow
   coupling can.
2. Copilot's default-on distribution can starve standalone tools regardless of
   quality ("good enough + already there").
3. Benchmarks score comment act-on-rate, not comprehension — Daphne either posts
   a competitive number or defines the comprehension benchmark itself.
4. The market is betting on agents reading code so humans don't; Daphne bets the
   human merge-accountability moment survives. A bet, not a fact.

**White space still genuinely open (post-sweep):**
1. **Evidence-strength / trust-tier contract** — *nothing productized* grades
   claims verified-vs-inferred per claim. Most defensible wedge. Daphne's
   Observed/Stated/Inferred + Evidence Strength is still unclaimed territory.
2. **Atoms as first-class, independently reviewable/approvable units** — everyone
   ships AI summaries *over* a flat diff; re-segmenting the PR itself is open.
   (Floor to match: Devin's copy/move detection, Baz's AST atoms.)
3. **Temporal KG bound to the review moment** — graphs exist diff-scoped or
   static; "the graph updates with the diff under review" is uncontested.
4. **Differentiated evidence tiers** to fold into the Inspector: CodeScene-style
   co-change/hotspot signals, AppMap-style runtime traces, GitDiagram's
   validate-against-file-tree grounding trick.
5. Sourcegraph's enterprise-only pivot leaves a **mid-market/individual gap** for
   evidence-grounded repo intelligence.

Also research validation: arXiv 2512.12117 (Dec 2025) publishes the recipe for
citation-grounded code comprehension (92% citation accuracy, zero hallucinations)
— de-risks our build, but removes secrecy as a moat. CodeMap (arXiv 2504.04553)
gives academic backing for structured comprehension over chat.

## 7. MVP roadmap — Repository Brain first

From the Daphne roadmap, the first milestone is **not** the canvas and **not**
chunking:

> **Milestone:** Connect one repository, index it, open one PR, and answer
> *"What is this PR doing, where should I start, and what is risky?"* with links
> to actual code evidence.

Build order (Daphne `IV – MVP Roadmap`), annotated with where this repo stands:

| # | Step | Status in this repo |
|---|---|---|
| 1 | GitHub repo connection | ✅ onboarding + server-side token proxy |
| 2 | Repository ingestion | 🟡 exists, regex-based, ≤250 files |
| 3 | File/symbol/dependency indexing | 🟡 files+symbols+imports+call edges (heuristic, not semantic) |
| 4 | PR diff ingestion | 🟡 PR files fetched; no per-hunk semantic model |
| 5 | Evidence-grounded chat | 🟡 assistant exists; answers not evidence-linked |
| 6 | PR-aware answers | 🟡 PR context injected; no citations |
| 7 | Risk and test detection | 🟡 AI risk cards; no test-coverage linkage |
| 8 | Semantic chunks | ❌ core gap |
| 9 | Review path | 🟡 per-PR tour exists; not chunk-based, not adaptive |
| 10 | Standalone review interface | 🟡 canvas-first today; lane+inspector model not built |

### Technical direction (Daphne `V – Technical`)

Target stack for the real Repository Brain — replacing today's regex pipeline:

- **Extraction:** Tree-sitter (AST, incremental) · SCIP (cross-file symbol
  refs) · ripgrep (exact search) · Semgrep/ast-grep (pattern rules)
- **Index:** Postgres (source of truth) · Qdrant (hybrid dense/sparse retrieval) ·
  Tantivy/OpenSearch (BM25) · **Graphiti** (temporal knowledge graph — living
  memory as PRs merge)
- **Concept layer:** LLM extraction → domain concepts, module responsibilities,
  boundaries, data flows, invariants, ownership, risky zones — each with evidence
  links. This is the missing piece between "code search" and "repo brain".
- **Agent layer:** MCP server exposing repo tools · LangGraph loops · DSPy later
- **Models:** Claude/GPT-class reasoning · Voyage/OpenAI code embeddings ·
  reranker

## 8. Gap analysis — what we have vs what Daphne proposes

Framing: **what's built here was the raw hackathon idea; Daphne is the target
product** (aggregated research + deep thinking). This section is the concrete
diff. Current build = branch `unified-graph`, deployed at plot-orpin.vercel.app.

### 8.1 Pillar-by-pillar matrix

| # | Daphne proposes | What we have today | Verdict |
|---|---|---|---|
| 1 | **Change atoms** — PR decomposed into semantic units ("session refresh now validates token expiry…") with files/deps/tests/risk/evidence each | Nothing chunk-based. Nearest: per-PR canvas nodes (intent/risk/diff cards) and file-level PR tinting — both file/PR-grained, not behavior-grained | ❌ **Missing — the core gap** |
| 2 | **Workspace Header** — stable orientation: PR identity, CI state, review progress ("4 chunks · 1 high risk"), submit review | Thin headers: repo name + file/symbol counts on `/`; PR title + approve/merge on `/pr/[n]`. No CI, no progress, no review state | 🟡 Partial (cosmetic only) |
| 3 | **Semantic Lane** — horizontal atom chips, programmable order (semantic/risk/workflow/test-failure), per-chip review state, hover preview cards | Nothing. The granularity pill switches abstraction levels (not a review path); the `/pr` tour sequences canvas nodes but isn't atom-based, has no state, no alternate orderings | ❌ Missing |
| 4 | **Context Inspector** — per-atom: summary → **Constraints** → **Review Cues** (gating "mark reviewed") → **Watch Out For** (evidence-backed) → compact Scope → Evidence/Actions; Observed/Author-stated/Inferred separation; Evidence Strength chips | `PRDetailPanel`: AI intent summary, risk cards, touched-file list, Ask-Plot button. No constraints, no cues, no watch-outs-with-evidence, no fact/inference separation, no review gating | 🟡 Partial (a skeleton, ~2 of 7 sections) |
| 5 | **Workbench** — the selected atom's diff surrounded by related functions, tests, docs, similar patterns | `DiffViewer` inside the `/pr` diff node (whole-PR unified diffs); code-level cards show symbol bodies. No per-atom view, no surrounding-context injection | 🟡 Partial |
| 6 | **Investigation Drawer** — 8 lenses: Tests, Runs, Artifacts, Comments, Agents, History, **Architecture**, Docs & Contracts (+ custom lenses) | Exactly **one** lens exists — Architecture (the unified graph) — and it's currently the *home screen*, not a lens. Zero of the other seven | 🟡 1/8, inverted placement |
| 7 | **Repository Brain** — evidence-grounded chat; every answer cites files/symbols/tests/PRs you can click; private-by-default vs shared artifacts; living memory updated on merge | `Assistant`: scope-aware chat (repo tree / PR meta / node context injected) — but answers are uncited prose; no clickable evidence, no private/shared model, no persistence, no learning on merge | 🟡 Partial (chat exists, trust layer doesn't) |
| 8 | **Agent Command Center** — bounded agents (replay, test-gen, triage, coverage, artifact analysis, patch suggestion) with lifecycle view + **Claim Audit** | None. Nearest: FunctionTracePanel (one-shot AI data-flow trace) | ❌ Missing |
| 9 | **KB/indexing** — Tree-sitter AST + SCIP cross-refs; Postgres + Qdrant + BM25; **Graphiti temporal graph** (living memory); concept layer (domains, boundaries, invariants, ownership) | Regex extraction (exports + import-resolution + heuristic call edges), ≤250 files, ≤80 parsed; CDN+localStorage caches, nothing persisted; no concepts, no ownership, no history | 🟡 Toy version (~roadmap step 3 of 10, heuristically) |
| 10 | **Trust model** — visibly separate Evidence / Structure / Interpretation; Observed vs Author-stated vs Inferred; AI = context router | AI enrichment renders inferred intent/risks *as if factual*; no claim links to evidence | 🔴 **Conflicts** with the north star — current UX does what the docs warn against |
| 11 | **Adaptive reviewer modes** — junior/senior/domain-owner/QA/security projections of the same PR | None (one fixed view for everyone) | ❌ Missing |
| 12 | **Review progress & deltas** — per-atom reviewed state, "delta since last visit" (Gerrit patch-set model), file × revision matrix | None — no reviewed-state anywhere, every visit re-shows everything | ❌ Missing |

### 8.2 What we have that the Notion doesn't (assets beyond the doc)

Things built here that Daphne's pages don't specify — candidate differentiators
to fold in (or consciously park), not silently lose:

- **Granularity ladder** (system→file→symbol→code on scroll) — a working
  abstraction instrument; Daphne's Architecture lens as described is static.
- **Animated data-flow traces** (payload packets walking caller→fn→callee, with
  drill-down + breadcrumbs) — concrete candidate for the Inspector's "inspect
  dependency trace" action and the Workbench evidence panel.
- **Multi-PR overlay** with union highlighting + dim/isolate toggle — proto
  blast-radius visualization; Daphne mentions blast radius but specifies no UI.
- **Live preview embed** per PR (deployment iframe) — maps to QA/Product mode
  evidence; not in the Notion.
- **Cross-PR risk Audit panel** — repo-wide risk rollup; Notion is single-PR scoped.
- **Approve & merge from the tool**, presentation mode, guided tour engine,
  mock/demo mode — workflow conveniences the docs don't cover.

**The honest tension:** the Daphne docs explicitly critique freeform-canvas-first
review — *"Represent the PR as a vertical stack of review slices, not a freeform
graph… the reviewer gets a reading order"*; *"less visually exciting than a
canvas, but much more useful."* The winning UX is **chunk-first, evidence-backed,
graph-aware, progressively disclosed** — the graph is a lens, not the home.

### 8.3 Disposition of current assets

| Current asset | Daphne disposition |
|---|---|
| Unified repo graph (4 levels) | **Reshape** → the **Architecture lens** + the visual half of the repo KB. Keeps its value for orientation/onboarding; stops being the primary review surface. |
| Granularity ladder (scroll) | **Keep** inside the Architecture lens — it's the "multiple levels of abstraction" instrument. |
| PR overlay + dim/isolate | **Keep** → becomes blast-radius/impact visualization per change atom. |
| Function trace (animated data flow) | **Keep** → evidence artifact reachable from atoms/cues ("inspect dependency trace"). Ground it in real KB edges; AI annotates payloads. |
| Per-PR canvas (intent/risks/alternatives) | **Reshape** → content migrates into Context Inspector sections (intent → summary+Observed/Stated/Inferred; risks → Watch Out For; alternatives → educational context). Tour → chunk-based guided review path. |
| Assistant | **Reshape** → Repository Brain: evidence-linked citations, private-by-default, atom-aware context. |
| Audit panel | **Keep** → cross-PR risk view fed by atom-level risk data. |
| Knowledge-graph ingestion | **Replace internals** (regex → Tree-sitter/SCIP), keep stable-ID schema and API shape. |
| GitHub proxy / token model | **Keep** as-is. |

Nothing is deleted; surfaces are re-homed. (Principle: never lose features —
reorganize them.)

**Bottom line:** the hackathon build ≈ the Architecture lens + a proto-Inspector
+ a proto-Brain — roughly the *orientation* fifth of Daphne's surface area. The
deepest gaps are the core primitive itself (change atoms), the review surface
(lane + inspector ordering), the trust layer (evidence separation — where we
currently *conflict*, not just lag), and review state. The KB needs its regex
internals replaced but its API shape and stable IDs survive.

### 8.4 Proposed build sequence from here

1. **Phase A — Real KB** (roadmap #2–3): Tree-sitter extraction service, semantic
   symbols/refs, persist to Postgres, keep current API contract so the UI keeps
   working. Lift the 250-file cap.
2. **Phase B — Evidence-grounded Brain** (#5–6): citations in every assistant
   answer (file/symbol/test links that navigate the UI), PR-aware context,
   private-by-default chat.
3. **Phase C — Change atoms** (#4, #8): per-PR semantic chunking over the KB +
   diff; atom schema (title, category, files, deps, constraints, cues, watch-outs,
   evidence, risk).
4. **Phase D — The review surface** (#9–10): Semantic Lane + Context Inspector +
   Workbench layout; graph demoted to Architecture lens; review-state tracking
   per atom; "delta since last visit".
5. **Phase E — Risk/tests** (#7): test-coverage linkage per atom, missing-coverage
   detection, evidence-strength markers.

## 9. Open questions

- **Niche-first?** banking/compliance vs early-stage AI-heavy startups vs general.
- **Deployment:** how early do we invest in local/VPC (the security wedge)?
- **Naming/branding:** Daphne (docs) vs Plot (repo) — pick one everywhere.
- **Figma sync:** mirror "Daphne – PR Review" frames into the repo for reference.
- **Survey:** `Nelson | Survey` page is empty — run the practitioner survey to
  validate the frustration ranking (§1) with real reviewers.
- **Where does education fit?** The original Plot wedge (alternatives carousel,
  juniors learning the pattern space) maps to Junior mode + Repository Brain
  explanations — keep it explicit in adaptive modes.

## 10. Source map (Daphne Notion, crawled 2026-06-06)

- Root: `⏪ Daphne` — index page
- `I – Conceptual Model` — thesis, 6 problem/solution sections, trust callout
- `II – Code Reviews: A cognitive load issue` — representation problem, PR anatomy
- `III – Product Features` (+ A. Stacked PR · B. File × revision matrix ·
  C. Patch-set comparison) — 7 MVP features, patterns to steal
- `IV – MVP Roadmap` → `I – Repository Brain` — milestone + 10-step build order
- `IV – Cognitive Load Theory Applied to PRs` (+ `Observations`) — CLT mapping,
  chunking/worked-example/expertise-reversal analysis
- `V – Technical Considerations` → `Repo Brain` — extraction/index/concept/agent
  layers, stack choices
- `VI. Design Considerations` (+ `To Discuss`) — six-surface UI spec, Context
  Inspector ordering, lens definitions, agent principles
- `VII. Current Frustrations` — thematic frustration breakdown, five missing
  contexts, six opportunities, product direction
- `Notes on PR Review` — comprehension-vs-automation framing, Greptile angles
- `Greptile — core advantages and drawbacks` / `Graphite — …` / `Graphite vs.
  Greptile in one line` — incumbent analysis
- `Pietro | Researches` — security wedge, hybrid model
- `Questions` — niche focus
- `About Me` — Pietro's background (Weav, Hyle) + Daphne pitch + envisioned solution
- `Nelson | Survey` — blank (todo)
