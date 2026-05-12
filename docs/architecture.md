# CloudDesk ITSM Platform — Architecture

## Overview

CloudDesk is a full-stack ITSM support platform. The React SPA (`client/`) communicates with a Node.js/Express REST API (`server/`) backed by MongoDB.

## System Diagram

```
[Browser / React SPA]
        |
   Vite Dev Proxy (/api → :5000)
        |
[Express API — :5000]
        |
   [MongoDB]
```

## Backend

- **Framework:** Express with TypeScript
- **Database:** MongoDB via Mongoose
- **Auth:** JWT (signed with `JWT_SECRET`, stored client-side in localStorage)
- **Structure:** `routes → controllers → models`, with `middleware/` for auth and RBAC

## Frontend

- **Framework:** React 18 with TypeScript
- **Build tool:** Vite
- **Styling:** Tailwind CSS (dark navy/teal theme)
- **State:** React Context for auth, local component state for UI
- **HTTP:** Axios via `src/api/` wrappers

## Auth Flow

1. User POSTs credentials to `/api/auth/login`
2. Server validates, returns signed JWT
3. Client stores JWT in `localStorage` via `AuthContext`
4. All subsequent requests include `Authorization: Bearer <token>`
5. `authMiddleware` verifies token and attaches `req.user`
6. `roleMiddleware` checks `req.user.role` for protected routes

## Data Models

- **User** — name, email, passwordHash, role (`requester` | `support_agent` | `admin`)
- **Ticket** — title, description, category, priority, status, requester, assignedTo, comments[], createdAt, updatedAt, resolvedAt
- **KnowledgeArticle** — title, content, category, author, createdAt, updatedAt

Comments are embedded sub-documents on Ticket (no separate collection).

## Stage 1 Scope

Local development only. No cloud infrastructure, containers, or CI/CD in Stage 1.
