# Crow - Social Media Scheduler

Full-stack social media scheduling and publishing system. Schedule posts across multiple platforms with a calendar-based UI.

## Tech Stack

- **Backend**: Express.js + TypeScript, Knex ORM, Zod validation
- **Frontend**: React 19 + Vite + TypeScript, React Query, date-fns
- **Database**: SQLite (default) or PostgreSQL (via `POSTGRES_HOST` env var)
- **Containerization**: Docker + docker-compose

## Project Structure

```
client/          # React frontend (Vite)
src/             # Express backend
  platforms/     # Platform service implementations
  scheduler/     # Post scheduling and publishing engine
  api/           # API route handlers
migrations/      # Knex database migrations
data/            # SQLite database files
uploads/         # User-uploaded media
```

## Supported Platforms

- **Telegram** - implemented
- **Twitter (X)** - implemented
- **Instagram** - implemented (Graph API, requires media)
- **Facebook** - implemented (Graph API, Page posts)
- **Mastodon** - implemented (REST API, supports content warnings)
- **Bluesky** - implemented (AT Protocol, images only)

Each platform implements the `PlatformService` interface in `src/platforms/platform-service.ts` and is registered in `src/platforms/registry.ts`.

## Platform Credentials

Platform credentials are stored in the database (`platform_credentials` table), not in environment variables. Users manage credentials through the **Platforms** page in the UI, where they can:

- See all supported platforms and whether each has valid credentials
- Add credentials for a platform by filling in platform-specific fields
- Update or remove credentials for a configured platform

Each platform service defines its required credential fields via `getCredentialFields()`. The registry loads credentials from the DB on demand. If a platform's credentials are removed, scheduled posts targeting it will fail with `PLATFORM_UNAVAILABLE` at publish time. Post creation is disabled in the UI when no platforms are configured.

### API endpoints

- `GET /api/platforms` — list all platforms with configuration status and credential field definitions
- `PUT /api/platforms/:platform` — save credentials for a platform
- `DELETE /api/platforms/:platform` — remove credentials for a platform

## Secrets & Configuration

The `.env` file contains only infrastructure settings (never platform credentials). See `.env.example` for the full list.

Key environment variables:

| Variable | Purpose |
|---|---|
| `POSTGRES_HOST` | Set to use PostgreSQL instead of SQLite |
| `PORT` | Server port (default 3000) |
| `MEDIA_STORAGE_PATH` | Upload directory (default `./uploads`) |
| `SCHEDULER_POLL_INTERVAL_MS` | Scheduler polling interval (default 15000) |
| `SCHEDULER_MAX_RETRIES` | Max publish retries (default 3) |
| `RECURRENT_EVENTS_URL` | Optional external events URL |

## Development

```bash
npm run dev              # API + client concurrently
npm run dev:api          # API only (tsx watch)
npm run dev:client       # Client only (needs API running)
npm run build            # Full build (TypeScript + Vite)
npm run start            # Production mode
npm run migrate          # Run DB migrations
npm run migrate:rollback # Revert last migration
```

The Vite dev server runs on port 5173 and proxies `/api` requests to the backend on port 3000.

## Database

Schema is defined across migrations in `migrations/`. Key tables:
- `posts` - scheduled posts with status tracking
- `media_assets` - uploaded images/videos (with SHA-256 hash dedup, decoupled from posts)
- `post_media` - many-to-many join between posts and media_assets (with sort_order)
- `post_platform_targets` - per-platform content/media overrides and publish status
- `publish_attempts` - audit trail of publish attempts
- `platform_credentials` - stored credentials per platform (one row per platform, JSON blob)

Migrations run automatically on container startup. Use `npm run migrate` for local dev.

## Adding a New Platform

1. Create `src/platforms/<name>/` with a service class implementing `PlatformService`
2. Implement `getCredentialFields()` to define the credential inputs for the UI
3. Register the factory in `src/platforms/registry.ts`
4. Add the platform enum value to the Zod schema in `src/schemas/platform-target.ts`
5. Add the platform enum value to the migration/schema if needed
