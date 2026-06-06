# Daphne — Product Document

> **The working north star — latest founder vision.** The ⏪ Daphne Notion
> (Pietro's gathered research + thinking, 21 pages, crawled in full) is the
> **starting point**; this document supersedes it where they differ, folding in
> the positioning decisions made since, the current prototype (this repo), and
> hard market research. Competitive depth:
> [`docs/research/market-analysis.md`](docs/research/market-analysis.md).
>
> Naming: north-star docs say **Daphne**; this repo ("Plot") is the prototype.

---

## 0. Pitch

> **"You ship code you didn't write and approve changes you don't fully
> understand. Daphne gives you back understanding of the system you're
> building — starting with every PR."**

## 1. What Daphne is (and the order that matters)

1. **The product: understanding.** Daphne gives people back **understanding of
   what they build** — system-wide. AI made code cheap to produce and expensive
   to understand; Daphne is the layer that keeps humans able to understand,
   manage, and stay confident in the systems being built, regardless of who or
   what wrote the code.
2. **The entry: PR review.** The idea originated in PR review and that is how
   we attack the market: the PR is the **atomic scope of understanding** and
   the recurring, must-do moment where understanding is needed and bought
   today. Understanding is also precisely what makes you review well.
3. **The credibility mechanism (not the headline):** everything Daphne says is
   grounded in the real code graph, and its claims are verifiable — separable
   into observed fact, author-stated intent, and inference, each with evidence
   behind it. This is the hardest part to copy and the reason Daphne's
   explanations can be believed. It ships inside the product; it is not the
   pitch.

**Long-term invariance:** if the human review loop shrinks (agents merging
agents), the entry surface moves (system briefings, change digests, incident
explainers, audit trails, drift reports) but the core does not: **someone
accountable must always be able to answer "what is this system doing, what
changed, and why should I trust it."** Daphne is how they answer.

Discipline that follows: **sell review, build explainability.** Never let the
wedge become the identity (comment-bot trap), never pitch the mechanism as the
product (trust-tool trap), never force the long-term vision as the entry
(category-vagueness trap).

## 2. The problem

The problem is not that pull requests lack information — they contain too much
of it, **arranged in the wrong shape**. A PR shows what changed line by line; it
rarely explains what the change *means*. The reviewer's bottleneck is **building
the correct mental model**: what changed, why, how it flows through the system,
what might break.

Five kinds of context the diff doesn't carry (the reviewer reconstructs them
by hand today):

1. **Behavioral** — what the system does differently after the merge.
2. **Architectural** — where this sits; which boundaries are crossed.
3. **Dependency** — callers, callees, contracts, blast radius.
4. **Historical** — why the old code existed; prior incidents and decisions.
5. **Review** — what I've already understood; what remains risky.

AI made this urgent: reviewers are asked to approve large machine-generated
changes through an interface designed for hand-written ones. Most AI review
tools respond by adding **more text** to the overloaded surface — models
reviewing models, "send more AI to review AI". They don't change the shape of
review.

**The demand signal already exists:** reviewers routinely paste diffs into
private ChatGPT/Claude sessions to ask *"what is this PR doing?"* — proof that
the missing product is change understanding, not more automated review (and a
behavior Daphne replaces natively, with the context already loaded).

**Core argument:** move review from *"read every changed file in provider
order"* to *"understand the change, then inspect the risky parts"* — and make
the understanding system-wide, not diff-deep. As generation automates, the
value of human review moves up: validating intent, architectural fit,
behavioral correctness, product risk, and **consistency with the system's
existing conventions** — not reading every line.

## 3. Theory foundation — Cognitive Load Theory (Sweller)

PR review is a working-memory problem. Design target: cut **extraneous** load
(navigation, context reconstruction) so reviewers spend **germane** load
(building the right mental model) on judgment.

| CLT concept | PR translation | Design move |
|---|---|---|
| Intrinsic load | Real complexity of the change | Staged review units |
| Extraneous load | UI friction, scattered context | Integrate context into the surface |
| Germane load | Building the mental model | Semantic chunks, guided tour |
| Element interactivity | Many interacting files/concepts | Group by subgoal & dependency |
| Split attention | Tab/tool jumping | Inline context at the artifact |
| Isolated elements | Everything at once | Intent-first, progressive disclosure |
| Worked example | The author's mental model | Sequenced review path |
| Expertise reversal | One explanation for everyone | Adaptive detail per reviewer |

The interface must answer five questions, fast: **Intent** (what is this trying
to do) · **Structure** (which semantic parts) · **Flow** (what order to inspect)
· **Risk** (where attention is needed) · **Evidence** (what supports the
assessment).

Principles: *never make the reviewer reconstruct context the system can attach
to the artifact* · *don't hide complexity — sequence it* · *the semantic layer
is an index into evidence, never a replacement for it (the raw diff stays
close)*.

## 4. The product

### 4.1 Core primitive — change atoms

The unit of review is not a file, hunk, or line. It is a **change atom**: the
smallest reviewable unit with independent meaning — behavioral, architectural,
or contractual. Not *"`auth/validator.ts` changed"* but *"session refresh now
validates token expiry before scope resolution."*

Every atom is traceable — expandable into files, symbols, concepts, purpose,
related tests, risk, owner — and links back to the raw diff. Atoms are
**first-class**: reviewable and approvable unit-by-unit, with review state
tracked per atom (and "delta since your last visit" on revisits). *Bad version:
an AI summary paragraph. Good version: a chunk with traceability.*

This is also the concrete differentiator: the 2026 second wave (CodeRabbit
Atlas, Devin Review, Stage, cubic, Graphite Code Tours) ships AI grouping and
reading order **on top of a flat diff**. The closest, Baz, produces rigorous
AST-level change units — but as analysis output, not a surface you approve
unit-by-unit. None makes atoms a first-class, independently approvable review
surface. (See market-analysis §4.)

### 4.2 The surfaces (target UI)

1. **Workspace Header** — deliberately boring. Global orientation only: PR
   identity, branches, CI, review progress ("4 atoms · 1 high risk · 2
   unresolved cues"), submit. No intelligence here.
2. **Semantic Lane** — the home surface. One chip per atom (`02 Session Flow ·
   Logic · 4 files` + state), horizontally scannable, keyboard-navigable.
   Hover = preview card (~300–500ms; "why it matters", scope, next action).
   Selecting an atom synchronizes every surface. Ordering is **programmable**:
   Semantic (the story) · Risk (senior triage) · Workflow (QA) · Test-failure
   (debugging).
3. **Context Inspector** (right) — fast comprehension of the selected atom, in
   this order: What changed / Why it matters → **Constraints** (what must stay
   true: security, API shape, perf budgets) → **Review Cues** (what to verify;
   gates "mark reviewed") → **Watch Out For** (failure modes, evidence-backed)
   → compact **Scope** (`3 files · 3 deps · +37 −200`, expandable) →
   **Evidence / Actions**. Plus sharp per-atom **Review Questions** ("is this
   retry idempotent?").
4. **Workbench** (center) — the atom's real diff, surrounded by what it needs:
   related functions, tests, docs, similar existing patterns.
5. **Investigation Drawer** (left, collapsed; never required for the core
   loop) — lenses: Tests · Runs · Artifacts · Comments · Agents · History
   ("have we seen this before?") · **Architecture** (the system graph) · Docs &
   Contracts · user-defined custom lenses. Lenses also surface runtime/replay
   evidence and failure recurrence — institutional memory, not just static
   code.
6. **Agent Command Center** — talk to the repo; agents as **context routers,
   not approval machines** (replay, test-gen, triage, coverage, artifact
   analysis, approval-gated patch suggestions) with a lifecycle view and
   **Claim Audit** (inspect why Daphne believes anything).

### 4.3 Repository Brain

The understanding engine: a conversational layer grounded in the repository —
architecture, history, ownership, docs, current PR.

- **Evidence-grounded, always.** Answers cite files, symbols, tests, past PRs —
  clickable, navigating the UI. No unsupported guesses.
- **Claims are graded.** Observed (here's the line) ≠ author-stated (from the
  PR description) ≠ inferred (the model's reading), with evidence strength
  (diff-only < dependency trace < failing test < incident < runtime artifact).
  This is the credibility mechanism of §1.3 made concrete.
- **Private by default.** Reviewers explore naïvely in private; only
  intentional artifacts are shared. The tool must never feel like surveillance
  — adoption depends on it.
- **Living memory.** The knowledge layer updates as PRs merge; architecture,
  concepts, and risks evolve with the system. Docs that maintain themselves.

### 4.4 The graph (Architecture lens)

The system graph — groups, files, symbols, call/import edges, ownership,
blast radius — is Daphne's **impact instrument**, one click away, never the
mandatory door. Science supports exactly this split: interactive graphs are ~5×
better for relational questions (what calls this, what does this affect), while
ordered/explained paths win for general review; the one product that made an
infinite canvas the mandatory review surface (Haystack) retracted it ("too
alien" per its founder). The prototype's granularity ladder
(system → file → symbol → code), PR overlay with dim/isolate, and animated
data-flow traces live here as the lens's instruments.

### 4.5 Adaptive reviewer modes

The same PR, different cognitive projections: Junior (explanations, patterns,
examples — review as learning) · Senior (architectural delta, deviations, risk
hotspots) · Domain owner (owned modules, invariants, nearby history) ·
QA/Product (behavior delta, screenshots, acceptance criteria) · Security
(permissions, exposure, trust boundaries).

### 4.6 Patterns deliberately adopted from the field

- Vertical review slices with a reading order (Graphite/ReviewStack lineage).
- Review state per atom × revision; **"delta since last visit"** (Gerrit
  patch-set model; GitClear).
- Change-type triage: renames collapsed, generated files hidden unless
  suspicious, contract/security changes prominent — **review surface
  proportional to semantic risk**.
- Evidence tiers nobody combines: co-change/hotspot signals (CodeScene-style),
  runtime traces (AppMap-style), diagram-vs-file-tree validation (GitDiagram's
  grounding trick).

## 5. Strategy

- **Wedge:** PR review (see §1). Single-repo, GitHub-first, TS/JS-first.
- **Expansion (same core, new surfaces):** onboarding briefings, system change
  digests, incident explainers, architecture drift reports, audit/compliance
  attestations ("a human can explain this system").
- **Niche hypothesis to test** (from the Notion's open question): regulated /
  compliance-heavy industries (e.g. banking) where a human being able to attest
  to system behavior is mandatory — explainability is *bought* there, not just
  liked. Also: early-stage AI-heavy teams afraid of invisible tech debt.
- **Deployment wedge:** local / VPC / on-prem early — the CodeRabbit security
  incident makes "third-party AI with full repo access" a procurement blocker
  (Pietro's research).
- **Positioning vs the field:** *Greptile validates code. Graphite manages
  flow. Daphne gives you back understanding of the system.* Their outputs
  (review comments, stacks, CI) become Daphne inputs. And: *AI comments help
  developers fix issues; AI comprehension helps reviewers trust decisions.*

## 6. Competitive position (summary)

Full analysis: [`docs/research/market-analysis.md`](docs/research/market-analysis.md).

- **1st wave (comment bots)** — crowded, commoditizing, Copilot sets a free
  floor. Not our game.
- **2nd wave (comprehension-review)** — chunk+order shipped at CodeRabbit
  (Atlas), Devin, Stage, cubic, Graphite in the last ~12 months. Validates the
  thesis; consumes the easy half. We must ship what they lack.
- **Still open (verified):** per-claim evidence grading (verified vs inferred)
  · atoms as first-class approvable units · a living temporal repo graph bound
  to the review moment · combined evidence tiers (static + co-change +
  runtime).
- **Graveyard lesson:** comprehension decoupled from a must-do workflow dies as
  a business even when loved (CodeSee, Sourcetrail); canvas-as-mandatory-review
  was user-rejected once (Haystack). Hence: PR-review anchor + graph as lens.
- **Hard risks:** second-wave speed, Copilot distribution, commodity tech (moat
  = experience + trust discipline + workflow coupling, never the index), and
  team size vs funded cohort — answered by focus and a different job-to-be-done.

## 7. Gap analysis — what we have vs what Daphne proposes

Framing: **this repo is the raw hackathon idea; Daphne is the target.**
Current build: branch `unified-graph`, deployed at plot-orpin.vercel.app.

| # | Daphne proposes | What we have today | Verdict |
|---|---|---|---|
| 1 | **Change atoms** with files/deps/tests/risk/evidence each | Nothing chunk-based; nearest: per-PR canvas cards + file-level PR tinting | ❌ **Missing — the core gap** |
| 2 | **Workspace Header** with review progress, CI, submit | Thin headers (repo stats; PR title + approve/merge) | 🟡 Cosmetic only |
| 3 | **Semantic Lane** with programmable order + per-chip state | None. Granularity pill ≠ review path; `/pr` tour isn't atom-based, has no state | ❌ Missing |
| 4 | **Context Inspector** (constraints → cues → watch-outs → scope → evidence; observed/stated/inferred; gating) | `PRDetailPanel`: AI intent summary, risk cards, file list | 🟡 Skeleton (~2/7 sections) |
| 5 | **Workbench** — atom diff + surrounding context | Whole-PR `DiffViewer`; code-level symbol cards | 🟡 Partial |
| 6 | **Investigation Drawer** — 8 lenses + custom | Exactly one lens (Architecture = the unified graph) — currently *the home screen*, inverted placement | 🟡 1/8 |
| 7 | **Repository Brain** — cited, graded, private-by-default, living | `Assistant`: scope-aware chat, uncited prose, no persistence | 🟡 Chat exists, credibility layer doesn't |
| 8 | **Agent Command Center** + Claim Audit | None; nearest: FunctionTracePanel one-shot traces | ❌ Missing |
| 9 | **KB**: Tree-sitter AST + SCIP; Postgres/Qdrant/BM25; Graphiti temporal; concept layer | Regex extraction, ≤250 files; CDN+localStorage cache; no persistence/concepts/history | 🟡 Toy (~step 3/10) |
| 10 | **Credibility model** — evidence/structure/interpretation separated | AI enrichment renders inference *as fact*, uncited | 🔴 **Conflicts** with the north star |
| 11 | **Adaptive reviewer modes** | One fixed view | ❌ Missing |
| 12 | **Review progress & deltas** (per-atom state, delta-since-last-visit) | None | ❌ Missing |

**Assets beyond the Notion** (fold in or consciously park — don't silently lose):
granularity ladder (scroll system→file→symbol→code) · animated data-flow traces
(payload packets, drill-down) · multi-PR overlay with dim/isolate (proto blast
radius) · live preview embeds per PR · cross-PR risk audit panel · approve &
merge in-tool · presentation mode · tour engine · mock mode.

**Disposition:** unified graph → the Architecture lens (its ladder, overlay and
traces intact) · per-PR canvas content → Context Inspector sections · assistant
→ Repository Brain (add citations, grading, privacy) · audit panel → kept,
fed by atom-level risk · KB → replace regex internals with real parsing, keep
stable IDs (`file::symbol`) and API shape · GitHub proxy/token model → keep.

**Bottom line:** the prototype ≈ the Architecture lens + a proto-Inspector + a
proto-Brain — the *orientation* fifth of Daphne. Deepest gaps: the core
primitive (atoms), the review surface (lane + inspector), the credibility layer
(where we currently conflict, not just lag), and review state.

## 8. Roadmap

**Milestone 1 (from the Notion, unchanged):** connect one repository, index it,
open one PR, and answer *"what is this PR doing, where should I start, what is
risky?"* with links to actual code evidence.

Build order, annotated with current status:

| # | Step | Status |
|---|---|---|
| 1 | GitHub repo connection | ✅ |
| 2 | Repository ingestion | 🟡 regex, ≤250 files |
| 3 | File/symbol/dependency indexing | 🟡 heuristic |
| 4 | PR diff ingestion | 🟡 files only, no semantic model |
| 5 | Evidence-grounded chat | 🟡 chat yes, citations no |
| 6 | PR-aware answers | 🟡 context yes, evidence no |
| 7 | Risk and test detection | 🟡 AI risks, no test linkage |
| 8 | Semantic chunks (atoms) | ❌ |
| 9 | Review path | 🟡 node tour, not atoms |
| 10 | Standalone review interface | 🟡 canvas-first today |

Phases from here:

- **A — Real KB** (#2–3): Tree-sitter extraction, semantic symbols/refs,
  persist (Postgres), keep API shape; lift the file cap.
- **B — Credible Brain** (#5–6): citations in every answer (clickable,
  navigating the UI), observed/stated/inferred grading, private-by-default.
  Also resolves the one 🔴 in §7 (row 10): stop rendering inference as
  uncited fact.
- **C — Atoms** (#4, #8): semantic chunking over KB + diff; atom schema (title,
  category, files, deps, constraints, cues, watch-outs, evidence, risk).
- **D — The review surface** (#9–10): Lane + Inspector + Workbench; graph
  demoted to lens; per-atom review state; delta-since-last-visit.
- **E — Risk/tests** (#7): test-coverage linkage per atom; evidence-strength
  markers; co-change signals.

**Technical direction** (Notion `V – Technical`): Tree-sitter (AST,
incremental) · SCIP (cross-file refs) · ripgrep · Semgrep/ast-grep — Postgres
(truth) · Qdrant (hybrid retrieval) · Tantivy/OpenSearch (BM25) · Graphiti
(temporal KG / living memory) — LLM concept extraction (domains, boundaries,
invariants, ownership, risky zones, all evidence-linked) — MCP tools · LangGraph
loops · DSPy later — Claude/GPT-class reasoning · Voyage/OpenAI embeddings ·
reranker. All commodity (see risks): the stack is the floor, not the moat.

## 9. Validation plan (90 days)

1. **Run the survey** (`Nelson | Survey` in the Notion is still empty): 20 real
   reviewers — does blind-approve pain rank where we think? would they pay?
2. **Build phases A–B** on our own repos (prototype gives a head start on
   roughly half the steps).
3. **3 real teams.** Kill/continue signal: do reviewers *click the evidence
   links*? If they trust without checking, credibility isn't the buying
   trigger → reposition toward the niche where proof is mandatory.
4. **Day-90 decision** on usage data: general dev-tools vs compliance niche.

## 10. Open questions

- Niche-first GTM (banking/compliance) vs general? (§9 answers with data.)
- How early to invest in local/VPC deployment?
- Naming: Daphne (docs) vs Plot (repo) — pick one everywhere.
- TODO: create `docs/design/` and export the Figma "Daphne – PR Review" frames
  there (directory doesn't exist yet).
- Where does education fit explicitly? (Original Plot wedge — juniors learning
  the pattern space — maps to Junior mode + Brain explanations. Keep visible.)
- Comprehension benchmark: define ours (time-to-confident-decision,
  comprehension accuracy) since public benches only score comment act-on-rate.

## 11. Sources

- **⏪ Daphne Notion** (starting point — Pietro's research + thinking; crawled
  in full, 2026-06-06): Conceptual Model · Cognitive-load thesis · Product
  Features (+3 pattern pages) · MVP Roadmap (Repository Brain) · CLT Applied
  (+Observations) · Technical (Repo Brain) · Design Considerations (+To
  Discuss) · Current Frustrations · Notes on PR Review · Greptile/Graphite
  analyses · Pietro's research · Questions · About Me. (`Nelson | Survey`
  empty — see §9.)
- **Research:** [`docs/research/market-analysis.md`](docs/research/market-analysis.md).
- **Prototype:** this repo, branch `unified-graph`, deployed at
  plot-orpin.vercel.app.
