# FightForge — Task list & work split (Craig & Tucker)

Based on the **FightForge** proposal (React, Node/Express, MySQL, RBAC, REST). Work is split so **each person owns full backend modules and a comparable slice of the UI**, with shared setup called out explicitly.

---

## Shared (do together or pair-program first)

| # | Task | Notes |
|---|------|--------|
| S1 | Repo structure: `frontend/` (Vite + React), `backend/` (Express), `.env.example` | One PR or split: one scaffolds FE, one BE, then merge. |
| S2 | MySQL schema + migrations / `schema.sql` | Tables: `users`, `workouts`, `meals`, `progress_entries`, `messages`; agree on FKs and enums (`athlete` / `coach` / `admin`). |
| S3 | JWT auth pattern + `Authorization: Bearer` middleware | Both consumers need the same contract. |
| S4 | CORS + Vite proxy to `/api` | Local dev only; document production base URL. |
| S5 | Seed users (admin, coach, demo athlete) + Postman collection (optional) | Speeds integration & demo. |
| S6 | README: install, env vars, `mysql` import, `npm run dev` for each app | Course submission requirement. |

---

## Craig — Backend (proposal addendum alignment)

| # | Task | Endpoints / scope |
|---|------|-------------------|
| CB1 | **Authentication API** | `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/profile/:id` |
| CB2 | **Workout API** | `GET/POST /api/workouts`, `GET/PUT/DELETE /api/workouts/:id` + RBAC (coach/admin create; athlete sees own) |
| CB3 | **Progress API** | `GET /api/progress/:userId`, `POST/PUT/DELETE /api/progress` (or `/api/progress/:id` per your router) + RBAC |

**Backend acceptance:** Input validation, duplicate-email handling on signup, 401/403 on protected routes, JSON errors for API failures.

---

## Craig — Frontend

| # | Task | Proposal pages |
|---|------|----------------|
| CF1 | **Home** | Landing, feature overview, nav to login/signup |
| CF2 | **Login** | Form → auth API → store token → role-based redirect |
| CF3 | **Athlete dashboard** | Hub: summary cards / links to workouts, meals, progress, chat |
| CF4 | **Workout page** | List + detail from **Workout API**; loading & empty states |
| CF5 | **Progress page** | List + add/edit own metrics via **Progress API** |
| CF6 | **Shared shell** (optional but ideal) | App layout, nav for athlete routes, 404/error boundary hook-up with Tucker |

---

## Tucker — Backend

| # | Task | Endpoints / scope |
|---|------|-------------------|
| TB1 | **User API** | `GET /api/users` (admin; coach filtered list if you implement that), `GET/PUT/DELETE /api/users/:id` + RBAC |
| TB2 | **Meal plan API** | `GET/POST /api/meals`, `GET/PUT/DELETE /api/meals/:id` + RBAC |
| TB3 | **Messaging API** | `GET /api/messages`, `GET /api/messages/:id`, `POST /api/messages`, `DELETE /api/messages/:id` + RBAC |

**Backend acceptance:** Same as Craig’s list (validation, authz, consistent JSON shape).

---

## Tucker — Frontend

| # | Task | Proposal pages |
|---|------|----------------|
| TF1 | **Signup** | Registration → signup API; validation UX |
| TF2 | **Meal plan page** | Plans from **Meal API**; athlete view + coach/admin create/edit if in scope |
| TF3 | **Chat page** | Thread or inbox UI → **Messaging API** |
| TF4 | **Coach dashboard** | Assigned athletes, shortcuts to assign workouts/meals/messages (uses Craig’s workout APIs + your meal/message APIs) |
| TF5 | **Admin dashboard** | User CRUD + cross-entity management per proposal (“full CRUD”) |
| TF6 | **Error pages** | Invalid route + friendly API failure / 500 messaging (can split 404 vs error with Craig) |

---

## Balance check

| Area | Craig | Tucker |
|------|-------|--------|
| **Backend modules** | 3 (Auth, Workouts, Progress) | 3 (Users, Meals, Messages) |
| **Frontend pages / areas** | 6 (incl. layout/home/login/dashboard/workouts/progress) | 6 (signup/meals/chat/coach/admin/errors) |
| **Shared** | Schema, auth contract, dev wiring, README | Same |

If one module is heavier in your implementation (e.g. admin UI), **trade a small piece**: e.g. Tucker owns admin **data tables** for meals/messages only; Craig wires **admin read-only** views for workouts/progress—or adjust once you see actual effort.

---

## Suggested week alignment (from proposal)

| Week | Craig focus | Tucker focus |
|------|-------------|--------------|
| 1 | Auth API + DB user fields; FE scaffold login/home | User API + meals schema; signup + API types |
| 2 | Workouts API + workout page + dashboard shell | Meals API + meal page; coach list UI |
| 3 | Progress API + progress page; polish athlete nav | Messages API + chat; coach dashboard actions |
| 4 | Integration testing with Tucker’s APIs; bugfix | Admin dashboard + user assignment; integration |
| 5 | Error handling, Postman, README, demo polish | Same; split Postman folders by owner |

---

## RBAC quick reference (from PDF)

- **Athlete:** own dashboard, workouts, meals, progress, profile, coach messages.  
- **Coach:** assigned athletes, CRUD workouts/meals for them, progress read, messaging.  
- **Admin:** full CRUD on users, workouts, meals, messages, etc.

Use this doc as your sprint board; check boxes in GitLab issues or a shared board per milestone (Setup, Core features, API integration, Testing, Polish).
