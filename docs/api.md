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

> All KB routes require `Authorization: Bearer <token>`.

---

### GET /api/kb

List knowledge base articles.

- `requester` — published articles only
- `support_agent` / `admin` — published articles by default; add `?includeUnpublished=true` to include drafts

Results sorted newest first. `author` populated with `name email role`.

**Response `200`:** Array of article objects.

---

### GET /api/kb/search

Search articles by title, content, category, or tags.

| Query param | Type | Description |
|---|---|---|
| `q` | string | Case-insensitive match against title and content |
| `category` | string | Exact category match |
| `tags` | string | Comma-separated tag list — matches any (`$in`) |
| `includeUnpublished` | `true` | `support_agent` / `admin` only — include drafts |

- `requester` — published results only (regardless of `includeUnpublished`)

**Examples:**
```
GET /api/kb/search?q=VPN
GET /api/kb/search?category=Network
GET /api/kb/search?tags=vpn,firewall
GET /api/kb/search?q=password&includeUnpublished=true
```

**Response `200`:** Array of matching article objects.

**Errors:**
- `400` — invalid category value

---

### GET /api/kb/:id

Get a single article by ID.

- `requester` — `404` if the article is unpublished (does not reveal existence)
- `support_agent` / `admin` — can view any article regardless of published state

**Response `200`:** Article object.

**Errors:**
- `404` — article not found or not published (for requesters)

---

### POST /api/kb

Create a knowledge base article. Requires `support_agent` or `admin`.

`author` is set from the token — not accepted from the request body.  
`isPublished` defaults to `false` (draft) if omitted.

**Body:**
```json
{
  "title": "string",
  "content": "string",
  "category": "Hardware | Software | Access Request | Network | Cloud | Application Issue | General Support",
  "tags": ["string"],
  "isPublished": false
}
```

**Response `201`:** Created article object with `author` populated.

**Errors:**
- `400` — missing required fields, invalid category, or tags not an array
- `403` — insufficient role

---

### PATCH /api/kb/:id

Update an article. Requires `support_agent` or `admin`.

All fields are optional — only provided fields are updated.

**Body (any subset):**
```json
{
  "title": "string",
  "content": "string",
  "category": "string",
  "tags": ["string"],
  "isPublished": true
}
```

**Response `200`:** Updated article object.

**Errors:**
- `400` — invalid category, tags not an array, `isPublished` not boolean, or no valid fields provided
- `403` — insufficient role
- `404` — article not found

---

### DELETE /api/kb/:id

Delete an article. Requires `admin` only.

**Response `204`:** No content.

**Errors:**
- `403` — insufficient role
- `404` — article not found

---

### Knowledge Article Object Shape

```json
{
  "_id": "664f1a2b3c4d5e6f7a8b9c0d",
  "title": "How to reset your VPN credentials",
  "content": "Step 1: Navigate to the IT portal...",
  "category": "Network",
  "tags": ["vpn", "credentials", "access"],
  "author": { "_id": "...", "name": "Agent One", "email": "agent@clouddesk.dev", "role": "support_agent" },
  "isPublished": true,
  "createdAt": "2025-01-15T08:00:00.000Z",
  "updatedAt": "2025-01-15T09:00:00.000Z"
}
```

---

## Dashboard

> Requires `Authorization: Bearer <token>`. All roles can access.  
> `requester` sees metrics scoped to their own tickets only.  
> `support_agent` and `admin` see metrics across all tickets.

---

### GET /api/dashboard

Returns ticket count metrics and recent activity.

**Response `200`:**
```json
{
  "totalTickets": 12,
  "openTickets": 7,
  "resolvedTickets": 5,
  "criticalTickets": 1,
  "highPriorityTickets": 3,
  "ticketsByStatus": {
    "New": 2,
    "Assigned": 1,
    "In Progress": 3,
    "Escalated": 1,
    "Resolved": 4,
    "Closed": 1
  },
  "ticketsByPriority": {
    "Low": 2,
    "Medium": 6,
    "High": 3,
    "Critical": 1
  },
  "ticketsByCategory": {
    "Hardware": 1,
    "Software": 2,
    "Access Request": 4,
    "Network": 2,
    "Cloud": 1,
    "Application Issue": 1,
    "General Support": 1
  },
  "recentTickets": [
    {
      "_id": "...",
      "title": "Cannot access VPN",
      "status": "In Progress",
      "priority": "High",
      "category": "Network",
      "requester": { "_id": "...", "name": "Jane Smith", "email": "jane@example.com", "role": "requester" },
      "assignedTo": { "_id": "...", "name": "Agent One", "email": "agent@clouddesk.dev", "role": "support_agent" },
      "createdAt": "2025-01-15T08:00:00.000Z"
    }
  ]
}
```

**Field definitions:**

| Field | Definition |
|---|---|
| `openTickets` | Tickets with status: `New`, `Assigned`, `In Progress`, or `Escalated` |
| `resolvedTickets` | Tickets with status: `Resolved` or `Closed` |
| `criticalTickets` | Tickets with priority `Critical` (any status) |
| `highPriorityTickets` | Tickets with priority `High` (any status) |
| `ticketsByStatus` | Count per status — all values always present, 0 if none |
| `ticketsByPriority` | Count per priority — all values always present, 0 if none |
| `ticketsByCategory` | Count per category — all values always present, 0 if none |
| `recentTickets` | 5 most recently created tickets, newest first |

**Errors:**
- `401` — not authenticated
- `500` — server error

---

## Error Shape

All errors return:
```json
{ "message": "string" }
```
