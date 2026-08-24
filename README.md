# Image Enhancer

A real, working 3-tier application — frontend, backend, and database — covering the complete Docker lifecycle from Dockerfile through Docker Hub to a real domain.

## What It Does

Upload a photo through the web page. The backend genuinely enhances it — resize, brightness/saturation, sharpening, WebP conversion — using [sharp](https://sharp.pixelplumbing.com/), and records every enhancement's settings in a real PostgreSQL database. Enhanced images persist in a volume; metadata persists in the database.

## Architecture

```
Browser
   │  https://your-domain.com  (or http://localhost:8080 locally)
   ▼
frontend (Nginx) ── /api/* ──▶ backend (Node.js + Express + sharp)
                                       │
                                       ▼
                                db (PostgreSQL)
```

## The Full Lifecycle This Project Covers

| Stage | Where |
|---|---|
| Write the Dockerfile | `backend/Dockerfile` (multi-stage), `frontend/Dockerfile` |
| Build the image | `docker build` / `docker compose build` |
| Push to Docker Hub | Guide Part B |
| Pull on a "fresh machine" | Guide Part B |
| Frontend + Backend + DB together | `docker-compose.yml` — 3 services, 1 network, 2 volumes |
| Map a real domain | Guide Part D — Route 53, EC2, Certbot, `docker-compose.prod.yml` |

## Files

```
image_enhancer/
├── docker-compose.yml            # local development — all 3 services
├── docker-compose.prod.yml        # production override — adds HTTPS
├── backend/
│   ├── server.js                  # Express + sharp + pg
│   ├── package.json
│   ├── Dockerfile                 # multi-stage
│   └── .dockerignore
└── frontend/
    ├── index.html / style.css / app.js
    ├── nginx.conf                 # local dev (HTTP only)
    ├── nginx.prod.conf.template    # production (HTTPS) — copy, edit domain, use
    └── Dockerfile
```

## Quick Start (Local)

```bash
docker compose up --build
# Open http://localhost:8080
```

See the companion PDF guide for the complete step-by-step walkthrough of every stage above, including the Docker Hub round-trip and real domain deployment.
