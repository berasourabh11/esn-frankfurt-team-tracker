# ESN Frankfurt API

REST API for the ESN Frankfurt site: accounts, registration and moderation, roles, sign-in,
events, shifts and tasks,
hosts, team notes and post-event reviews.

- **Runs on** Cloudflare Workers ([Hono](https://hono.dev)), with a **Cloudflare D1** database.
- **Locally** the same code runs on Node with a SQLite file (`.data/esn.sqlite`) in place of
  D1. D1 is SQLite, so the SQL is identical. (Cloudflare's local runtime, `workerd`, is
  blocked on Windows machines with Smart App Control, so local development doesn't use it.)
- **Validation** reuses the frontend's Zod schemas from `../src/types`, so both sides accept
  the same data. Run `npm install` in the project root too.

## Local development

```bash
npm install
npm run dev        # http://localhost:8787 – creates and seeds .data/esn.sqlite on first start
npm test           # API tests (in-memory database)
npm run typecheck
npm run db:reset   # delete the local database (re-seeded on the next start)
```

The local database is seeded from `seed/demo.sql`: the events and 12 demo members from
`src/mocks`. Every demo account's password is `esn-demo-2026` (Ana Silva and Tom Becker are pending
registrations). If the mock data changes, run
`npm run db:seed:generate`.

Point the frontend at it in the root `.env.local`:

```
EVENTS_API_BASE_URL=http://localhost:8787
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787
```

## Deploying to Cloudflare

One-time setup, from this folder:

1. `npm run cf:login` – opens the browser to connect wrangler to your Cloudflare account.
2. `npm run cf:db:create` – creates the D1 database. Copy the printed `database_id` into
   `wrangler.jsonc`.
3. In `wrangler.jsonc`, set `ALLOWED_ORIGINS` to the site's address, e.g.
   `https://esn-frankfurt.example.org`.
4. `npm run cf:db:migrate` – creates the tables.
5. `npm run cf:db:seed-events` – loads the events (no demo accounts).
6. `npm run user:create -- --remote` – creates the first moderator account (asks for name,
   e-mail and password). Everyone else registers on the site, and a moderator accepts them
   on the Moderation page.
7. `npm run cf:deploy` – publishes the Worker and prints its URL.

Then set `EVENTS_API_BASE_URL` and `NEXT_PUBLIC_API_BASE_URL` for the frontend to the Worker's
URL and rebuild it.

**Cookies.** Sign-in uses an HttpOnly session cookie. Serve the API from the same site as the
frontend, e.g. a custom domain `api.esn-frankfurt.example.org` next to
`esn-frankfurt.example.org`, or a Worker route `esn-frankfurt.example.org/api/*`. If they are
on different sites (e.g. `*.pages.dev` and `*.workers.dev`), set `COOKIE_SAMESITE` to `"None"`
in `wrangler.jsonc`; some browsers block such third-party cookies, so the same site is
better.

Later schema changes: add `migrations/0002_….sql`, then run `npm run cf:db:migrate`. The local
server applies new migrations automatically on start.

## Database

| Table             | Contents                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `users`           | Accounts: name, e-mail (unique), role (`moderator` / `member` / `user`), status (`pending` / `active`), team, password hash |
| `sessions`        | Sign-in sessions (only a SHA-256 hash of the cookie token is stored), 30 days                                               |
| `login_failures`  | Wrong-password counter: 10 failures pause sign-in for 15 minutes                                                            |
| `events`          | Public events                                                                                                               |
| `event_hosts`     | Which members host which event (public)                                                                                     |
| `event_team_info` | Team-only notes and important links per event                                                                               |
| `tasks`           | Shifts and tasks per event                                                                                                  |
| `task_assignees`  | Who takes which shift or task                                                                                               |
| `review_notes`    | "What went well" / "What could be better" notes                                                                             |

Removing an event removes its shifts, hosts, notes and reviews. Removing a member removes their
sessions, assignments and hosting, but keeps their review notes.

## Endpoints

All under `/api`. JSON in and out; errors are `{ "error": "readable message" }`.

| Method & path                                                 | Who                                                                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `POST /auth/register` `{ name, email, password }`             | Anyone: creates a pending account and signs in                                                                           |
| `POST /auth/login` `{ email, password }`                      | Anyone                                                                                                                   |
| `POST /auth/logout`                                           | Anyone                                                                                                                   |
| `GET /auth/me`                                                | Signed in, also while pending (401 otherwise)                                                                            |
| `POST /auth/password` `{ currentPassword, newPassword }`      | Signed in                                                                                                                |
| `GET /members`                                                | Visitors and pending: event hosts only (no e-mails). Accepted: everyone accepted. Moderators: also pending registrations |
| `GET /members/{id}`, `GET /members/{id}/tasks`                | Members                                                                                                                  |
| `POST /members` `{ name, email, role, team?, password }`      | Moderators                                                                                                               |
| `POST /members/{id}/approve` `{ role }`                       | Moderators: accept a registration with a role                                                                            |
| `PATCH /members/{id}`                                         | Moderators (anything, incl. role and password reset); everyone: own name and team                                        |
| `DELETE /members/{id}`                                        | Moderators: remove an account or reject a registration (not yourself; one moderator always remains)                      |
| `GET /events`, `GET /events/{slug}`                           | Public                                                                                                                   |
| `POST /events`, `PUT /events/{slug}`, `DELETE /events/{slug}` | Members                                                                                                                  |
| `GET /events/team-info`                                       | Public: hosts only. Members: hosts, notes and links                                                                      |
| `PUT /events/{slug}/team-info` `{ hostIds?, notes?, links? }` | Members                                                                                                                  |
| `GET /events/{slug}/tasks`                                    | Members                                                                                                                  |
| `POST /events/{slug}/tasks`, `DELETE /tasks/{id}`             | Members                                                                                                                  |
| `PATCH /tasks/{id}`                                           | Members; assignees may only send `{ done }`                                                                              |
| `PUT /tasks/{id}/assignees/{memberId}`                        | Anyone accepted (themselves); members (anyone). 409 when full                                                            |
| `DELETE /tasks/{id}/assignees/{memberId}`                     | Anyone accepted (themselves); members (anyone)                                                                           |
| `GET /events/{slug}/reviews`, `POST /events/{slug}/reviews`   | Members                                                                                                                  |
| `DELETE /reviews/{id}`                                        | The author, members                                                                                                      |

**Security.** CORS only allows `ALLOWED_ORIGINS`, with credentials. Requests that change data
from any other origin are rejected (cross-site request forgery protection). Passwords use
PBKDF2-SHA256 with 100 000 iterations and a random salt.
