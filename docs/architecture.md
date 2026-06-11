# CloudDesk ITSM Platform — Architecture

## System Overview

CloudDesk is a full-stack ITSM platform built as a monorepo with a clear separation between the React frontend (`client/`) and the Express REST API (`server/`). In development, Vite proxies all `/api` requests to the server, eliminating CORS configuration. In production (Stage 2), both services would be independently deployed on AWS infrastructure.

```
┌─────────────────────────────────────────┐
│           Browser — React SPA           │
│           Vite dev server :5173         │
│                                         │
│  AuthContext → ProtectedRoute → Pages   │
│  Axios /api/* (proxied to :5001)        │
└──────────────────┬──────────────────────┘
                   │ HTTP/JSON
                   ▼
┌─────────────────────────────────────────┐
│         Express REST API :5001          │
│                                         │
│  authMiddleware → requireRole()         │
│  routes → controllers → Mongoose       │
└──────────────────┬──────────────────────┘
                   │ Mongoose ODM
                   ▼
┌─────────────────────────────────────────┐
│               MongoDB                   │
│    collections: users · tickets · kb   │
└─────────────────────────────────────────┘
```

---

## Client/Server Structure

### Server (`server/`)

```
server/src/
├── index.ts              # Express app bootstrap, MongoDB connect
├── routes/               # Route definitions — thin, delegate to controllers
│   ├── auth.ts
│   ├── tickets.ts
│   ├── kb.ts
│   ├── dashboard.ts
│   └── users.ts
├── controllers/          # Request handlers — validation, business logic, response
│   ├── authController.ts
│   ├── ticketController.ts
│   ├── kbController.ts
│   ├── dashboardController.ts
│   └── userController.ts
├── models/               # Mongoose schemas and TypeScript interfaces
│   ├── User.ts
│   ├── Ticket.ts
│   └── KnowledgeArticle.ts
├── middleware/
│   └── auth.ts           # authMiddleware + requireRole()
├── scripts/
│   ├── seed.ts           # Demo user seeder
│   └── createAdmin.ts    # Production admin creation CLI
└── types/
    └── express.d.ts      # Augments Express Request with req.user
```

### Client (`client/src/`)

```
client/src/
├── App.tsx               # BrowserRouter, route definitions, PublicRoute/ProtectedRoute/AdminRoute
├── context/
│   └── AuthContext.tsx   # JWT storage, user state, rehydration from localStorage
├── components/
│   ├── AppLayout.tsx     # Sidebar navigation, user info, sign out; admin-only nav section
│   ├── ProtectedRoute.tsx  # Redirects unauthenticated users to /login
│   └── AdminRoute.tsx    # Extends ProtectedRoute — also redirects non-admins to /dashboard
├── pages/
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── DashboardPage.tsx
│   ├── TicketsPage.tsx
│   ├── TicketDetailPage.tsx
│   ├── CreateTicketPage.tsx
│   ├── KnowledgeBasePage.tsx
│   ├── KnowledgeArticlePage.tsx
│   ├── CreateKnowledgeArticlePage.tsx
│   ├── EditKnowledgeArticlePage.tsx
│   └── CreateSupportAgentPage.tsx  # Admin-only; creates support_agent accounts
├── api/                  # Axios wrappers — one file per domain
│   ├── http.ts           # Axios instance with Bearer token interceptor
│   ├── tickets.ts
│   ├── kb.ts
│   ├── dashboard.ts
│   └── users.ts
└── types/                # Shared TypeScript interfaces
    ├── auth.ts
    ├── ticket.ts
    ├── kb.ts
    ├── dashboard.ts
    └── user.ts
```

---

## Authentication Flow

1. User submits credentials to `POST /api/auth/login`
2. Server validates email and password against the stored bcrypt hash
3. On success, server signs a JWT with payload `{ id, role, name }` and returns it with the user object
4. Client stores the JWT in `localStorage` and updates `AuthContext`
5. All subsequent API requests attach the token as `Authorization: Bearer <token>` via an Axios request interceptor in `api/http.ts`
6. `authMiddleware` on the server verifies the token on every protected route and attaches `req.user` to the request object
7. On logout, the client removes the token from `localStorage` and clears `AuthContext`

**Token details:**
- Algorithm: HS256 (HMAC-SHA256)
- Expiry: 7 days
- Payload: `{ id: string, role: UserRole, name: string }`
- Secret: `JWT_SECRET` environment variable

**Flash prevention:** `AuthContext` sets `isLoading = true` until localStorage rehydration completes. `ProtectedRoute` returns `null` while loading, preventing the unauthenticated redirect flash on page refresh.

---

## Role-Based Access Control

Three roles are defined on the `User` model and encoded in the JWT:

| Role | Description |
|---|---|
| `requester` | End users who submit and track tickets |
| `support_agent` | IT support staff who triage, update, and resolve tickets |
| `admin` | Full access including KB article deletion and support agent account creation |

RBAC is enforced at the API level using `requireRole(...roles)` middleware — it is not sufficient to manipulate the UI. Requesters who attempt agent/admin endpoints receive a `403 Forbidden` response regardless of the frontend state.

**Client-side RBAC** only affects UI rendering (showing/hiding buttons and forms). It is not a security boundary — all enforcement happens server-side.

**Account creation model:**
- `requester` — self-registration via `POST /api/auth/register`. Any `role` field in the body is silently ignored.
- `support_agent` — created by an admin via `POST /api/users/support-agents` (frontend: `/admin/support-agents/new`). Public registration cannot create this role.
- `admin` — created via the `create-admin` CLI script in production (`npm run create-admin` in `server/`). In development, a default admin (`admin@clouddesk.com / admin`) is auto-created at startup when `NODE_ENV !== production`.

The `AdminRoute` component wraps admin-only frontend pages. It redirects unauthenticated users to `/login` and non-admin authenticated users to `/dashboard`.

---

## Ticket Lifecycle

```
New → Assigned → In Progress → Escalated → Resolved → Closed
```

| Status | Description |
|---|---|
| New | Ticket submitted, not yet assigned |
| Assigned | Assigned to an agent — triggered automatically on `PATCH /assign` if status is New |
| In Progress | Agent actively working on the issue |
| Escalated | Issue requires higher-level attention |
| Resolved | Issue resolved — `resolvedAt` timestamp set automatically |
| Closed | Ticket closed after resolution |

Transitions are unrestricted — agents can set any status. Moving back from `Resolved` to another status automatically clears `resolvedAt`. Status transitions are intentionally open to support real support workflows where tickets may need to be re-opened.

**Priority levels:** Low · Medium · High · Critical

**Categories:** Hardware · Software · Access Request · Network · Cloud · Application Issue · General Support

---

## Knowledge Base Flow

1. Agents and admins create articles (default `isPublished: false` — draft state)
2. Draft articles are visible to agents/admins with the `?includeUnpublished=true` query parameter
3. When ready, agents toggle `isPublished: true` to make the article visible to requesters
4. Requesters see only published articles — requesting a draft article returns `404` (not `403`) to avoid revealing draft content exists
5. Admins can delete articles; agents can create and edit but not delete

Search (`GET /api/kb/search`) supports `q` (title/content match), `category`, and `tags` parameters. The `/search` route is registered before `/:id` in the Express router to prevent `"search"` being treated as a document ID.

---

## Dashboard Metrics Flow

`GET /api/dashboard` runs nine parallel MongoDB queries using `Promise.all`:

- `countDocuments` for totalTickets, openTickets, resolvedTickets, criticalTickets, highPriorityTickets
- Three `aggregate` pipelines for ticketsByStatus, ticketsByPriority, ticketsByCategory
- One `find` for recentTickets (5 most recent, populated)

**Role scoping:** Requesters receive metrics for their own tickets only (filter: `{ requester: userId }`). Agents and admins receive metrics across all tickets. The filter is applied consistently across all nine queries.

**Aggregate ObjectId casting:** Mongoose `aggregate()` does not auto-cast string IDs to ObjectId in `$match` stages. The requester filter uses `new mongoose.Types.ObjectId(req.user.id)` explicitly.

**Zero-fill:** All status, priority, and category keys are guaranteed present in the response even when count is 0, using a `toCountMap()` helper that fills missing enum values.

---

## Data Model Summary

### User

| Field | Type | Notes |
|---|---|---|
| `name` | String | Required, trimmed |
| `email` | String | Required, unique, lowercase |
| `password` | String | bcrypt hash — never returned in API responses |
| `role` | String | `requester` \| `support_agent` \| `admin` |

### Ticket

| Field | Type | Notes |
|---|---|---|
| `title` | String | Required |
| `description` | String | Required |
| `category` | String | Enum — 7 values |
| `priority` | String | Enum: Low / Medium / High / Critical |
| `status` | String | Enum: New / Assigned / In Progress / Escalated / Resolved / Closed |
| `requester` | ObjectId ref User | Set from JWT — not accepted from request body |
| `assignedTo` | ObjectId ref User | Optional |
| `comments` | Subdocument array | Embedded — no separate collection |
| `resolvedAt` | Date | Set automatically when status → Resolved |

**Comment subdocument:** `body`, `author` (ref User), `isInternal` (boolean), `createdAt`

### KnowledgeArticle

| Field | Type | Notes |
|---|---|---|
| `title` | String | Required |
| `content` | String | Required |
| `category` | String | Same enum as Ticket category |
| `tags` | String array | Optional |
| `author` | ObjectId ref User | Set from JWT |
| `isPublished` | Boolean | Default false (draft) |

---

## API Error Shape

All API errors return a consistent shape:

```json
{ "message": "string" }
```

HTTP status codes follow REST conventions: `400` (validation), `401` (unauthenticated), `403` (forbidden), `404` (not found), `500` (server error).

---

## Stage 2 — AWS Deployment Plan

> This section describes planned future infrastructure. It is not implemented in Stage 1.

```
┌──────────────────────────────────────────────────────────┐
│  Route 53 — DNS                                          │
└────────────────────┬─────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌───────────────┐        ┌────────────────────┐
│  CloudFront   │        │  Application LB    │
│  + S3 Bucket  │        │                    │
│  (React SPA)  │        │  ECS Fargate Task  │
└───────────────┘        │  (Express API)     │
                         └─────────┬──────────┘
                                   │
                         ┌─────────▼──────────┐
                         │  MongoDB Atlas     │
                         │  (managed cluster) │
                         └────────────────────┘
```

**Planned components:**

| Component | Service |
|---|---|
| Static frontend hosting | S3 + CloudFront |
| API hosting | ECS Fargate or EC2 |
| Database | MongoDB Atlas |
| Secrets management | AWS Secrets Manager |
| DNS | Route 53 |
| Object storage (attachments) | S3 |
| Logs and monitoring | CloudWatch |
| IAM | Least-privilege roles per service |

The Express API is stateless (JWT auth, no server-side session), making it straightforward to run in containers or behind an auto-scaling group.

---

## Phase 7 — Scalable Target Architecture

The staged migration from the current single-EC2 deployment to a fully managed, horizontally scalable setup is documented in [`docs/scalability-plan.md`](scalability-plan.md).

The target architecture replaces the direct EC2 origin with ECS Fargate tasks behind an Application Load Balancer:

```
Browser
  ↓
CloudFront
  ├── Default (*) → S3 React Frontend
  └── /api/* → Application Load Balancer
                    ↓
             ECS Fargate Service
             ├── API Task 1
             ├── API Task 2
             └── API Task N (autoscaled)
                    ↓
             MongoDB Atlas
```

Key properties of this target state: immutable images in ECR, rolling deploys via ECS service updates, ALB health checks using the existing `/api/health/ready` endpoint, CloudWatch Logs for durable log storage, and SSM Parameter Store for runtime secrets. The Express API requires no application-level changes to run in this configuration — the stateless JWT design, health endpoints, and graceful shutdown are already in place. Rate limiting must move to a Redis-backed store before multiple tasks run behind the ALB.

See [`docs/scalability-plan.md`](scalability-plan.md) for the full migration roadmap, scale-readiness checklist, and cost-control guidance.
