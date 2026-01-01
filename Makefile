.PHONY: up down be fe test worker help

help:
	@echo "Targets:"
	@echo "  up      - Start Postgres & Redis via Docker Compose"
	@echo "  down    - Stop Docker Compose stack"
	@echo "  be      - Run FastAPI dev server"
	@echo "  fe      - Run Next.js dev server"
	@echo "  worker  - Run RQ worker for async jobs"
	@echo "  test    - Run backend tests"

up:
	docker compose -f ops/docker/compose.dev.yml up -d

down:
	docker compose -f ops/docker/compose.dev.yml down

be:
	cd backend && . venv/bin/activate && uvicorn app.main:app --reload --port 8000

fe:
	cd frontend && pnpm dev

worker:
	cd backend && . venv/bin/activate && python worker.py

test:
	cd backend && . venv/bin/activate && pytest -q
