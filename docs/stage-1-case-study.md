# Stage 1 Case Study: CloudDesk ITSM Platform

## Background

CloudDesk is a portfolio ITSM platform designed to demonstrate end-to-end IT support workflow capability. It mirrors the core functionality of enterprise tools like ServiceNow — ticket submission, triage, escalation, resolution, and knowledge base management — built from scratch using modern web technologies.

## Problem Statement

Junior IT support roles increasingly require applicants who understand both the operational side of service management and the technical implementation behind it. Most portfolios demonstrate only one or the other. CloudDesk bridges that gap.

## Approach

Stage 1 establishes a working local MVP with:
- JWT authentication and role-based access control
- Full ticket lifecycle management (New → Assigned → In Progress → Escalated → Resolved → Closed)
- Knowledge base for self-service resolution
- Basic support dashboard with ticket metrics

The system enforces three distinct user roles — requester, support_agent, and admin — with permissions validated at the API level, not just the UI.

## Tech Decisions

| Decision | Choice | Reason |
|---|---|---|
| Runtime | Node.js + Express | Lightweight, well-suited to REST API development |
| Database | MongoDB + Mongoose | Flexible schema accommodates evolving ticket fields |
| Auth | JWT | Stateless, straightforward to implement and demonstrate |
| Frontend | React + Vite + TypeScript | Industry standard, fast dev cycle, type safety |
| Styling | Tailwind CSS | Consistent utility-first styling without a heavy UI library |

## Outcome

Stage 1 delivers a runnable local platform demonstrating ITSM concepts suitable for portfolio presentation and technical interview discussion.

## Next Steps

Stage 2 will introduce AWS deployment, S3 file attachments, CloudWatch monitoring, and CI/CD — documented in `future-roadmap.md`.
