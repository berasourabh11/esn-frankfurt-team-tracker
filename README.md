# ESN Frankfurt – Events & Calendar

[![CI/CD](https://github.com/berasourabh11/esn-frankfurt-team-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/berasourabh11/esn-frankfurt-team-tracker/actions/workflows/ci.yml)

Event discovery platform for international students in Frankfurt, plus a team area for ESN
members. Two parts, deployed independently:

- **Frontend** (this folder): Next.js App Router. All data goes through a service layer.
- **API** (`backend/`): a Cloudflare Worker (Hono) with a Cloudflare D1 database for users,
  roles, sign-in, events, shifts/tasks, hosts, notes and reviews. See
  [backend/README.md](backend/README.md).

Without the API configured, the frontend runs in **demo mode** (mock events, team data in the
browser).

## Quick start

```bash
npm install
npm run dev                  # http://localhost:3000 (demo mode)
```

With the real API and database on your computer:

```bash
npm --prefix backend install
npm run api:dev              # http://localhost:8787, local SQLite database with demo data
# .env.local:
#   EVENTS_API_BASE_URL=http://localhost:8787
#   NEXT_PUBLIC_API_BASE_URL=http://localhost:8787
npm run dev                  # restart after changing .env.local
```

Demo accounts (local only): any member in `src/mocks/members.ts`, e.g.
`lena@esn-frankfurt.example` (moderator), `aisha@esn-frankfurt.example` (member),
`lucas@esn-frankfurt.example` (user). Password: `esn-demo-2026`.

| Script                 | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Development server                                    |
| `npm run build`        | Production build (prerenders shells & event pages)    |
| `npm start`            | Serve the production build                            |
| `npm run lint`         | ESLint (Next.js core-web-vitals + TypeScript rules)   |
| `npm run typecheck`    | Generate route types and run `tsc`                    |
| `npm run format`       | Prettier (with Tailwind class sorting)                |
| `npm test`             | Vitest + React Testing Library unit tests             |
| `npm run test:e2e`     | Playwright (desktop + mobile Chromium), demo mode     |
| `npm run test:e2e:api` | Playwright against the real API (fresh test database) |
| `npm run api:dev`      | Start the API locally (`backend/`)                    |
| `npm run api:test`     | API tests                                             |

First-time E2E setup: `npx playwright install chromium`.

## Stack

Next.js 16 (App Router, Cache Components / Partial Prerendering) · React 19 · TypeScript
(strict) · Tailwind CSS 4 · shadcn/ui (Radix) · Lucide · FullCalendar 7 · date-fns (+
`@date-fns/tz`) · TanStack Query · Zod · Vitest · React Testing Library · Playwright ·
ESLint · Prettier.

## Routes

| Route            | What it is                                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`              | **Upcoming** – landing page. Events grouped into Today / Tomorrow / This Week / Next Week / Later (Europe/Berlin), with search, date and category filters kept in the URL. |
| `/calendar`      | **Calendar** – FullCalendar month / week / list views, Monday-first, with a selected-day agenda (right panel on desktop, below the grid on mobile).                        |
| `/events/[slug]` | **Event page** – details, hosts, add-to-calendar/share, and (for members) the team area with shifts, tasks, notes and the post-event review.                               |
| `/team`          | **Team** – my shifts & tasks and the member directory.                                                                                                                     |
| `/moderation`    | **Moderation** (moderators only) – accept or reject registrations with a role, change roles, add and remove accounts.                                                      |

Other entry points: per-event Open Graph images, `sitemap.xml`, `robots.txt`, and schema.org
`Event` JSON-LD.

## Architecture

```
src/
  app/                    routes, layout, metadata, OG images
  components/
    ui/                   shadcn/ui primitives (button, badge, dialog, sheet, …)
    layout/               header, navigation, search, footer, events hydration
    events/               event card, date badge, category badge/icon
    calendar/             day agenda
  features/
    upcoming/             feed, filter bar, filter logic (URL state)
    calendar/             FullCalendar view, event mapping, theme
    event-details/        event page, hero, facts, add-to-calendar/share
    subscription/         subscribe dialog
  services/
    eventService.ts       EventService interface + mock and HTTP implementations
    events.server.ts      cached server-only accessors ("use cache")
    eventClient.ts        client hook (TanStack Query)
  mocks/events.ts         curated mock data
  types/event.ts          Zod schema = API contract
  lib/                    dateUtils, categories, ics, site config, utils
```

**Rendering.** Pages are Server Components. Only interactive pieces are Client Components:
filters, the calendar, dialogs and navigation state. With Cache Components, the hero and page
chrome are prerendered. Anything that depends on "today" in Berlin is computed per request
(`await io()`) and streamed into a Suspense boundary, then re-checked on the client every
minute, so the groups roll over at midnight.

**Data flow.** `events.server.ts` loads events once per cache period. The root layout
dehydrates them into the TanStack Query cache, so the feed, the calendar and the subscribe
dialog all read the same data on the client without prop drilling.

## API integration

The frontend reads its settings from `.env.local` (see `.env.example`):

| Variable                        | Where it is used                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `EVENTS_API_BASE_URL`           | Server only: renders events, event pages, metadata and OG images from the API. Empty → mock events. |
| `NEXT_PUBLIC_API_BASE_URL`      | Browser: real sign-in, team data and event management. Empty → demo mode.                           |
| `NEXT_PUBLIC_SITE_URL`          | Canonical URL for metadata, sitemap and share links.                                                |
| `NEXT_PUBLIC_CALENDAR_FEED_URL` | Optional: enables Google/Apple/Outlook subscription links.                                          |

Both API variables normally point at the same Worker. All payloads are validated with the Zod
schemas in `src/types/`, and the API imports the very same schemas, so both sides accept
exactly the same data. Dates are `YYYY-MM-DD` and times are `HH:mm` (Berlin wall-clock).
Events are cached on the server for a few minutes; in API mode the browser fetches fresh data,
so changes show immediately.

## Team area (members, shifts, tasks, event review)

Signed-in ESN members get a **Team area** below each event, at `/events/[slug]#team`:

- **Shifts & tasks**: shifts are time slots during the event, and tasks are preparation or
  follow-up work. Each one has a description, date/time, meeting point and a number of people
  needed. Members can see who is assigned, how many spots are open, and overall staffing
  progress.
- **Roles**: members can create, edit and delete shifts and tasks and
  assign anyone. Users (and moderators) can take an open spot, leave it, and mark their own tasks as done.
- **Event review**: once an event has started, members can add "What went well" and "What
  could be better" notes for the team meeting. "Copy for meeting notes" exports them as
  Markdown.
- **`/team`**: shows "My shifts & tasks" and a searchable directory of accepted people.

**Sign-in, registration and roles.** With the API, people sign in with e-mail and password (an
HttpOnly session cookie; passwords are hashed with PBKDF2). Anyone can **create an account**
from the sign-in dialog; it stays _pending_ (signed in, but only a "waiting for approval"
notice) until a moderator accepts it on `/moderation` and decides the role. The API enforces
every permission; `src/features/auth/permissions.ts` only decides what the UI shows:

| Role      | Can                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Moderator | Accept/reject registrations, change roles, add, edit and remove accounts, reset passwords. Team access like a user, but no event or shift management |
| Member    | Create, edit and remove events; manage shifts and tasks; edit hosts, notes and links                                                                 |
| User      | Take and leave shift spots, tick off own tasks, add review notes                                                                                     |

There is always at least one moderator. Public visitors see events and host names, nothing else.

**Demo mode.** Without `NEXT_PUBLIC_API_BASE_URL`, "Team sign in" lets you pick one of the
fictional members in `src/mocks/members.ts`, and everything (members, shifts, tasks, notes,
reviews, event changes) is saved in the browser's localStorage only.

## Mock data

`src/mocks/events.ts` is curated from the ESN Frankfurt planning sheet (June 2026 – Feb 2027).
Only public information is kept. Organiser names, budgets, guest-list notes, internal calls,
team-only trips and other sections' events were removed. Entries marked with "?" in the sheet
are `tentative`. The "💃" and "🏃‍♂️" placeholders are interpreted as the regular Dance Night
and Sunday Run. Categories were assigned only where the title supports them.

## Deployment (Cloudflare)

| Part          | Address                                              | Cloudflare Worker                                    |
| ------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| Website       | https://esnfrankfurt.teamtracker.sourabh-bera.dev    | `esn-frankfurt-web` (Next.js via OpenNext)           |
| API           | https://events-api.sourabh-bera.dev                  | `esn-frankfurt-api` (`backend/`), D1 `esn-frankfurt` |
| Calendar feed | https://events-api.sourabh-bera.dev/api/calendar.ics | (part of the API)                                    |

Publish changes with `npm run deploy` (API, database migrations, then the website), or
`npm run deploy:web` / `npm run deploy:api` for one part. Addresses live in
`deploy.config.json`, `wrangler.jsonc` and `backend/wrangler.jsonc`. Needs `npx wrangler login`
once per computer.

Cache Components are switched off: the Cloudflare adapter doesn't support them yet (requests
hang), so pages render per request instead.

### CI/CD (GitHub Actions)

`.github/workflows/ci.yml` runs on every push and pull request: lint, formatting, typechecks,
unit and API tests, and both browser test suites. When a push to `main` passes, it deploys with
`npm run deploy`. Deploying needs two repository secrets:

- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token from the "Edit Cloudflare Workers" template,
  with **Account → D1 → Edit** added.
- `CLOUDFLARE_ACCOUNT_ID`: shown on the Workers & Pages overview in the Cloudflare dashboard.
