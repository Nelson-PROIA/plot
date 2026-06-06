# Daphne: Market Analysis & Competitive Review

> Consolidated 2026-06-06. Sources: the ⏪ Daphne Notion incumbent research
> (Pietro), a 31-agent web sweep (2026-06-06, adversarially verified), a
> 7-agent graveyard/science fact-check (2026-06-06), and first-hand source
> verifications. Vendor-reported or agent-reported figures are flagged.

---

## 1. Market context, why now

- AI made code generation cheap; it did not make code **understanding** cheap.
  The bottleneck moved from writing code to **approving and trusting it**.
- Review pressure is exploding (Greptile reports drastic increases in commits
  reviewed as agents improve; Haystack's 2026 pivot was driven by "the flood of
  AI PRs"). Reviewers increasingly approve changes they did not watch being
  written and do not fully understand.
- The dominant market response so far is **more AI on the diff** (comment
  bots), which adds another text wall and does not restore understanding.
- A second wave (mostly 2025–2026) started attacking the **representation**:
  grouping, ordering, walkthroughs. This validates the comprehension thesis,
  and starts a land grab on its easy half.
- Platform pressure: GitHub Copilot code review went GA in 2025 and is bundled
  with paid Copilot seats, setting a "good enough and already there" floor for
  plain AI review.

## 2. Market map

| Category | Who | Job they sell |
|---|---|---|
| AI comment bots (1st wave) | CodeRabbit (core), Greptile, Qodo, Bito, Korbit, Ellipsis, Panto, CodeAnt, Copilot CCR, Cursor Bugbot | "Catch bugs on every PR" |
| Comprehension-review (2nd wave, 2025-26) | CodeRabbit **Atlas**, **Devin Review**, **Stage**, **cubic**, Graphite **Code Tours**, Baz | "Understand the PR faster" |
| Review workflow platforms | Graphite (stacks, inbox, merge queue), Gerrit, Reviewable, Sapling ReviewStack | "Keep review/merge flowing" |
| Repo intelligence / brains | Unblocked, Glean, Sourcegraph (Deep Search), DeepWiki / Google Code Wiki, Qodo Context Engine, Augment, Driver, Potpie | "Answer questions about the codebase" |
| Comprehension / visualization | CodeViz, GitDiagram, AppMap, CodeScene, (†CodeSee, †Sourcetrail) | "See the architecture" |
| Autonomous validation (endgame bet) | Greptile (thesis), TREX, agent loops | "Remove humans from review" |

**Daphne's claim:** no one combines *system-wide understanding* + *PR as the
atomic scope* + *evidence-grounded credibility* in one product. Each category
holds a fragment.

## 3. Deep profiles, the two incumbents studied in the Notion

### Greptile, "independent AI auditor"
- **Bet:** independence (reviewer ≠ author agent), autonomy, feedback loops;
  explicitly "no code review UI", background pipes. v3 agentic "detective"
  loop; v4 claims addressed-comments 0.92→1.60/PR, 30%→43% addressed
  (vendor-reported). TREX generates/runs tests. Cloud + on-prem/BYO-LLM.
  Pricing $30/dev/mo + usage (vendor pages).
- **Strengths:** full-codebase graph context; enterprise governance story;
  agent-agnostic integrations; public benchmarks/examples.
- **Weakness vs Daphne:** optimizes validation, not human comprehension; the
  experience is still findings-in-a-PR. *"Greptile is trying to make review
  more autonomous. The visual-first opportunity is to make review more
  understandable."*
- **Relationship:** complement more than competitor, its signals can feed a
  comprehension layer.

### Graphite, "workflow operating system for review"
- **Bet:** stacked PRs + PR inbox + stack-aware merge queue + Graphite Agent +
  **Code Tours** (Apr 2026: "a guided walkthrough of the proposed code
  changes… in a clear sequence, with full context in narrative form", verified first-hand).
- **Strengths:** owns the stacking workflow; modern PR page; reduces waiting,
  not just reading; deep GitHub integration.
- **Weakness vs Daphne:** stack-aware, not architecture-aware; Code Tours are
  narrative-first, not system/structure-first; large stacks still fragment the
  holistic picture.
- **Threat level:** highest among incumbents, already moving from workflow
  into guided comprehension.

**One line (Notion-era quote):** *"Greptile reviews code. Graphite manages
code-review flow."* Current canonical positioning: **Greptile validates code.
Graphite manages flow. Daphne gives you back understanding of the system.**

## 4. The second wave, comprehension-review competitors (verified)

All five quotes below were fetched first-hand from primary sources (2026-06-06/07).

| Product | Verified claim (their words) | Status / traction | What they still lack |
|---|---|---|---|
| **CodeRabbit Atlas** (May 2026) | "groups related work into a small number of independent **change cohorts**… Each cohort is broken into **ordered layers** that reflect the natural reading order" + selective sequence/state/ER diagrams | CodeRabbit: $60M Series B (Sept 2025), 8k+ paying customers (confirmed); ~$40M ARR is an unverified third-party estimate, the company only states "10× revenue growth" | Cohorts are AI summaries **over** the diff, not first-class approvable units; no per-claim evidence model; no whole-repo/temporal graph |
| **Devin Review** (Cognition) | "groups together changes that are logically connected, **orders the hunks**, and explains each hunk, so you can review from top to bottom… as if a smart colleague was walking you through" | Live (`github`→`devinreview` URL swap); was free, monetizing 2026 | Severity tiers ≠ evidence citations; no structured inspector; no architecture lens |
| **Stage** (YC P26) | Changes grouped into "small logical '**chapters**'… ordered in the way that makes most sense to read"; "Code review **bots**… don't solve the root problem" | Early; hosted + MIT local CLI; Stagent cites files/lines | PR-scoped only, no whole-repo/temporal KB, no architecture lens, no named trust model |
| **cubic.dev** (ex-mrge.io, YC X25) | "**Intelligent diff ordering**: AI groups related changes together and orders them logically. Stop reviewing alphabetically-ordered diffs." + "Visualize high-level changes before diving in" | cubic 2.0 Jan 2026; per-seat ($30–99/dev/mo) with per-tier reviewed-line caps | Mostly still a comment bot + ordering; no trust model, no temporal KB, layer-heuristic ordering |
| **Graphite Code Tours** | (see above) | Shipping | Narrative only; no atoms, no impact map, no evidence layer |

Also notable: **Baz** ($8M seed), AST-level "Topics" (rigorous change units via
tree-sitter/difftastic), diff-scoped "Change Request Graph", module memory.
Most architecturally similar to Daphne's machinery; no persistent/temporal
whole-repo graph, no trust contract, atoms are analysis output rather than a
review surface.

**Read:** the *chunk + order* half of comprehension-review went from white space
to consensus in ~12 months. Atlas is three weeks old at time of writing. Speed
matters.

## 5. Repo intelligence / "brain" competitors

| Product | What it is | Gap vs Daphne |
|---|---|---|
| **Unblocked** (~$30M; $20M Series A May 2025, TechCrunch, confirmed) | Context engine over code+PRs+Slack+Jira+Notion; living knowledge graph; contradiction resolution; cited answers; 92 NPS at Codat (vendor-reported); new AI Code Review (Feb 2026) | Knowledge-management "why", not code-structure-first; one reconciled answer, no evidence-strength spectrum; review product has no atoms/path/inspector |
| **DeepWiki** (Cognition) + **Google Code Wiki** (ex-Mutable.ai team) | Repo → wiki with architecture diagrams + chat with line-level citations; 50k+ repos (vendor-reported); free for public repos | Onboarding-oriented, not PR-aware; citations without verified-vs-inferred grading |
| **Qodo** | Review platform + Context Engine; `/ask` with a visible References panel; Gartner Visionary (Sept 2025) | References ≠ evidence strength; comprehension is a side feature of a review gate |
| **Glean** (Feb 2026 engineering agents) | Org-wide permission-aware grounded answers incl. PR review agent | Not code-structure-first (no symbol graph/temporal KG) |
| **Sourcegraph** | SCIP precise indexing + Deep Search (cited answers); Cody Free/Pro deprecated Jul 23 2025 → enterprise-only, individuals pushed to its agentic Amp product | Leaves the mid-market/individual gap; search-oriented, not review-comprehension |
| **Driver AI** ($8M, GV) | "Compiler for codebase context": DAG decomposition, bottom-up LLM passes, history guides; serves **agents** via MCP | Explicitly not a human review surface |
| **Augment Code** | Semantic dependency graph at 400-500k-file scale, feeds agents | Same, agent infrastructure, not human comprehension UX |

**Read:** evidence-*linked* repo chat is commoditizing (DeepWiki free, recipe
published in arXiv 2512.12117, 92% citation accuracy, zero hallucinations on
the benchmark). Evidence-*graded* answers (verified vs structural vs inferred,
per claim) remain unshipped by anyone, verified by a targeted sweep. Note: an
empty slot can also mean a hard problem; full claim grading is an answer-
evaluation topic of its own. Daphne treats it as a later layer, not the core
bet. The core bet is the integration: every product above ships a fragment.

## 6. Graveyard, fact-checked (what actually killed them)

| Product | Dead? | Verified cause | Was the visual UI the cause? |
|---|---|---|---|
| **CodeSee** (maps + PR review maps) | Ops ended Feb 2024; IP → GitKraken May 2024 | Founder (Shanea Leven): "sales growth was inconsistent"; cost of more languages/IDEs; GenAI complexity. Users praised the maps | **No** (business model) |
| **Sourcetrail** (graph code explorer) | Archived Dec 2021 | Founders' company had already failed; maintenance burden; "lost interest". Graph UI was the most-praised feature; 1,600+ forks | **No** (sustainability) |
| **Pierre** (beautiful hosted review) | Product dead; company pivoted to code.storage (git infra for LLMs) | Strategic pivot per founder; UI praised, never blamed | **No** (strategy) |
| **Haystack** (infinite-canvas review) | Company alive; **canvas abandoned** Sep 2025 | User at canvas launch (Feb 2025): "What do those groups and arrows mean?" → Founder at abandonment (Sep 2025): "after testing it with a lot of engineers… **too confusing for code reviews**. The main issue was just how **alien** the interface is!" (confusion observed early, acted on 7 months later) | **Yes, the only genuine data point**, and scoped to canvas-as-mandatory-review-surface |
| **Mutable.ai** (cited auto-wiki) | Acqui-hired by Google Dec 2024 → Code Wiki | Talent/feature absorption by a platform | No (validated the idea) |
| **Cosine/Buildt** (codebase search) | Pivoted fully to autonomous SWE agent | Standalone comprehension/search judged non-defensible by the team | No (defensibility) |

**Lessons:** (1) comprehension/visualization decoupled from a must-do workflow
repeatedly fails **as a business**, even when loved as a product; (2) the only
documented user rejection of a visual UI is the *infinite canvas as the
mandatory review surface*; (3) platforms absorb comprehension features
(Google, GitKraken), being a feature is the failure mode to avoid.

## 7. What the science says (both ways)

**For visual/structured representation:**
- REACHER (LaToza & Myers, VL/HCC 2011): interactive call-graph users **5×
  more successful** on reachability questions, in less time (causal, narrow).
- CodeMap (arXiv 2504.04553): structured maps cut reliance on verbose LLM text
  by **79%**; strong user preference (perception study, not accuracy).
- Citation-grounded comprehension (arXiv 2512.12117): graph-expanded retrieval
  + citation verification → 92% citation accuracy, zero hallucinations;
  cross-file graph evidence beat text-only on 62% of architectural queries
  (supports the graph **data model**, not the visual UI per se).

**Against / null:**
- di Biase & Bacchelli (PeerJ CS): better-decomposed changes → fewer false
  positives and more context-seeking, but **no measured gain** in defects
  found or rationale understanding.
- Baum et al. (ICSME 2017): reviewers *want* relatedness-ordering over
  alphabetical (theory-building, not outcome-proven).
- Petre (CACM 1995): graphical notations require learned reading skill;
  novices can fail to exploit them. Software-viz SLRs: ~62% of approaches lack
  rigorous evaluation; UML adoption declined.

**Design conclusion the evidence supports:** an ordered, explained reading
path, with the graph one click away for the relational questions where it
objectively wins (impact, callers, blast radius). Founder decision diverges
deliberately: graph is the default, with the reading path drawn on it and the
classic view one click away (guardrails in PRODUCT.md §4.4).

*(Note: the percentages above are author-reported by the respective papers and
were not independently replicated.)*

## 8. Daphne's value proposition vs the field

**Pitch:** *"You ship code you didn't write and approve changes you don't fully
understand. Daphne gives you back understanding of the system you're building,
starting with every PR."*

The differentiation is the **combination itself**: the market is scattered
bricks and every competitor ships a fragment. What Daphne gathers into one
simple product, that no verified competitor does:
1. **System-wide understanding as the product** (not bug-finding, not workflow
   speed), with the PR as the atomic scope and the market entry.
2. **Change atoms as first-class reviewable units**: not AI prose layered on a
   flat diff (the gap Atlas/Stage/cubic all leave).
3. **Credibility machinery**: every explanation grounded in the real code
   graph with clickable citations, plus a lightweight source label per claim
   (observed / author-stated / inferred). Full evidence grading: later layer,
   hard evaluation problem, not the core bet.
4. **A living, temporal repo graph bound to the review moment**: competitors
   are diff-scoped (Baz) or static onboarding artifacts (DeepWiki).
5. **The system graph as the default view** (founder decision, for
   differentiation), with the reading path drawn on it and a classic linear
   view one click away. Guardrails against Haystack's canvas failure are in
   PRODUCT.md §4.4.

Supporting wedges: local/VPC deployment (CodeRabbit's security incident makes
"third-party AI with full repo access" a procurement blocker, from Pietro's
research); differentiated evidence tiers nobody combines (CodeScene-style
co-change/hotspot signals; AppMap-style runtime traces; GitDiagram's
validate-diagram-against-file-tree grounding).

## 9. Risks (ranked, honest)

1. **Speed of the second wave.** Atlas shipped weeks ago; Stage/Devin/cubic are
   colonizing chunk+order. Daphne must ship the parts they lack (atoms as
   units, system scope, credibility) before they add them.
2. **Copilot distribution.** Free, default-on review erodes willingness-to-pay
   for *any* standalone review tool. Daphne must sell a different job
   (understanding), and prove it's worth a line item.
3. **Tech commoditization.** Tree-sitter/SCIP/Graphiti/citation-RAG are public.
   The moat can only be the experience + trust discipline + workflow coupling.
4. **Agents-merge-agents.** Kills review-gate products. Daphne's core
   (explainability of machine-built systems) survives and arguably grows, but
   the **wedge timing** (PR review as entry) carries the risk.
5. **Two people vs funded cohort.** $60M (CodeRabbit), ~$30M (Unblocked),
   Cognition, YC batches. Focus + speed + a sharply different job are the only
   structural answers.
6. **Benchmark anchoring.** Public benches score comment act-on-rates, not
   comprehension. Either post a respectable number or define the comprehension
   benchmark (review-time-to-confident-decision; comprehension accuracy).
7. **Category vagueness.** "Explainability of systems" doesn't sell by itself.
   Discipline: **sell review, build explainability.**

## 10. Method note

Sources: ⏪ Daphne Notion (21 pages, fully crawled 2026-06-06); 31-agent
competitive sweep with adversarial verification of surprising claims; 7-agent
graveyard/science fact-check with primary-source quotes; first-hand page
fetches and a post-hoc 3-agent verification pass over this document (the six
load-bearing claims, Atlas, Devin, Stage, cubic, Haystack, Sourcegraph, were
re-confirmed verbatim against primary sources). Funding/traction figures are
vendor- or press-reported unless noted; self-published benchmarks (Greptile
82%, Entelligence "#1") are flagged and should not be treated as neutral
facts. Landscape moves monthly, re-sweep before major positioning decisions.
