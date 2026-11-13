# Career Compass

Career Compass helps students explore careers, compare their interests, ask
questions, and build practical learning plans. It combines a React interface
with Gemini, OpenAI or Claude guidance and private, locally stored conversation histories.

## Features

- Career chat with automatically generated conversation titles.
- Local email/password accounts with separate conversation histories.
- Animated student illustrations, responsive layouts, and light/dark themes.
- Keyboard-accessible controls and reduced-motion support.
- Teacher Joe: a face-to-face 3D portrait, short conversational replies, and
  talk-or-type controls with a selectable browser voice and approximate lip-sync.
- Display-only chat translation that preserves saved original messages.

Voice transcripts are temporary. Existing browser TTS is reused; no Qwen setup
is needed. Selected attachments contribute filenames only; their contents
are not uploaded or analysed. Translation uses your selected AI provider and is best-effort, not a
guaranteed service. Joe prefers a known male English voice when installed; the
available voices depend on your browser/OS. Joe's mouth follows actual playback
and available word boundaries, with a speech-cadence fallback when boundaries
are absent. This is approximate, not audio/phoneme-accurate lip-sync. Stop Speaking
cancels queued/active speech and resets his mouth; reduced motion keeps him still.

## Quick start

Install Docker Engine/Desktop with Docker Compose v2 and Node.js 22 or newer.
Start Docker, then run these commands from the repository root:

```bash
npm run setup:local
```

Choose an AI provider and set its API key in `backend/.env` (see below). Existing
Gemini configuration works unchanged; setup never overwrites your credentials.

```bash
npm run start:local
```

Open **http://localhost:3000** and create a local account. Docker installs the
application dependencies and builds the frontend; a host-side `npm install` is
not required for this workflow. No Firebase or cloud database setup is needed.

See [Setup.md](Setup.md) for configuration, troubleshooting, backups, and native
development.

## Configuration

| File | Purpose | Settings |
|---|---|---|
| Root `.env` | Docker Compose configuration | `POSTGRES_PASSWORD`, `APP_PORT` |
| `backend/.env` | Server-side AI configuration | `AI_PROVIDER`, corresponding API key and optional model |

| `AI_PROVIDER` | API key variable | Model variable / default |
|---|---|---|
| `gemini` (default) | `GEMINI_API_KEY` | `GEMINI_MODEL=gemini-3.5-flash` |
| `openai` | `OPENAI_API_KEY` | `OPENAI_MODEL=gpt-4.1-mini` |
| `claude` | `ANTHROPIC_API_KEY` | `CLAUDE_MODEL=claude-sonnet-4-6` |

For example, set `AI_PROVIDER=openai` and `OPENAI_API_KEY` in the backend file.
Only the selected provider receives chat, title, translation and Joe requests;
there is no automatic fallback. Use an API key, not a ChatGPT/Claude subscription
login. Models are configurable and require access on your provider account.
After env changes, run `docker compose up -d --force-recreate app --wait`.

Setup generates a unique **48-character hexadecimal database password** from 24
cryptographically random bytes. This avoids a shared default and is safe in the
database connection URL. It is not your account password. Keep it stable: editing
the file does not change the password of an already initialized PostgreSQL role.

Provider keys belong in `backend/.env`, not the root file or frontend. Compose
passes them to Express at runtime; env files are excluded from the image build and
ignored by Git. Provider access, quotas and billing depend on your API account.
Rotate any previously exposed key. Health's `aiConfigured` checks configuration,
not live key validity; `aiProvider` reports the selected provider.

## Operation

| Command | Purpose |
|---|---|
| `npm run setup:local` | Create missing configuration without overwriting it |
| `npm run start:local` | Build/start the stack and wait for health checks |
| `npm run stop:local` | Remove containers while retaining the database volume |
| `docker compose ps` | Inspect service status |
| `docker compose logs --tail=100 app` | Inspect application logs |
| `docker compose restart` | Restart both services without deleting data |

Accounts, session records, and histories live in the named volume
`career-compass_postgres_data`. Routine shutdowns and rebuilds retain it.
**Do not use `docker compose down -v` for routine shutdown: it deletes the database.**

## Architecture

```text
Browser → localhost:3000
           └─ app: Express serves React and /api
                ├─ db: PostgreSQL 17 → persistent volume
                └─ selected Gemini / OpenAI / Claude API → generated advice
```

Compose runs two containers. Only the app is published, on loopback; PostgreSQL
has no host port. Frontend requests use same-origin `/api`, eliminating a separate
browser-to-backend CORS setup. The app waits for database health and initializes
missing tables on startup.

Passwords use salted scrypt hashes. Sessions use HttpOnly/SameSite cookies and
hashed database tokens. Histories are owner-scoped snapshots with revision checks:
a stale tab cannot silently overwrite another tab's changes. Save failures remain
visible with retry controls. See [Architecture.md](Architecture.md) for the
system design.

This is a local application, not an offline AI service: questions are sent to
your selected provider, including text selected for translation and Joe's recent conversation
turns. Local accounts have no email verification or password-reset service.
Existing Firebase accounts/data are not migrated or deleted. Non-local hosting
requires a separate security/dependency review, HTTPS, and secure-cookie configuration.

## Development and checks

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run install-all
npm test --prefix backend
CI=true npm test --prefix frontend -- --watchAll=false --runInBand
npm run build
docker compose config --quiet
```

Real database tests also require an isolated PostgreSQL database; see the setup
guide. Existing CRA/MediaPipe source-map and outdated browser-data warnings remain
visible; a successful build is not a claim that dependency audits are clean.

## Project layout

- `frontend/`: React UI, student scenes, chat, and Teacher Joe.
- `backend/`: Express, AI provider integration, authentication, and PostgreSQL schema.
- `scripts/`: local setup helpers.
- `compose.yaml`, `Dockerfile`: reproducible local runtime.
- `Architecture.md`: system design and runtime boundaries.

Student illustrations are CC0 Open Doodles by Pablo Stanley; source details are
in `frontend/public/images/students/README.md`. Bundled fonts include their license
in `frontend/public/fonts/`.
