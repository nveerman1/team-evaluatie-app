# CI/CD Documentation

This document explains the Continuous Integration and Continuous Deployment (CI/CD) pipeline for the Team Evaluatie App using GitHub Actions.

## Table of Contents

1. [Overview](#overview)
2. [CI Pipeline](#ci-pipeline)
3. [Security Scanning](#security-scanning)
4. [Deployment Pipeline](#deployment-pipeline)
5. [Workflow Configuration](#workflow-configuration)
6. [Best Practices](#best-practices)

---

## Overview

The Team Evaluatie App uses **GitHub Actions** for automated testing, security scanning, and deployment. The CI/CD pipeline consists of three main workflows:

1. **CI Workflow** (`ci.yml`): Runs on every push and pull request
2. **Security Workflow** (`security.yml`): Runs on push, PR, and weekly schedule
3. **Deploy Workflow** (`deploy.yml`): Manual or automatic deployment to production

### Workflow Triggers

```yaml
# CI: Runs on push to main and all pull requests
on:
  push:
    branches: [ main ]
  pull_request:

# Security: Runs on push, PR, and weekly schedule
on:
  push:
    branches: [ main ]
  pull_request:
  schedule:
    - cron: "30 6 * * 1"  # Every Monday at 06:30 UTC

# Deploy: Manual trigger or automatic on main push
on:
  workflow_dispatch:  # Manual trigger
  # push:
  #   branches: [ main ]  # Optional: Auto-deploy on main
```

---

## CI Pipeline

The CI pipeline (`ci.yml`) validates code quality, runs tests, and performs security checks for both backend and frontend.

### Pipeline Overview

```
┌─────────────────┐
│  Code Push/PR   │
└────────┬────────┘
         │
    ┌────▼─────┐
    │ CI Start │
    └────┬─────┘
         │
    ┌────▼──────────┐     ┌──────────────┐
    │ Backend Job   │     │ Frontend Job │
    │               │     │              │
    │ 1. Setup      │     │ 1. Setup     │
    │ 2. Install    │     │ 2. Install   │
    │ 3. Lint       │     │ 3. Build     │
    │ 4. Type Check │     └──────────────┘
    │ 5. Test       │
    │ 6. Security   │
    └───────────────┘
```

### Backend Job

The backend job runs Python-based quality checks and tests:

```yaml
backend:
  name: Backend (FastAPI) – Lint/Type/Test
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: backend

  steps:
    - uses: actions/checkout@v4.2.2
    
    - uses: actions/setup-python@v5.3.0
      with:
        python-version: '3.12'
        cache: 'pip'
        cache-dependency-path: backend/requirements-ci.txt
    
    - name: Install deps
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements-ci.txt
    
    - name: Ruff (lint)
      run: ruff check . --output-format=github --exit-zero
    
    - name: Black (format check)
      run: black --check .
    
    - name: Mypy (type check)
      run: mypy app
      continue-on-error: true
    
    - name: Pytest
      run: pytest -q
      continue-on-error: true
    
    - name: Bandit (security lint)
      run: bandit -r app -x tests,migrations -q
    
    - name: pip-audit (dependency vulnerabilities)
      run: pip-audit -r requirements-ci.txt --strict --progress-spinner off
```

### Frontend Job

The frontend job validates Next.js build and dependencies:

```yaml
frontend:
  name: Frontend (Next.js) – Build
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: frontend

  steps:
    - uses: actions/checkout@v4.2.2
    
    - uses: actions/setup-node@v4.1.0
      with:
        node-version: 'lts/*'
    
    - name: Enable pnpm via Corepack
      run: |
        corepack enable
        corepack prepare pnpm@latest --activate
        pnpm --version
    
    - name: Install
      run: |
        if [ -f pnpm-lock.yaml ]; then
          pnpm install --frozen-lockfile
        else
          pnpm install
        fi
    
    - name: Build
      run: pnpm build
```

### Quality Checks

#### Backend Quality Tools

| Tool | Purpose | Configuration |
|------|---------|---------------|
| **Ruff** | Fast Python linter | `.ruff.toml` |
| **Black** | Code formatter | `pyproject.toml` |
| **Mypy** | Static type checker | `mypy.ini` |
| **Pytest** | Testing framework | `pytest.ini` |
| **Bandit** | Security linter | Inline config |
| **pip-audit** | Dependency scanner | CLI flags |

#### Frontend Quality Tools

| Tool | Purpose | Configuration |
|------|---------|---------------|
| **ESLint** | JavaScript/TypeScript linter | `eslint.config.mjs` |
| **TypeScript** | Type checker | `tsconfig.json` |
| **Next.js Build** | Build verification | `next.config.ts` |

---

## Security Scanning

The security workflow (`security.yml`) performs comprehensive vulnerability scanning using multiple tools.

### Security Pipeline Overview

```
┌──────────────────┐
│ Security Trigger │
└────────┬─────────┘
         │
    ┌────▼────────────────────┐
    │ Three Parallel Jobs:    │
    │                         │
    │ 1. Frontend Lockfile    │
    │ 2. Backend SBOM         │
    │ 3. Docker Images        │
    └─────────────────────────┘
```

### 1. Frontend Lockfile Scanning

Scans `pnpm-lock.yaml` for known vulnerabilities using OSV-Scanner:

```yaml
frontend_lockfile_scan:
  name: Frontend lockfile scan (OSV)
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    
    - name: OSV scan pnpm-lock.yaml
      run: |
        docker run --rm -v "$PWD:/src" ghcr.io/google/osv-scanner:v2.3.1 \
          scan -L /src/frontend/pnpm-lock.yaml
```

**What it catches:**
- Known vulnerabilities in npm packages
- Outdated dependencies with security issues
- Transitive dependency vulnerabilities

### 2. Backend SBOM Scanning

Generates a Software Bill of Materials (SBOM) and scans for vulnerabilities:

```yaml
backend_sbom_scan:
  name: Backend SBOM scan (CycloneDX -> OSV)
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v5
      with:
        python-version: "3.12"
    
    - name: Install backend deps in venv
      run: |
        python -m venv backend/.venv
        source backend/.venv/bin/activate
        pip install -r backend/requirements.txt
        pip install cyclonedx-bom
    
    - name: Generate CycloneDX SBOM
      run: |
        backend/.venv/bin/python -m cyclonedx_py environment \
          --of json -o backend.cdx.json
    
    - name: OSV scan SBOM
      run: |
        docker run --rm -v "$PWD:/src" ghcr.io/google/osv-scanner:latest \
          scan -L /src/backend.cdx.json
```

**What it catches:**
- Python package vulnerabilities
- Supply chain risks
- Dependency conflicts

### 3. Docker Image Scanning

Scans Docker images for vulnerabilities using Trivy:

```yaml
trivy_images:
  name: Trivy (docker images)
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
    
    - name: Build images
      run: |
        docker build -t tea-backend:ci -f backend/Dockerfile backend
        docker build -t tea-frontend:ci -f frontend/Dockerfile frontend
    
    - name: Trivy scan backend
      uses: aquasecurity/trivy-action@0.33.1
      with:
        scan-type: image
        image-ref: tea-backend:ci
        severity: HIGH,CRITICAL
        ignore-unfixed: true
        exit-code: 1
    
    - name: Trivy scan frontend
      uses: aquasecurity/trivy-action@0.33.1
      with:
        scan-type: image
        image-ref: tea-frontend:ci
        severity: HIGH,CRITICAL
        ignore-unfixed: true
        exit-code: 1
    
    - name: Trivy scan nginx
      uses: aquasecurity/trivy-action@0.33.1
      with:
        scan-type: image
        image-ref: nginx:stable-alpine
        severity: HIGH,CRITICAL
        ignore-unfixed: true
        exit-code: 1
```

**What it catches:**
- OS-level vulnerabilities
- Misconfigured containers
- Exposed secrets in images
- Vulnerable base images

### Security Scanning Schedule

- **On Push/PR**: All security scans run
- **Weekly**: Scheduled scan every Monday at 06:30 UTC
- **Manual**: Can be triggered manually via GitHub UI

---

## Deployment Pipeline

The deployment workflow (`deploy.yml`) automates production deployments to a VPS.

### Deployment Flow

```
┌─────────────────────┐
│ Manual Trigger      │
│ (workflow_dispatch) │
└──────────┬──────────┘
           │
      ┌────▼─────────────┐
      │ Build & Test     │
      │ - Backend tests  │
      │ - Frontend build │
      └────┬─────────────┘
           │
      ┌────▼──────────────┐
      │ Deploy to VPS     │
      │ - SSH to VPS      │
      │ - Pull code       │
      │ - Run deploy.sh   │
      │ - Verify          │
      └────┬──────────────┘
           │
      ┌────▼───────────────┐
      │ Post-deployment    │
      │ - Health checks    │
      │ - Verify services  │
      └────────────────────┘
```

### Deployment Jobs

#### 1. Build and Test

Validates code before deployment:

```yaml
build-and-test:
  name: Build and Test
  runs-on: ubuntu-latest
  
  steps:
    - uses: actions/checkout@v4.2.2
    
    - name: Set up Python
      uses: actions/setup-python@v5.3.0
      with:
        python-version: '3.11'
    
    - name: Run backend tests
      run: |
        cd backend
        pip install -r requirements-dev.txt
        pytest -v --tb=short
    
    - name: Build frontend
      run: |
        cd frontend
        npm ci
        npm run build
```

#### 2. Deploy to VPS

Connects to VPS via SSH and executes deployment:

```yaml
deploy:
  name: Deploy to VPS
  runs-on: ubuntu-latest
  needs: build-and-test
  
  environment:
    name: production
    url: https://yourdomain.com
  
  steps:
    - name: Setup SSH
      run: |
        mkdir -p ~/.ssh
        echo "${{ secrets.VPS_SSH_KEY }}" > ~/.ssh/id_rsa
        chmod 600 ~/.ssh/id_rsa
        ssh-keyscan -H ${{ secrets.VPS_HOST }} >> ~/.ssh/known_hosts
    
    - name: Deploy to VPS
      run: |
        ssh ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }} << 'ENDSSH'
          cd /opt/team-evaluatie-app
          git pull origin main
          bash scripts/deploy.sh
        ENDSSH
    
    - name: Health check
      run: |
        sleep 30
        if curl -f -s https://yourdomain.com/health > /dev/null; then
          echo "✅ Site is up and healthy"
        else
          echo "❌ Site health check failed"
          exit 1
        fi
```

#### 3. Post-deployment Checks

Verifies deployment success:

```yaml
post-deployment:
  name: Post-deployment Checks
  runs-on: ubuntu-latest
  needs: deploy
  
  steps:
    - name: Check site availability
      run: |
        for i in {1..5}; do
          if curl -f -s https://yourdomain.com/health > /dev/null; then
            echo "Attempt $i: Site is healthy"
            exit 0
          fi
          sleep 10
        done
        exit 1
    
    - name: Check API health
      run: |
        curl -f -s https://yourdomain.com/api/v1/health
```

### Required Secrets

Configure these secrets in GitHub repository settings:

| Secret | Description | Example |
|--------|-------------|---------|
| `VPS_HOST` | VPS IP or hostname | `1.2.3.4` |
| `VPS_USER` | SSH user | `deploy` |
| `VPS_SSH_KEY` | Private SSH key | `-----BEGIN...` |
| `GHCR_TOKEN` | GitHub registry token | `ghp_...` (optional) |

### Deployment Options

The workflow supports manual trigger options:

- **Skip Backup**: `--no-backup` flag (faster, but riskier)
- **Skip Build**: `--no-build` flag (reuse existing images)

```yaml
workflow_dispatch:
  inputs:
    skip_backup:
      description: 'Skip database backup'
      type: boolean
      default: false
    skip_build:
      description: 'Skip Docker image rebuild'
      type: boolean
      default: false
```

---

## Workflow Configuration

### Action Pinning

For security, actions are pinned to specific commit SHAs:

```yaml
# Bad: Using mutable tags
- uses: actions/checkout@v4

# Good: Pinned to commit SHA
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
```

### Concurrency Control

Prevents concurrent deployments:

```yaml
concurrency:
  group: production-deployment
  cancel-in-progress: false
```

### Environment Protection

Use GitHub Environments for additional protection:

```yaml
environment:
  name: production
  url: https://yourdomain.com
```

Add protection rules in GitHub:
- Required reviewers
- Wait timer
- Deployment branches

---

## Best Practices

### 1. Fast Feedback

- **Fail fast**: Run quick checks first (linting, formatting)
- **Parallel jobs**: Run backend and frontend in parallel
- **Caching**: Use dependency caching to speed up builds

```yaml
- uses: actions/setup-python@v5
  with:
    cache: 'pip'
    cache-dependency-path: backend/requirements-ci.txt
```

### 2. Security First

- **Pin actions**: Use commit SHAs instead of tags
- **Least privilege**: Use minimal permissions
- **Secret scanning**: Enable GitHub secret scanning
- **Dependency scanning**: Run on schedule (weekly)

```yaml
permissions:
  contents: read  # Minimal permissions
```

### 3. Reliable Deployments

- **Health checks**: Verify deployment success
- **Rollback plan**: Have automated rollback capability
- **Database backups**: Always backup before deploy
- **Blue-green deployments**: Consider zero-downtime deploys

### 4. Monitoring and Alerts

- **Deployment notifications**: Send alerts on failure
- **Status badges**: Display CI status in README
- **Logs**: Preserve build logs for debugging

```markdown
![CI](https://github.com/user/repo/actions/workflows/ci.yml/badge.svg)
```

### 5. Development Workflow

```
1. Developer pushes code
2. CI runs automatically (lint, test, security)
3. PR review + approval
4. Merge to main
5. (Optional) Auto-deploy or manual trigger
6. Post-deployment verification
```

---

## Troubleshooting

### Common Issues

#### 1. SSH Connection Fails

```bash
# Debug: Add SSH connection test
- name: Test SSH
  run: ssh -v ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }} "echo OK"
```

#### 2. Docker Build Fails

```bash
# Debug: Check Docker version and logs
- name: Debug Docker
  run: |
    docker --version
    docker compose version
    docker compose ps
    docker compose logs
```

#### 3. Tests Fail in CI

```bash
# Run tests locally in similar environment
docker run --rm -it -v $(pwd):/app -w /app python:3.12 bash
pip install -r requirements-dev.txt
pytest -v
```

#### 4. Security Scan False Positives

```yaml
# Ignore specific vulnerabilities (use cautiously)
- name: OSV scan
  run: |
    osv-scanner scan -L file.lock || true  # Continue on error
```

---

## Related Documentation

- [Testing Guide](./testing.md) - Testing strategies and examples
- [Deployment Guide](./PRODUCTION_DEPLOYMENT.md) - Manual deployment procedures
- [Operations Guide](./OPERATIONS.md) - Day-to-day operations
- [Security Guide](../SECURITY.md) - Security best practices
- [GitHub Actions Docs](https://docs.github.com/en/actions) - Official documentation
