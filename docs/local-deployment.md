# CloudDesk — Local Deployment with Docker Compose

This document covers running the CloudDesk API and MongoDB through Docker Compose, with the React client still running locally via `npm run dev`.

---

## Architecture

```
┌──────────────────────────────────────────┐
│  Your Machine                            │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  React SPA (npm run dev)         │    │
│  │  localhost:5173                  │    │
│  │  Vite proxies /api → :5001       │    │
│  └───────────────┬──────────────────┘    │
│                  │ /api/* (proxied)       │
│  ┌───────────────▼──────────────────┐    │
│  │  Docker Compose                  │    │
│  │                                  │    │
│  │  ┌─────────────────────────┐     │    │
│  │  │  clouddesk-api          │     │    │
│  │  │  Express API :5001      │     │    │
│  │  └──────────┬──────────────┘     │    │
│  │             │ Mongoose            │    │
│  │  ┌──────────▼──────────────┐     │    │
│  │  │  clouddesk-mongo        │     │    │
│  │  │  MongoDB :27017         │     │    │
│  │  │  volume: mongo-data     │     │    │
│  │  └─────────────────────────┘     │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

**Why the React client is not containerised yet:**
Vite's dev server with hot-module replacement is not suited to Docker in local development — it requires direct filesystem access for fast rebuilds. The client will be containerised in Stage 2 when it is built as a static bundle and served via CloudFront/S3 or an nginx container.

---

## Environment Validation

The API uses `server/src/config/env.ts` to validate environment variables at startup. When running via Docker Compose:

- `MONGO_URI` and `JWT_SECRET` are both set in `docker-compose.yml` — validation passes automatically
- `NODE_ENV=development` — the default dev admin is auto-created on first run
- `PORT=5001` — the API always listens on 5001
- `CLIENT_URL=http://localhost:5173` — CORS allows the local Vite dev server

You do **not** need a `server/.env` file when using Docker Compose — all values are supplied by the compose file.

---

## Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose plugin)
- Node.js 20+ (for the React client only)

---

## Start API + MongoDB

From the **repo root**:

```bash
docker compose up --build
```

This builds the `clouddesk-api` image from `server/Dockerfile`, starts MongoDB, and brings up both containers. The `--build` flag ensures the image is rebuilt from the current source. On subsequent starts where nothing has changed, `--build` can be omitted:

```bash
docker compose up
```

To run in the background:

```bash
docker compose up -d
```

**Expected output (first run):**

```
clouddesk-mongo  | ... waiting for connections on port 27017 ...
clouddesk-api    | MongoDB connected
clouddesk-api    | [DEV ONLY] Default admin created: admin@clouddesk.com / admin
clouddesk-api    | CloudDesk API running on http://localhost:5001
```

Verify the API is up:

```bash
curl http://localhost:5001/api/health
# → {"status":"ok","service":"CloudDesk API"}
```

---

## Start the React Client

Open a **separate terminal** in the repo root:

```bash
cd client
npm install    # first time only
npm run dev
```

Client runs on `http://localhost:5173`. Vite proxies all `/api/*` requests to `http://localhost:5001` — no CORS configuration needed.

Open `http://localhost:5173` and log in with any demo credential.

---

## Default Dev Admin

On first startup (when `NODE_ENV !== production`), the API auto-creates a default admin:

```
Email:    admin@clouddesk.com
Password: admin
```

This account is skipped silently if it already exists. It is never created in production.

Use this account to:
- Access the full agent/admin ticket view
- Create support agent accounts at `/admin/support-agents/new`
- Browse all KB articles including drafts

---

## Seed Demo Users

The seed script creates three demo accounts if they do not already exist:

| Role | Email | Password |
|---|---|---|
| Requester | requester@clouddesk.dev | Password123! |
| Support Agent | agent@clouddesk.dev | Password123! |
| Admin | admin@clouddesk.dev | Password123! |

Run it against the running containers:

```bash
docker compose exec api npm run seed
```

Safe to re-run — existing accounts are skipped.

---

## Create a Production-Style Admin

The `create-admin` script creates an admin with a validated password (min 8 chars, uppercase, lowercase, number):

```bash
docker compose exec api \
  sh -c 'ADMIN_NAME="Ops Admin" ADMIN_EMAIL="ops@example.com" ADMIN_PASSWORD="StrongPass123!" npm run create-admin'
```

If the email already exists, the script exits without making changes. Multiple admins can be created — each email is independent.

---

## Stop the Stack

Stop containers, keep the MongoDB volume:

```bash
docker compose down
```

Stop and **delete the MongoDB volume** (wipes all data):

```bash
docker compose down -v
```

---

## Common Commands

| Command | What it does |
|---|---|
| `docker compose up --build` | Build and start all services |
| `docker compose up -d` | Start in the background |
| `docker compose down` | Stop containers, keep data |
| `docker compose down -v` | Stop and delete MongoDB volume |
| `docker compose ps` | Show running containers and status |
| `docker compose logs -f api` | Stream API logs |
| `docker compose logs -f mongo` | Stream MongoDB logs |
| `docker compose logs api --tail=50` | Last 50 lines of API logs |
| `docker compose restart api` | Restart the API container |
| `docker compose exec api npm run seed` | Seed demo users |

---

## Troubleshooting

### Port 5001 already in use

Another process is using port 5001 (likely a local `npm run dev` in the server):

```bash
lsof -i :5001          # find the process
kill -9 <PID>           # stop it
docker compose up -d    # retry
```

### Port 27017 already in use

A local MongoDB instance is already running:

```bash
# macOS — if installed with Homebrew
brew services stop mongodb-community

# then retry
docker compose up -d
```

### MongoDB connection refused

The API starts before MongoDB is ready. `restart: unless-stopped` handles transient failures automatically — check logs to confirm it recovered:

```bash
docker compose logs -f api
```

If the API is stuck in a restart loop, check the `MONGO_URI` environment variable in `docker-compose.yml` is `mongodb://mongo:27017/clouddesk`. The hostname `mongo` is the Docker Compose service name — it does not resolve outside the container network.

### Image is stale after code changes

Force a rebuild:

```bash
docker compose up --build
```

### Clear all data and start fresh

```bash
docker compose down -v
docker compose up --build
```

This deletes the MongoDB volume and rebuilds the image from source.

### View live API logs

```bash
docker compose logs -f api
```
