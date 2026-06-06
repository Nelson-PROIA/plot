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

## 8. Current prototype vs north star — what to keep, reshape, demote

The repo today (branch `unified-graph`): 4-level granularity canvas
(system→file→symbol→code), scroll-driven abstraction ladder, multi-PR overlay
with dim/isolate, AI function traces with animated data flow, per-PR canvas with
intent/risks/alternatives/tour, assistant, audit panel, GitHub proxy, Vercel
deploy.

**The honest tension:** the Daphne docs explicitly critique freeform-canvas-first
review — *"Represent the PR as a vertical stack of review slices, not a freeform
graph… the reviewer gets a reading order"*; *"less visually exciting than a
canvas, but much more useful."* The winning UX is **chunk-first, evidence-backed,
graph-aware, progressively disclosed** — the graph is a lens, not the home.

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

### Proposed build sequence from here

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
