# Fleetrac Monorepo (MVP Scaffold)

Fleetrac is an observability-driven governance platform for production AI systems.
This repository contains a clean MVP scaffold with a Next.js frontend and FastAPI backend.

## Monorepo Layout

- `apps/web` - Next.js (App Router) frontend for dashboard, incidents, rules, and systems.
- `apps/api` - FastAPI backend with starter routes and placeholder services.
- `packages/shared` - Shared entity contracts and docs for frontend/backend alignment.

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+

### Frontend (`apps/web`)

1. `cd apps/web`
2. `npm install`
3. `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000)

### Backend (`apps/api`)

1. `cd apps/api`
2. `python -m venv .venv`
3. `source .venv/bin/activate`
4. `pip install -r requirements.txt`
5. `uvicorn main:app --reload --port 8000`
6. Open [http://localhost:8000/docs](http://localhost:8000/docs)

## MVP Notes

- This is starter boilerplate only (no production auth or infra).
- API responses are mock/sample placeholders.
- Database wiring is intentionally minimal and not connected.
- Shared contracts live in `packages/shared/contracts`.
