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
  routes/        # API route handlers
migrations/      # Knex database migrations
data/            # SQLite database files
uploads/         # User-uploaded media
```

## Supported Platforms

- **Telegram** - implemented
- **Twitter (X)** - implemented
- **Facebook** - not yet implemented
- **Instagram** - not yet implemented
- **Mastodon** - not yet implemented
- **Bluesky** - not yet implemented

Each platform implements the `PlatformService` interface in `src/platforms/platform-service.ts` and is registered in `src/platforms/registry.ts`. A platform is only marked available if its credentials are configured in the environment.

## Secrets & Configuration

All secrets live in the backend `.env` file (never in the frontend). See `.env.example` for the full list.

Key environment variables:

| Variable | Purpose |
|---|---|
| `POSTGRES_HOST` | Set to use PostgreSQL instead of SQLite |
| `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET` | Twitter/X credentials |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID` | Telegram bot credentials |
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

Schema is in `migrations/001_initial_schema.ts`. Key tables:
- `posts` - scheduled posts with status tracking
- `media_assets` - uploaded images/videos
- `post_platform_targets` - per-platform content overrides and publish status
- `publish_attempts` - audit trail of publish attempts

Migrations run automatically on container startup. Use `npm run migrate` for local dev.

## Adding a New Platform

1. Create `src/platforms/<name>/` with a service class implementing `PlatformService`
2. Register it in `src/platforms/registry.ts`
3. Add corresponding env vars to `.env.example`
4. Add the platform enum value to the migration/schema if needed
