# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# CloudDesk ITSM Platform - Claude Instructions

## Project Overview

CloudDesk is a ServiceNow-inspired ITSM support platform for my portfolio. It demonstrates IT support workflows, ticketing, knowledge base management, authentication, role-based access, backend development, documentation, and future AWS deployment readiness.

This project is for Australian employers hiring for:
- Service Desk Engineer
- IT Support Engineer
- Application Support Analyst
- Cloud Support Associate
- Junior Backend Developer
- Graduate Technology Consultant

## Stage 1 Goal

Build the local MVP of the support platform.

Stage 1 includes:
- User registration and login
- JWT authentication
- Role-based access control
- Ticket creation
- Ticket listing
- Ticket detail view
- Ticket status updates
- Ticket priority and category
- Ticket comments
- Knowledge base articles
- Basic support/admin dashboard
- Clean README and documentation

Stage 1 excludes:
- AWS deployment
- CloudWatch
- S3 attachments
- CI/CD deployment
- Real ServiceNow integration
- Advanced monitoring dashboard

These will be handled in later stages.

## Tech Stack

Frontend:
- React
- Vite
- TypeScript
- Tailwind CSS

Backend:
- Node.js
- Express
- TypeScript
- MongoDB
- Mongoose
- JWT
- bcrypt

Development:
- GitHub
- Postman or Bruno
- VS Code
- Claude Code

## Project Structure

```
clouddesk-itsm/
├── server/           # Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── routes/       # Express route definitions
│   │   ├── controllers/  # Request handlers
│   │   ├── models/       # Mongoose models
│   │   └── middleware/   # Auth, RBAC, error handling
│   ├── .env              # PORT, MONGO_URI, JWT_SECRET
│   └── tsconfig.json
├── client/           # React + Vite + TypeScript + Tailwind
│   ├── src/
│   │   ├── pages/        # Route-level page components
│   │   ├── components/   # Reusable UI components
│   │   ├── context/      # React context (auth, etc.)
│   │   ├── api/          # Axios/fetch wrappers
│   │   └── types/        # Shared TypeScript interfaces
│   └── vite.config.ts
└── docs/             # Architecture, API, case study, roadmap
```

## Dev Commands

**Server** (from `server/`):
```bash
npm run dev     # ts-node-dev with watch
npm run build   # tsc compile to dist/
npm start       # node dist/index.js
```

**Client** (from `client/`):
```bash
npm run dev     # Vite dev server
npm run build   # Production build
npm run preview # Preview production build
```

Both services run in dev simultaneously. Server defaults to `:5000`. The Vite dev server proxies `/api` requests to it.

## Architecture

**Auth flow:** `POST /api/auth/register` and `POST /api/auth/login` return a JWT. The client stores it in `localStorage` via `AuthContext` and attaches it as `Authorization: Bearer <token>` on every API request. The server `authMiddleware` verifies the token and attaches `req.user`. RBAC middleware then checks `req.user.role` against the roles permitted for each route.

**Three roles:** `requester`, `support_agent`, `admin`. Role is stored on the User model and encoded in the JWT payload.

**Ticket lifecycle:** `New → Assigned → In Progress → Escalated → Resolved → Closed`. Status transitions are enforced in the ticket controller. `resolvedAt` is set automatically when status becomes `Resolved`.

**Mongoose models:** `User`, `Ticket`, `KnowledgeArticle`. Tickets embed comments as a sub-document array — no separate Comment collection.

**Error shape:** All error responses use `{ message: string }` consistently.

## User Roles

requester:
- Can register and login
- Can create tickets
- Can view their own tickets
- Can comment on their own tickets
- Can read knowledge base articles

support_agent:
- Can view all tickets
- Can update ticket status
- Can add support comments
- Can create and edit knowledge base articles

admin:
- Can view all tickets
- Can manage users
- Can assign tickets
- Can view dashboard metrics
- Can manage knowledge base articles

## Ticket Fields

Ticket:
- title
- description
- category
- priority
- status
- requester
- assignedTo
- comments
- createdAt
- updatedAt
- resolvedAt

Categories:
- Hardware
- Software
- Access Request
- Network
- Cloud
- Application Issue
- General Support

Priorities:
- Low
- Medium
- High
- Critical

Statuses:
- New
- Assigned
- In Progress
- Escalated
- Resolved
- Closed

## UI Style

Use a clean professional SaaS dashboard style.

Preferred design:
- Dark navy / white base
- Teal accent
- Simple dashboard cards
- Clear tables
- Clean forms
- Recruiter-friendly portfolio look
- No overcomplicated animations

## Code Rules

- Use TypeScript throughout — no `any` unless absolutely necessary.
- Keep server modular: routes, controllers, models, middleware.
- Keep client modular: pages, components, context, api, types.
- Do not over-engineer.
- Build one working feature at a time.
- Add clear error handling.
- Use readable code.
- Keep comments useful but minimal.
- Do not add AWS, CI/CD, or monitoring yet.

## Documentation Rules

Maintain:
- README.md
- docs/architecture.md
- docs/api.md
- docs/stage-1-case-study.md
- docs/future-roadmap.md

Write documentation like a workplace case study, not a university assignment.

## Portfolio Angle

This project should prove:
- IT support workflow understanding
- Ticket triage
- Incident/request handling
- Escalation workflow
- Knowledge base usage
- Authentication
- Role-based access
- Backend API design
- Application support thinking
- Future cloud deployment readiness

## API Route Conventions

Use these base routes:

- Auth: `/api/auth`
- Users: `/api/users`
- Tickets: `/api/tickets`
- Knowledge Base: `/api/kb`
- Dashboard: `/api/dashboard`

Use REST-style endpoint naming.

Examples:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/tickets`
- `POST /api/tickets`
- `GET /api/tickets/:id`
- `PATCH /api/tickets/:id/status`
- `POST /api/tickets/:id/comments`
- `GET /api/kb`
- `POST /api/kb`

## Demo Users

Create seed/demo users for local testing:

Requester:
- email: requester@clouddesk.dev
- password: Password123!
- role: requester

Support Agent:
- email: agent@clouddesk.dev
- password: Password123!
- role: support_agent

Admin:
- email: admin@clouddesk.dev
- password: Password123!
- role: admin

Do not use these credentials in production. They are for local portfolio demo only.


## Stage 1 Acceptance Criteria

Stage 1 is complete when:

- User can register and login
- JWT authentication works
- Protected routes work
- Role-based access works
- Requester can create tickets
- Requester can view their own tickets
- Support agent can view and update tickets
- Admin can view all tickets
- Ticket comments work
- Knowledge base articles can be viewed
- Support agent/admin can manage knowledge base articles
- Dashboard shows basic ticket metrics
- README includes setup instructions
- API documentation is updated
- Stage 1 case study is written

## Security Rules

- Never commit `.env` files.
- Use `.env.example` for required environment variables.
- Hash passwords with bcrypt.
- Do not return password hashes in API responses.
- Validate required request fields.
- Protect private routes with auth middleware.
- Protect admin/support actions with role middleware.
- Keep JWT secret in environment variables.
- Use clear but safe error messages.

## Git Workflow

Build the project in small commits.

Recommended commit sequence:
1. Initial scaffold
2. Backend auth
3. Backend tickets
4. Backend knowledge base
5. Frontend auth
6. Frontend tickets
7. Frontend knowledge base
8. Dashboard
9. Documentation and screenshots

Use clear commit messages.
Do not combine unrelated features in one commit.

## Strict Stage 1 Boundaries

Do not add the following in Stage 1:

- AWS deployment
- Docker deployment
- Kubernetes
- CloudWatch
- S3 upload
- Email notifications
- Payment features
- Real ServiceNow API integration
- Advanced analytics
- Complex animations
- AI chatbot features
- Multi-tenant organisation support

These belong to future stages.



