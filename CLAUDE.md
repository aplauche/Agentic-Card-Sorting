# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Runs **open card sort studies with synthetic LLM participants** and analyzes the results with hierarchical cluster analysis (HCA). A user enters labels; 20 AI agents (distinct personas) each sort them into groups; the aggregated results can then be analyzed into a similarity matrix, dendrogram, heatmap, and cluster assignments.

Monorepo with two apps under `apps/`:
- **backend** — FastAPI (Python 3.12, managed by `uv`) at `apps/backend/src/card_sort_api/`
- **frontend** — Astro + React islands at `apps/frontend/`

## Commands

From the repo root (see `Makefile`):
- `make install` — `uv sync` (backend) + `npm install` (frontend)
- `make dev` — run both servers concurrently
- `make dev-backend` — uvicorn on **:8000** (`card_sort_api.main:app --reload`)
- `make dev-frontend` — Astro dev server on **:4321**

There is no test suite, linter, or build step wired up for application code. Frontend build is `cd apps/frontend && npm run build`.

## Architecture & data flow

The two halves of the app correspond to two stages, connected only by a downloaded/uploaded JSON file — there is no database or persistence.

### Stage 1: Card sort (`POST /api/sort`)
1. [SortForm.tsx](apps/frontend/src/components/SortForm.tsx) parses the textarea into a label list and POSTs `{ labels }`.
2. [routers/sort.py](apps/backend/src/card_sort_api/routers/sort.py) streams **Server-Sent Events** (`progress`, `error`, `complete`). The frontend manually parses the SSE stream from the `fetch` body reader.
3. [services/card_sort.py](apps/backend/src/card_sort_api/services/card_sort.py) launches `NUM_AGENTS` (20) agents concurrently via `asyncio.as_completed`. Each agent gets one of the 20 `PERSONAS` and uses `ChatOpenAI(...).with_structured_output(CardSortResult, method="json_schema")` to return bins. Progress events fire as each agent finishes.
4. The terminal `complete` event carries the **`summary`** object: `{ total_agents, labels_sorted, results: [{ agent_id, persona, bins: [{ name, labels }] }] }`. The user downloads this as `summary.json`.

### Stage 2: Analysis (`POST /api/analyze`)
1. [AnalyzeForm.tsx](apps/frontend/src/components/AnalyzeForm.tsx) uploads `summary.json` (multipart) with `k` (cluster count, default 8) and `linkage` (default `ward`).
2. [services/analysis.py](apps/backend/src/card_sort_api/services/analysis.py) is the analysis pipeline (`analyze()`):
   - **Canonical labels** are the union of all labels seen across agents' bins, deduped by `normalize_label`.
   - Agent labels are matched back to canonical labels with **fuzzy matching** (`difflib.get_close_matches`, cutoff 0.75) because the LLM sometimes alters labels despite instructions.
   - Builds a **co-occurrence → similarity matrix** (fraction of agents that placed each pair in the same bin), runs `scipy` `linkage`/`dendrogram`/`fcluster`.
   - Returns Plotly figures (`dendrogram`, `heatmap`) as JSON dicts plus structured `clusters`, rendered by [PlotlyChart.tsx](apps/frontend/src/components/PlotlyChart.tsx) and [ClusterTable.tsx](apps/frontend/src/components/ClusterTable.tsx).

## Conventions & gotchas

- **Frontend → backend** calls go to `/api/*` and are proxied to `localhost:8000` by Vite (`astro.config.mjs`). The backend CORS is hardcoded to allow only `http://localhost:4321`. Both ports matter.
- The OpenAI model and temperature are hardcoded in [card_sort.py](apps/backend/src/card_sort_api/services/card_sort.py) (`run_agents_streaming`). Requires `OPENAI_API_KEY`.
- **`.env` lives at the repo root**, not in `apps/backend/`. `main.py` loads it via `parents[4]` relative to the module file — moving the module changes this path.
- `output/` holds saved run artifacts and is gitignored.
- Astro pages (`src/pages/*.astro`) are static shells; the interactive forms are React islands hydrated with `client:load`.
