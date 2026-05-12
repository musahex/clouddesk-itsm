# CloudDesk API Reference

Base URL (local): `http://localhost:5000/api`

---

## Health

### GET /api/health

Returns server status. No auth required.

**Response:**
```json
{ "status": "ok", "service": "CloudDesk API" }
```

---

## Auth

### POST /api/auth/register

Register a new user. `role` defaults to `requester` if omitted.

**Body:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string",
  "role": "requester | support_agent | admin"
}
```

**Response `201`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "664f1a2b3c4d5e6f7a8b9c0d",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "role": "requester"
  }
}
```

**Errors:**
- `400` — missing required fields, invalid role, or email already registered
- `500` — server error

---

### POST /api/auth/login

Login and receive a JWT.

**Body:**
```json
{ "email": "string", "password": "string" }
```

**Response `200`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "664f1a2b3c4d5e6f7a8b9c0d",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "role": "requester"
  }
}
```

**Errors:**
- `400` — missing fields
- `401` — invalid credentials
- `500` — server error

---

### Using the JWT

Include the token in the `Authorization` header on all protected requests:

```
Authorization: Bearer <token>
```

The token encodes `{ id, role, name }` and expires after **7 days**.

---

## Tickets

> All ticket routes require `Authorization: Bearer <token>`.

---

### POST /api/tickets

Create a new ticket. All authenticated roles can create.

`requester` is set from the token — not accepted from the request body.

**Body:**
```json
{
  "title": "string",
  "description": "string",
  "category": "Hardware | Software | Access Request | Network | Cloud | Application Issue | General Support",
  "priority": "Low | Medium | High | Critical"
}
```

`priority` defaults to `Medium` if omitted.

**Response `201`:** Full ticket object with `requester` populated.

**Errors:**
- `400` — missing required fields or invalid enum value
- `401` — not authenticated

---

### GET /api/tickets

List tickets.

- `requester` — sees only their own tickets
- `support_agent` / `admin` — sees all tickets

Results sorted newest first. `requester` and `assignedTo` are populated with `name email role`.

**Response `200`:** Array of ticket objects.

---

### GET /api/tickets/:id

Get a single ticket with comments.

- `requester` — can only view their own ticket (`403` otherwise)
- `support_agent` / `admin` — can view any ticket

`requester`, `assignedTo`, and `comments.author` are populated.

**Response `200`:** Full ticket object including comments array.

**Errors:**
- `403` — requester accessing another user's ticket
- `404` — ticket not found

---

### PATCH /api/tickets/:id/status

Update ticket status. Requires `support_agent` or `admin`.

Setting status to `Resolved` automatically sets `resolvedAt`. Moving away from `Resolved` clears `resolvedAt`.

**Body:**
```json
{ "status": "New | Assigned | In Progress | Escalated | Resolved | Closed" }
```

**Response `200`:** Updated ticket object.

**Errors:**
- `400` — missing or invalid status
- `403` — insufficient role
- `404` — ticket not found

---

### POST /api/tickets/:id/comments

Add a comment to a ticket.

- `requester` — can only comment on their own tickets; `isInternal` is always forced to `false`
- `support_agent` / `admin` — can comment on any ticket; can set `isInternal: true` for internal notes

**Body:**
```json
{
  "body": "string",
  "isInternal": false
}
```

**Response `201`:** Full ticket object with updated comments array (all authors populated).

**Errors:**
- `400` — missing body
- `403` — requester commenting on another user's ticket
- `404` — ticket not found

---

### PATCH /api/tickets/:id/assign

Assign a ticket to a support agent or admin. Requires `support_agent` or `admin`.

If the ticket status is `New`, it is automatically advanced to `Assigned`.

**Body:**
```json
{ "assignedTo": "<userId>" }
```

**Response `200`:** Updated ticket object with `assignedTo` populated.

**Errors:**
- `400` — missing `assignedTo`, invalid ID format, or target user is not a `support_agent` or `admin`
- `403` — insufficient role
- `404` — ticket or assignee user not found

---

### Ticket Object Shape

```json
{
  "_id": "664f1a2b3c4d5e6f7a8b9c0d",
  "title": "Cannot access VPN",
  "description": "Getting connection timeout when connecting to VPN from home.",
  "category": "Network",
  "priority": "High",
  "status": "In Progress",
  "requester": { "_id": "...", "name": "Jane Smith", "email": "jane@example.com", "role": "requester" },
  "assignedTo": { "_id": "...", "name": "Agent One", "email": "agent@clouddesk.dev", "role": "support_agent" },
  "comments": [
    {
      "_id": "...",
      "body": "Investigating the VPN configuration.",
      "author": { "_id": "...", "name": "Agent One", "email": "agent@clouddesk.dev", "role": "support_agent" },
      "isInternal": false,
      "createdAt": "2025-01-15T09:30:00.000Z"
    }
  ],
  "resolvedAt": null,
  "createdAt": "2025-01-15T08:00:00.000Z",
  "updatedAt": "2025-01-15T09:30:00.000Z"
}
```

---

## Knowledge Base

### GET /api/kb
List all published articles. Public.

### POST /api/kb
Create an article. Requires `support_agent` or `admin` role.

### GET /api/kb/:id
Get a single article.

### PUT /api/kb/:id
Update an article. Requires `support_agent` or `admin` role.

---

## Dashboard

### GET /api/dashboard
Returns ticket count metrics. Requires `support_agent` or `admin` role.

---

## Error Shape

All errors return:
```json
{ "message": "string" }
```
