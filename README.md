# CloudDesk ITSM Platform

A ServiceNow-inspired IT Service Management platform built as a portfolio project. Demonstrates ticket management, knowledge base, role-based access control, and JWT authentication.

Built to show: IT support workflow understanding, ticket triage, incident handling, escalation workflow, RBAC, and backend API design — targeting Australian IT support and junior developer roles.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB, Mongoose |
| Auth | JWT, bcryptjs |

---

## Project Structure

```
clouddesk-itsm/
├── server/    # Express API (port 5000)
├── client/    # React frontend (port 5173)
└── docs/      # Architecture, API reference, case study, roadmap
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB running locally, or a MongoDB Atlas URI

### 1. Clone the repo

```bash
git clone https://github.com/musahx/clouddesk-itsm.git
cd clouddesk-itsm
```

### 2. Set up the server

```bash
cd server
npm install
cp .env.example .env
# Edit .env — set MONGO_URI and JWT_SECRET
npm run dev
```

Server runs on `http://localhost:5000`.

### 3. Set up the client

```bash
cd client
npm install
npm run dev
```

Client runs on `http://localhost:5173`. All `/api` requests proxy to the server automatically.

---

## Verify It Works

```bash
curl http://localhost:5000/api/health
# → { "status": "ok", "service": "CloudDesk API" }
```

---

## Demo Users

Seed script coming in the auth step. Planned credentials:

| Role | Email | Password |
|------|-------|----------|
| Requester | requester@clouddesk.dev | Password123! |
| Support Agent | agent@clouddesk.dev | Password123! |
| Admin | admin@clouddesk.dev | Password123! |

---

## Documentation

- [Architecture](docs/architecture.md)
- [API Reference](docs/api.md)
- [Stage 1 Case Study](docs/stage-1-case-study.md)
- [Future Roadmap](docs/future-roadmap.md)

---

## Stage 1 Progress

- [x] Project scaffold
- [ ] Backend auth (register, login, JWT)
- [ ] Backend tickets (CRUD, status, comments)
- [ ] Backend knowledge base
- [ ] Frontend auth pages
- [ ] Frontend ticket pages
- [ ] Frontend knowledge base
- [ ] Dashboard
- [ ] Seed script
- [ ] Documentation and screenshots
