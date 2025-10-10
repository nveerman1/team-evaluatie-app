.PHONY: up down be fe test help

help:
	@echo "Targets:"
	@echo "  up      - Start Postgres & Redis via Docker Compose"
	@echo "  down    - Stop Docker Compose stack"
	@echo "  be      - Run FastAPI dev server"
	@echo "  fe      - Run Next.js dev server"
	@echo "  test    - Run backend tests"

up:
	docker compose -f ops/docker/compose.dev.yml up -d

down:
	docker compose -f ops/docker/compose.dev.yml down

be:
	cd backend && . venv/bin/activate && uvicorn app.main:app --reload --port 8000

fe:
	cd frontend && pnpm dev

test:
	cd backend && . venv/bin/activate && pytest -q
