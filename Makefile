.PHONY: dev dev-backend dev-frontend install

dev:
	make -j2 dev-backend dev-frontend

dev-backend:
	cd apps/backend && uv run uvicorn card_sort_api.main:app --reload --port 8000

dev-frontend:
	cd apps/frontend && npm run dev

install:
	cd apps/backend && uv sync
	cd apps/frontend && npm install
