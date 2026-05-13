# Stage 1 Case Study: CloudDesk ITSM Platform

## Project Summary

CloudDesk is a full-stack IT Service Management platform built from scratch as a portfolio project. It replicates the core workflows of enterprise ITSM tools like ServiceNow — ticket submission, triage, escalation, resolution, and knowledge base management — using a modern Node.js/React stack.

Stage 1 delivers a fully functional local MVP demonstrating both IT support workflow understanding and the technical skills to implement it.

---

## Problem Statement

Junior IT support and application support roles increasingly require candidates who can bridge operational and technical knowledge. Most candidates demonstrate one or the other:

- IT support professionals understand service workflows but may lack software development experience
- Junior developers can build applications but may not understand ITSM concepts, ticket lifecycle, or support team structure

A portfolio that demonstrates both — showing *why* a feature works the way it does in a real service desk context, not just *that* it works — stands out in interviews for roles like Service Desk Engineer, Application Support Analyst, and Cloud Support Associate.

CloudDesk was built to answer the question an interviewer might ask: *"Tell me about a project that shows you understand IT support workflows."*

---

## Why This Is Relevant to IT Support Roles

**Service desk engineers** work with ITSM tools daily. Understanding how ticket routing, priority triage, and escalation paths are implemented — not just used — is a practical differentiator.

**Application support analysts** are often expected to investigate issues at the code level, read logs, and understand API behaviour. Building a REST API with structured error responses and role-based access demonstrates this capability directly.

**Cloud support associates** need to understand stateless application architecture, environment-based configuration, and deployment-ready design. CloudDesk is architected for AWS deployment in Stage 2.

---

## Solution Overview

The platform implements three interconnected modules:

**1. Ticket Management**
The core of any ITSM platform. Tickets move through a defined lifecycle (New → Assigned → In Progress → Escalated → Resolved → Closed), with priority and category classification, agent assignment, and both public and internal comment threads. This mirrors the workflow a Tier 1/Tier 2 support team would follow.

**2. Knowledge Base**
Self-service resolution reduces ticket volume. The KB module supports article creation with draft/publish states, category tagging, and full-text search — giving agents a way to document common resolutions and giving requesters a first point of call before raising a ticket.

**3. Dashboard**
Operational visibility is critical for service desk management. The dashboard shows open vs. resolved ticket counts, priority distribution, category breakdown, and recent activity. Metrics are scoped by role — requesters see only their own data; agents and admins see everything.

---

## Features Implemented

| Feature | Technical Detail |
|---|---|
| User registration and login | `POST /api/auth/register` and `/login`, JWT returned, bcrypt hashing |
| JWT authentication | HS256, 7-day expiry, `{ id, role, name }` payload |
| Role-based access control | `authMiddleware` + `requireRole()` middleware, enforced server-side |
| Ticket CRUD | Full create/read/update with category, priority, status, requester |
| Ticket assignment | `PATCH /api/tickets/:id/assign` — validates assignee role, auto-advances New → Assigned |
| Status updates | `PATCH /api/tickets/:id/status` — sets/clears `resolvedAt` automatically |
| Comments | Embedded subdocuments; `isInternal` flag hidden from requesters |
| KB article management | Create, edit, publish/draft, delete (admin only) |
| KB search | `GET /api/kb/search` — title, content, category, tags; unpublished visible to agents |
| Dashboard metrics | 9 parallel MongoDB queries, zero-filled response shape, role-scoped aggregation |
| Assignee dropdown | `GET /api/users/assignees` — returns agents and admins for assignment UI |
| Seed script | `npm run seed` — idempotent demo user creation |

---

## Technical Implementation

### Backend Architecture

The server follows a clean `routes → controllers → models` pattern. Routes are thin — they declare paths and apply middleware. Controllers handle validation, business logic, and response formatting. Models define Mongoose schemas with TypeScript interfaces.

All API errors return `{ message: string }` consistently. This makes frontend error handling predictable and mirrors what you'd see in a production API contract.

Ticket comments are embedded as a subdocument array on the Ticket document rather than a separate collection. This reflects a deliberate trade-off: comments are always accessed in the context of their parent ticket, so embedding avoids a join and simplifies reads. For a platform at this scale, it's the right call.

### Frontend Architecture

The React SPA uses React Context for authentication state and Axios for API calls. The `api/` folder mirrors the server's route structure — one file per domain (`tickets.ts`, `kb.ts`, `dashboard.ts`) — making it easy to locate the call site for any API interaction.

Role-based UI rendering uses the `user.role` value from `AuthContext`. The `ProtectedRoute` component prevents unauthenticated access. Role guards inside agent/admin-only pages (`CreateKnowledgeArticlePage`, `EditKnowledgeArticlePage`) redirect requesters to the KB list rather than showing an error — a better user experience.

### TypeScript Throughout

Both the server and client are fully TypeScript. Mongoose model interfaces (e.g. `ITicket`, `IUser`) provide type safety across the data layer. Frontend types (e.g. `Ticket`, `KnowledgeArticle`, `DashboardData`) mirror the API response shapes. The `express.d.ts` declaration file augments `Request` with `req.user` rather than casting it as `any`.

---

## Support Workflow Thinking

Several implementation decisions reflect real service desk thinking rather than pure technical convenience:

**Auto-advance on assignment:** When a ticket with status `New` is assigned, the status automatically advances to `Assigned`. This mirrors ServiceNow behaviour — an unworked ticket shouldn't stay `New` after someone picks it up.

**resolvedAt automation:** Setting status to `Resolved` automatically records the resolution timestamp. Moving back from `Resolved` clears it. This supports SLA reporting in a future stage without requiring manual timestamp management.

**Internal notes:** Support agents often need to document investigation steps or communicate with each other without the requester seeing it. The `isInternal` flag on comments serves this purpose — visible to agents and admins, hidden from requesters. This is a standard feature in ServiceNow and Zendesk.

**Draft/publish for KB:** Publishing a half-finished article to end users is a common support team mistake. The draft/publish workflow prevents this — agents see drafts; requesters only see published content. Requesting an unpublished article as a requester returns `404`, not `403`, to avoid revealing that draft content exists.

**Assignee validation:** The assign endpoint validates that the target user actually has `support_agent` or `admin` role before assigning. A requester cannot be accidentally assigned a ticket.

---

## Security Considerations

| Concern | Implementation |
|---|---|
| Password storage | bcryptjs with salt rounds 10 — passwords never returned in API responses |
| Authentication | JWT verified server-side on every protected request |
| Authorisation | RBAC enforced in middleware — frontend role checks are UX only |
| Token secret | `JWT_SECRET` in environment variable — not committed to source control |
| Sensitive fields | `select: '-password'` excluded from all user queries; `requester` set from JWT, not request body |
| Input validation | Required field checks on all write endpoints; enum validation via Mongoose schema |
| `.env` files | Listed in `.gitignore`; `.env.example` provides template |

---

## Challenges Solved

**Mongoose aggregate ObjectId casting**
MongoDB's `aggregate()` pipeline does not auto-cast string IDs to ObjectId in `$match` stages, unlike `find()` and `countDocuments()`. The dashboard's role-scoped filter required `new mongoose.Types.ObjectId(req.user.id)` explicitly to avoid silent query failures.

**White page after status update**
An early bug caused the ticket detail page to crash after updating status or assigning a ticket. The root cause: the `updateStatus` and `assignTicket` controllers populated `requester` and `assignedTo` but not `comments.author`. When `setTicket(updated)` replaced state with the response, `comments[].author` was a raw ObjectId string. The render then attempted `comment.author.role.replace('_', ' ')` — a `TypeError` on `undefined.replace` that crashed the React tree silently.

Fix: add `{ path: 'comments.author', select: 'name email role' }` to the populate arrays in both handlers, and change the action buttons from `type="submit"` inside `<form>` wrappers to `type="button"` with `onClick` handlers.

**Express route ordering for /search**
Registering `GET /api/kb/:id` before `GET /api/kb/search` caused the string `"search"` to be treated as a document ID, producing a MongoDB ObjectId cast error. Fix: register `/search` before `/:id` in `kb.ts`. React Router v6 handles the equivalent `/kb/new` vs `/kb/:id` conflict automatically using its path ranking algorithm.

---

## What I Learned

- Designing a REST API with consistent error shapes and predictable response structures makes frontend development significantly faster — the decision to standardise `{ message: string }` paid off across every page.
- Embedded subdocuments (comments on Ticket) are a good fit for tightly coupled data that is always queried together. Knowing when *not* to normalise is as important as knowing when to.
- Role-based access control belongs in the API, not the UI. Building both layers of enforcement creates a natural mental model: the frontend is responsible for experience, the backend is responsible for security.
- TypeScript type interfaces shared between models and frontend types catch a large class of bugs at compile time. The `TicketUser` vs `IUser` distinction (populated object vs ObjectId) is a good example — the type system forces you to be explicit about what shape data is in at each layer.

---

## Future Improvements

Stage 2–4 plans are documented in [future-roadmap.md](future-roadmap.md). Highlights:

- **AWS deployment** — ECS/EC2 + MongoDB Atlas + S3 for a production-grade hosting setup
- **CloudWatch monitoring** — API error rates, latency tracking, SLA breach alerting
- **ServiceNow workflow mapping** — Model CloudDesk's ticket lifecycle against ServiceNow's incident and request management modules
- **Email notifications** — SES notifications on ticket assignment, status change, and comment
- **SLA rules** — Priority-based response time targets with breach escalation
