# Crow - Social Media Scheduler

Crow is a single, server-side-rendered Next.js application that enables planning, scheduling, and automatic publishing of social media posts across multiple platforms.

## Features
- Visual planning with a calendar UI (Day, Week, Month views).
- Multi-platform support: Facebook, Instagram, Twitter (X), Mastodon, Bluesky, and Telegram.
- Automatic background publishing.
- Analytics dashboard.
- Optional Authelia integration for user context.

## Setup

### Environment Variables
Copy `.env.example` to `.env` and fill in the required secrets. Platforms without secrets will be automatically disabled in the UI.

```bash
# Database (Defaults to SQLite)
# POSTGRES_HOST=
# POSTGRES_PORT=
# POSTGRES_USER=
# POSTGRES_PASSWORD=
# POSTGRES_DB=

# External Services
RECURRENCE_API_URL=
AUTHELIA_URL=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Mastodon
MASTODON_INSTANCE_URL=
MASTODON_ACCESS_TOKEN=

# Bluesky
BLUESKY_IDENTIFIER=
BLUESKY_PASSWORD=

# Twitter (X)
TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_SECRET=

# Facebook & Instagram
FACEBOOK_PAGE_ID=
FACEBOOK_PAGE_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=
```

Refer to [CREDENTIALS.md](./CREDENTIALS.md) for a guide on how to obtain these keys.

### Local Development
1. Install dependencies: `npm install`
2. Run migrations: `npx knex migrate:latest --knexfile src/db/knexfile.ts`
3. Start the dev server: `npm run dev`

### Docker
```bash
docker compose up -d
```
