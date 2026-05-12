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

### GET /api/tickets
List tickets. Requesters see only their own; agents and admins see all.

### POST /api/tickets
Create a new ticket.

**Body:** `{ title, description, category, priority }`

### GET /api/tickets/:id
Get a single ticket.

### PATCH /api/tickets/:id/status
Update ticket status. Requires `support_agent` or `admin` role.

**Body:** `{ "status": "In Progress | Resolved | ..." }`

### POST /api/tickets/:id/comments
Add a comment to a ticket.

**Body:** `{ "text": "string" }`

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
