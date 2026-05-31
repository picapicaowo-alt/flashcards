# Korean Memory Flashcards

Database-backed Korean vocabulary flashcards with Markdown table import, UWorld-style filters, a wrong-answer bank, spaced repetition, JSON backup/restore, and a protected single-user login.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- React Markdown
- Docker / Docker Compose

## Environment

Copy the example file and fill in real values:

```bash
cp .env.example .env
```

Required variables:

```env
DATABASE_URL="postgresql://flashcard:flashcard@localhost:5433/flashcard?schema=public"
APP_SECRET="replace-with-a-long-random-secret"
ADMIN_EMAIL="you@example.com"
ADMIN_PASSWORD="change-this-password"
```

`ADMIN_EMAIL` and `ADMIN_PASSWORD` create the first user automatically on first login when the user table is empty. Passwords are stored as bcrypt hashes, never plaintext.

## Local Development

Install dependencies:

```bash
npm install
```

Start PostgreSQL however you prefer, or use only the database service from Compose:

```bash
docker compose up -d db
```

Run migrations and start the app:

```bash
npm run db:deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## Importing Cards

Use the Import page and paste a Markdown table:

```markdown
| Front | Back |
| --- | --- |
| **to study** | **공부하 / gongbuha** → **공부하다 / gongbuhada** → **공부해요 / gongbuhaeyo** <br>Hook: study → 功夫/工夫 → **gongbu** |
```

The first column becomes the card front and the second column becomes the answer. The app preserves Markdown, `<br>` line breaks, Korean text, romanization, arrows, hooks, pronunciation notes, and examples.

## Production Build

```bash
npm run build
npm run start
```

## Docker Compose Deployment

Create `.env` with `APP_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`, then run:

```bash
docker compose up -d --build
```

The app container runs `prisma migrate deploy` before starting Next.js. PostgreSQL data is stored in the `postgres-data` Docker volume.

For the AWS deployment at [http://44.237.189.188:3021](http://44.237.189.188:3021), use the production override:

```bash
docker compose -f docker-compose.yml -f docker-compose.aws.yml up -d --build
```

## Backups

In the app, open Card Bank or Backup and choose Export JSON. To restore, open Backup and import the JSON file. Duplicate cards in the same deck are skipped.

For a raw PostgreSQL dump:

```bash
docker compose exec db pg_dump -U flashcard flashcard > flashcard.sql
```

Restore with:

```bash
cat flashcard.sql | docker compose exec -T db psql -U flashcard flashcard
```

## Useful Commands

```bash
npm run lint
npm run build
npm run db:generate
npm run db:deploy
npm run db:seed
npm run db:studio
```
