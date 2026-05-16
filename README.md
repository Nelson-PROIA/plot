# Plot

**A Figma-style infinite canvas for reading codebases and reviewing pull requests.**

Built at the Paris AI Hackathon 2026.

Plot turns a GitHub repo into a navigable knowledge graph and turns each open PR into a spatial canvas — intent, architecture, risks, alternatives, change cards, diff, and a live preview iframe — with AI-streamed enrichment, right-click "Ask AI", an audit panel across all open PRs, a step-through function-trace player that shows request payloads moving along call edges, and a presentation mode for live demos.

Demo repo Plot is showcased against: [Nelson-PROIA/float](https://github.com/Nelson-PROIA/float) (deployed at https://float-silk.vercel.app).

---

## What Plot does

1. **Ingest a real GitHub repo** in one click. One `git/trees?recursive=1` call + batched blob fetches build a knowledge graph: files grouped by top-level directory, import edges parsed from source, `tsconfig.json` `paths` resolved for `@/...` imports.
2. **Render the repo as a knowledge graph** at `/repo`: dashed group containers, file rows you can expand inline to reveal exported signatures (streamed from a server route that fetches blob content and parses with a regex), right-click any file to ask the AI about it, drag to bulk-select, click a group to focus on it, click the sparkles ✨ icon next to any group to have the AI describe it.
3. **Drill into a function** by clicking a signature → a side panel opens with an AI-extracted **call graph**: callers on the left, callees on the right, with **animated payload chips** moving along the edges. In play mode, packets travel sequentially through the request lifecycle (one hop at a time). Switch to step mode to walk hop by hop; the bottom panel pretty-prints the JSON payload for the active step. Click a chip in the panel to drill from there — a breadcrumb at the top lets you walk back.
4. **Open a PR** at `/pr/[n]` and the canvas materializes: an Intent card (kind / surface / scope / ticket / first-paragraph summary with full body in a sheet), an Architecture node showing touched modules + their dependencies, AI-extracted Risks ordered by severity, an Alternatives carousel summarizing design choices the team considered, ChangeCards with Mermaid before/after diagrams of the affected functions, a unified Diff sheet, and a live Preview node pulled from the Vercel Deployments API filtered to the PR's head SHA.
5. **Approve & merge** the PR directly from Plot — two-step GitHub flow (review-approve, then squash-merge).
6. **Audit panel** lists every flagged risk across all open PRs, severity-sorted, click to jump to the PR canvas with that risk highlighted.
7. **Assistant** is scoped — opening it from a PR canvas, the repo graph, or a single node feeds the right context. The assistant streams from OpenAI with SSE.
8. **Presentation mode** — press `P` to hide all chrome (headers, sidebars, FAB), `Esc` to exit. There's a small "presenting · esc" pill in the top-right while it's on.

## Stack

- **Next.js 16.2.6** with Turbopack, App Router, Server Components for the API routes
- **TypeScript 5** strict mode
- **Tailwind v4** with `@theme inline` + `@custom-variant dark`
- **@xyflow/react v12** for every canvas (PR canvas, repo graph, function trace) — custom nodes, custom edges with `animateMotion` for moving SVG payload packets, parent/child nodes for group containers, `getSmoothStepPath` for path rendering
- **Framer Motion** for sheet/panel animations and the tour
- **Mermaid** (dynamic import) for change-card flowcharts
- **react-diff-view + refractor** for the unified diff sheet with Prism token classes
- **@octokit/rest** for GitHub REST + GraphQL
- **OpenAI SDK** (gpt-4o-mini by default) with SSE streaming for chat, canvas enrichment (parallel section calls), and function-trace

## Partner technology used

**OpenAI** — frontier model API across all AI features (canvas enrichment, chat assistant, function-trace, file explanation, group description). Streaming over SSE.

## Repository layout

```
src/
  app/
    api/
      ai/
        canvas/route.ts          # PR-canvas enrichment — parallel section calls, SSE
        chat/route.ts            # streaming chat
        function-trace/route.ts  # callers/callees + example payloads
        explain-file/route.ts    # one-paragraph file explanation
      repo/
        signatures/route.ts      # SSE: parses exported signatures per file
    pr/[number]/page.tsx         # PR canvas page
    repo/page.tsx                # knowledge graph page
    page.tsx                     # onboarding + PR list
  components/
    Canvas.tsx                   # main React Flow canvas for PRs
    RepoGraphView.tsx            # /repo — groups, files, signatures, audit
    FunctionTracePanel.tsx       # call graph + player + payload panel
    AuditPanel.tsx               # cross-PR risk drawer
    Assistant.tsx                # streaming chat with scoped context
    PresentationContext.tsx      # P / Esc keybind, presenting overlay
    nodes/                       # Intent, Architecture, Alternatives, ChangeCard, Risk, Diff, Preview
    ...
  lib/
    repo-graph/
      builder.ts                 # tree + blob fetch, tsconfig aliases
      imports.ts                 # import parser with alias resolution
    repo-source/
      canvas-builder.ts          # heuristic PRCanvas from PR/files
      mock.ts / github.ts        # source adapters
    ai/
      enrich-canvas.ts           # SSE consumer that merges AI sections progressively
      cache.ts                   # localStorage cache by head SHA
```

## Setup

1. Clone and install:
   ```bash
   pnpm install
   ```
2. Create `.env.local`:
   ```env
   OPENAI_API_KEY=sk-...
   # Optional — used as the server fallback if the client doesn't pass one.
   GITHUB_TOKEN=ghp_...
   # Optional — defaults to gpt-4o-mini
   OPENAI_MODEL=gpt-4o-mini
   ```
3. Run the dev server:
   ```bash
   pnpm dev
   ```
4. Open `http://localhost:3000`. On first launch you'll be asked for a repo (`owner/name`) and your GitHub PAT. The PAT needs `repo` scope for private repos or `public_repo` for public ones; add `pull_request` write if you want to approve/merge from inside Plot.

The OpenAI key lives **in `.env.local` only** — there's no UI to paste it, so it never reaches localStorage.

## API surface

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/ai/canvas` | POST | Stream the four PR-canvas sections (intent / risks / alternatives / changes) as SSE events |
| `/api/ai/chat` | POST | Streaming chat completion |
| `/api/ai/function-trace` | POST | Pull file content via Octokit, ask the model for callers/callees + example payloads |
| `/api/ai/explain-file` | POST | Two-sentence file explanation given path + adjacency |
| `/api/repo/signatures` | POST | SSE — for each path, fetch blob and regex-parse exported signatures |

All AI routes accept `x-openai-key` and `x-github-token` headers from the client; both fall back to env. SSE follows the standard `data: <json>\n\n` framing with `data: [DONE]\n\n` as the terminator.

## Demo tips

- Press `P` mid-demo to hide all chrome, `Esc` to exit.
- The audit panel button is in the `/repo` header — useful to surface cross-PR risks before going into a single PR canvas.
- Function trace: click any signature, then toggle the player from `▶︎ step through` for the request-lifecycle walkthrough.

## Acknowledgments

Built at the Paris AI Hackathon 2026 with OpenAI and Vercel.
