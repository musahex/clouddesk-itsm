# Screenshot Capture Guide

This folder holds portfolio screenshots for the README. Capture them with the app running locally after seeding demo users.

**Setup before capturing:**
1. `cd server && npm run dev` (port 5000)
2. `cd client && npm run dev` (port 5173)
3. `cd server && npm run seed` (creates demo users if not already present)

---

## Checklist

### Authentication

| Done | Screen | Filename | Instructions |
|---|---|---|---|
| [ ] | Login page | `login.png` | Open `http://localhost:5173/login` while logged out |
| [ ] | Register page | `register.png` | Open `http://localhost:5173/register` while logged out |

### Dashboard

| Done | Screen | Filename | Instructions |
|---|---|---|---|
| [ ] | Dashboard (agent/admin view) | `dashboard.png` | Log in as `agent@clouddesk.dev` — shows all ticket metrics, breakdowns, recent tickets |
| [ ] | Dashboard (requester view) | `dashboard-requester.png` | Log in as `requester@clouddesk.dev` — shows scoped metrics |

### Tickets

| Done | Screen | Filename | Instructions |
|---|---|---|---|
| [ ] | Ticket list | `tickets-list.png` | Log in as `agent@clouddesk.dev`, go to Tickets |
| [ ] | Create ticket form | `create-ticket.png` | Log in as `requester@clouddesk.dev`, click New Ticket |
| [ ] | Ticket detail — requester view | `ticket-detail-requester.png` | Log in as requester, open one of your tickets — no action buttons visible |
| [ ] | Ticket detail — agent view | `ticket-detail-agent.png` | Log in as agent, open any ticket — shows Update Status and Assign Ticket panels |
| [ ] | Assign ticket dropdown | `assign-ticket-dropdown.png` | On ticket detail as agent/admin, click the Assign dropdown to show populated agents |
| [ ] | Status update in progress | `status-update.png` | On ticket detail as agent, change the status dropdown to show selection |

### Knowledge Base

| Done | Screen | Filename | Instructions |
|---|---|---|---|
| [ ] | KB list — agent view | `kb-list.png` | Log in as `agent@clouddesk.dev`, go to Knowledge Base — shows Published/Draft badges and New Article button |
| [ ] | KB article detail | `kb-article.png` | Open any published article — shows title, category badge, tags, content |
| [ ] | Create article form | `kb-create.png` | Log in as agent, click New Article |
| [ ] | Edit article form | `kb-edit.png` | Open any article as agent, click Edit Article — pre-filled form |

---

## Recommended Capture Settings

- **Browser width:** 1440px or 1280px (full desktop view)
- **Browser:** Chrome or Edge in normal mode (not incognito — preserves styling)
- **Zoom:** 100%
- **Format:** PNG
- **Tool:** Browser screenshot, macOS `⌘ + Shift + 4`, or a tool like Cleanshot X

---

## File Summary

```
screenshots/
├── login.png
├── register.png
├── dashboard.png
├── dashboard-requester.png
├── tickets-list.png
├── create-ticket.png
├── ticket-detail-requester.png
├── ticket-detail-agent.png
├── assign-ticket-dropdown.png
├── status-update.png
├── kb-list.png
├── kb-article.png
├── kb-create.png
└── kb-edit.png
```

---

## Tips

- Capture the dashboard with real data — seed a few tickets and KB articles first so the metric cards and breakdowns show non-zero values
- For the assign dropdown screenshot, make sure there are seeded agent/admin users so the dropdown is populated
- The ticket detail agent view is one of the most important — make sure it shows the Update Status and Assign Ticket panels clearly
