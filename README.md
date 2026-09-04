# chunks

Learn English expressions (chunks) by reviewing them on a spaced schedule and
writing a **new** example sentence every review. Data lives in Notion; the app
runs on Next.js and deploys to Vercel.

- **Review** — recall an expression, write a fresh sentence, check yourself
  against the meaning/original example, mark Remembered or Forgot.
- **Add** — capture a new expression (Expression, Meaning, Original Example,
  optional Source).
- **Progress** — totals, remembered rate, expressions that need attention, and a
  14-day activity chart.

## Stack

Next.js 15 (App Router) · React 18 · TypeScript · `@notionhq/client` v2 ·
Vitest. The Notion token is used only in server-side route handlers and never
reaches the browser.

## Notion setup

Create a Notion internal integration and two databases, then share both
databases with the integration.

### Expressions database

| Property           | Type      | Notes                                   |
| ------------------ | --------- | --------------------------------------- |
| `Expression`       | Title     | the chunk                               |
| `Meaning`          | Rich text |                                         |
| `Original Example` | Rich text |                                         |
| `Source`           | Rich text | optional                                |
| `Synonyms`         | Rich text | optional; comma-separated synonyms      |
| `Last Review`      | Date      | empty until first review                |
| `Review Count`     | Number    | total completed reviews                 |
| `Review Due`       | Date      | next due date (new expression = today)  |
| `Review Level`     | Number    | spaced-repetition level 0–5             |

### Review Examples database

| Property       | Type                      | Notes                              |
| -------------- | ------------------------- | ---------------------------------- |
| `Example`      | Title                     | the sentence the user wrote        |
| `Review Date`  | Date                      | when the review happened           |
| `Result`       | Select (`Remembered` / `Forgot`) | outcome of that review      |
| `Expression`   | Relation → Expressions    | links the example to its expression |

Property names must match exactly (they are read/written by name).

## Spaced repetition

- New expression: level 0, count 0, due today, no last review.
- **Remembered**: count +1, level = min(level+1, 5), last review = today,
  next due = today + interval(new level).
- **Forgot**: count +1, level unchanged, last review = today, due = tomorrow;
  the card is not requeued in the current session.
- Interval by resulting level: 1 → +3 days, 2 → +7, 3 → +14, 4–5 → +30.

## Environment variables

Copy `.env.example` to `.env` and fill in:

```
NOTION_TOKEN=secret_...
NOTION_DB_EXPRESSIONS=<expressions database id>
NOTION_DB_REVIEW_EXAMPLES=<review examples database id>
```

`.env` is gitignored — never commit real credentials.

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (schedule, dates, Notion mappers)
npm run build    # production build
```

## Install as an app (PWA)

chunks is an installable PWA — no App Store needed:

- **iOS (Safari):** Share → *Add to Home Screen*.
- **Android/Desktop (Chrome):** address-bar *Install* icon, or menu → *Install app*.

It runs standalone (own icon, no browser chrome). A service worker caches the
app shell for fast loads; data still comes live from Notion via `/api/*`.
Regenerate icons with `npm run gen:icons`.

## Backups

The free Atlas tier (M0) has no automated backups, so a local weekly snapshot
runs on this machine.

- **Manual snapshot:** `npm run backup` → writes an EJSON dump of every
  collection to `~/chunks-backups/chunks-<timestamp>.ejson` (keeps the last 8).
- **Restore:** `npm run restore ~/chunks-backups/<file>.ejson --yes`
  (destructive — replaces current collections with the snapshot).
- **Weekly schedule:** a launchd agent (`scripts/tech.bktech.chunks-backup.plist`,
  installed at `~/Library/LaunchAgents/`) runs the backup every Sunday 09:00.
  Log at `~/chunks-backups/backup.log`. To (re)install on a machine:

  ```bash
  cp scripts/tech.bktech.chunks-backup.plist ~/Library/LaunchAgents/
  # edit the node path + project path inside the plist if they differ, then:
  launchctl unload ~/Library/LaunchAgents/tech.bktech.chunks-backup.plist 2>/dev/null
  launchctl load -w ~/Library/LaunchAgents/tech.bktech.chunks-backup.plist
  ```

## Deploy on Vercel

1. Import the repository into Vercel.
2. Add the three environment variables above in the Vercel project settings
   (Production + Preview).
3. Deploy. The `/api/*` route handlers run as Node.js serverless functions and
   hold the Notion token server-side.
