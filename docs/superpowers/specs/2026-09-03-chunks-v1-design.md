# Chunks — English Expression Learning (V1) — Design

**Date:** 2026-09-03
**Status:** Draft for review
**Source spec:** English Expression Learning V1 Business Specification (provided by user)
**Source design:** Claude Design project `Chunks.dc.html` + `support.js`
(project id `7c752993-4a8e-4da1-a202-b75e94536d28`)

## 1. Goal

Ship V1 of "chunks": a web app to learn English expressions/chunks by
reviewing each expression repeatedly and writing a *new* example
sentence every review. Data lives in Notion (2 databases). Deployed on
Vercel. The Notion token stays server-side.

V1 scope is exactly §13 of the business spec: add expression, review
(recall → check → Remembered/Forgot), store every example, spaced
review schedule, basic stats, Notion storage, Vercel deploy. No AI, no
accounts, no notifications.

## 2. Stack & structure

- **Next.js (App Router)** + React + TypeScript, deployed on Vercel.
- **Faithful port** of the `Chunks.dc.html` UI: same three views
  (Review / Add / Progress), same typography (Instrument Serif, IBM
  Plex Sans, IBM Plex Mono), same palette (`#FBFAF7` bg, `#171614`
  ink, `#A9563C` accent, `#4E6E52` "remembered", `#F4F1E9` reveal
  panel), same keyboard shortcuts, same animations (`riseIn`).
- **Server-side Notion layer**: browser never receives the token.

```
chunks/
  app/
    page.tsx                 # client SPA shell (three views)
    layout.tsx               # fonts, global CSS
    globals.css              # base styles ported from design <style>
    components/
      ReviewView.tsx
      AddView.tsx
      ProgressView.tsx
      Header.tsx
    api/
      review-queue/route.ts  # GET due expressions
      expressions/route.ts   # POST create expression
      expressions/[id]/history/route.ts  # GET past examples
      review/route.ts         # POST submit a review (example + schedule update)
      stats/route.ts          # GET stats
  lib/
    notion.ts                # Notion SDK client + record<->type mapping
    schedule.ts              # spaced-repetition interval logic (pure, unit-tested)
    types.ts                 # shared TS types
  docs/superpowers/specs/    # this doc
  .env.example
```

## 3. Data model (Notion)

Two databases already exist. DB IDs + integration token via env:
`NOTION_TOKEN`, `NOTION_DB_EXPRESSIONS`, `NOTION_DB_REVIEW_EXAMPLES`.

### Expressions DB

| Property | Type | Notes |
|---|---|---|
| Expression | Title | the chunk |
| Meaning | Rich text | |
| Original Example | Rich text | |
| Source | Rich text | optional |
| Last Review | Date | null until first review |
| Review Count | Number | total reviews (remembered + forgot) |
| Review Due | Date | next due date; new expr due immediately |
| **Review Level** | **Number** | **SCHEMA ADDITION** — SR level 0..5, drives interval |

**Review Level** is a required addition to the existing DB (one number
property). It is the single source of truth for the interval.

### Review Examples DB

| Property | Type | Notes |
|---|---|---|
| Example | Title (or Rich text) | the sentence the user wrote |
| Review Date | Date | when written |
| Expression | Relation → Expressions | links back to the expression |
| Result | Select (`Remembered` / `Forgot`) | the review outcome |

`Result` is stored on the example so history + stats (remembered/forgot
ratio, frequently-forgotten) are computable from Review Examples.

Every review creates a NEW Review Examples record. Existing records are
never updated or overwritten (business spec §5, §11).

## 4. Spaced repetition (lib/schedule.ts)

Pure functions, unit-tested, no I/O. **Review Count and Review Level
are independent**: Review Count = total completed reviews (both
outcomes); Review Level = current SR level (0–5) that drives the
interval. Both change on every completed review, but by different rules.

Interval by **resulting** level: `1 → +3 days, 2 → +7, 3 → +14, 4 → +30,
5 → +30`. (Level 0 has no interval — it only occurs for a not-yet-
remembered expression, whose due date comes from "new" or "Forgot".)

- **New expression**: `level = 0`, `count = 0`, `due = today`,
  `lastReview = null`.
- **Remembered**: `count += 1`; `level = min(level + 1, 5)`;
  `lastReview = today`; `due = today + interval(level)`.
- **Forgot**: `count += 1`; `level` unchanged (no advance, business
  spec §6); `lastReview = today`; `due = tomorrow`. The expression is
  **not** requeued into the current session (see §5).

```
computeNextReview(level, count, result, today) ->
  { level, count, due, lastReview }   // caller writes all four to Notion
```

Dates are date-only (no time-of-day). "Due" means `Review Due <= today`.

Note: this schedule intentionally supersedes business spec §6's literal
"first review → 1 day" step; per the user's V1 correction the ladder is
+3 / +7 / +14 / +30 keyed on resulting level, with no 1-day step.

## 5. Review queue & flow (business spec §4, §7)

- `GET /api/review-queue` returns expressions with `Review Due <= today`,
  ordered by due date ascending (oldest-due first), capped at a session
  size (e.g. 20). Returns `[]` when nothing is due.
- UI flow per the design:
  1. **Recall** — show Expression only + progress bar; textarea for the
     new sentence. Meaning/Original Example hidden.
  2. **Check** (⌘↵ or "Check answer", requires non-empty draft) —
     reveal Meaning, Original Example, Source, and **the user's current
     answer**. History (past sentences) is **not** shown automatically;
     it sits behind a secondary action — a "Show past sentences"
     toggle/link — that lazily loads history only when the user asks.
  3. **Result** — Remembered (`1`) or Forgot (`2`) →
     `POST /api/review` → advance to next card.
- **Skip** moves to the next card without recording anything: no
  review-data change, no Review Example created.
- **Forgot does not requeue in the current session.** A Forgot card is
  scheduled for tomorrow and the session advances past it; it will not
  reappear until a future session. (The current session works from the
  queue snapshot taken at session start.)
- When the queue is exhausted → "Session done" screen (design's
  `sessionDone`). When nothing was ever due → "Nothing to review yet"
  empty state.

### POST /api/review payload

```
{ expressionId, sentence, result: "Remembered" | "Forgot" }
```

Server: (1) create Review Examples record (Example=sentence,
Review Date=today, Expression=relation, Result); (2) update the
expression via `computeNextReview`: set Review Level, Review Due,
Last Review=today, Review Count+1.

## 6. Add expression (business spec §3)

- `AddView` form: Expression, Meaning, Original Example, Source
  (optional). ⌘↵ or "Save".
- `POST /api/expressions` creates the record with Review Level=0,
  Review Due=today, Review Count=0, Last Review=null.
- "Saved — <expr>" confirmation + "Recently added" list (from the
  expressions the client already holds, or a light refetch).

## 7. Stats (business spec §9) — Progress view

Mapping the design's Progress layout to the spec's required stats. The
"Solid / Level ≥ 3" tile from the prototype is **removed** — there is no
business requirement for it. The third tile is repurposed to a spec §9
metric.

- **Three tiles**: `statTotal` = total expressions; `statSentences` =
  total review examples written; `statRememberedRate` = overall
  Remembered rate across all completed reviews (spec §9
  remembered/forgot ratio), shown as a percentage.
- **Needs attention** = frequently-forgotten expressions (spec §9),
  ranked by Forgot rate. **Only expressions with ≥ 2 completed reviews
  are eligible** for ranking, so a single unlucky review doesn't
  dominate the list. Ties broken by higher review count. "Review
  these →" starts a session.
- **Last 14 days** = per-day count of reviews (from Review Examples
  Review Date), design's mini bar chart. Covers "reviews today" and
  retention-over-time.
- Remembered/Forgot ratio computed from Review Examples `Result`.

`GET /api/stats` aggregates server-side and returns a single JSON blob
shaped for the Progress view. For V1, computed by fetching all
expressions + examples (dataset is small, single user).

## 8. Data flow

```
Browser (React SPA)
  → fetch app/api/* (same-origin route handlers on Vercel)
    → lib/notion.ts (Notion SDK, token from env)
      → Notion REST API
        → Expressions / Review Examples DBs
```

The browser never calls Notion directly and never sees `NOTION_TOKEN`.

## 9. Error handling

- API routes return `{ error }` + appropriate status; never leak token
  or raw Notion errors to the client body.
- Client shows inline non-blocking errors (e.g. save failed → keep the
  form populated, show a retry affordance). No alert() dialogs.
- Missing/invalid env at startup → route returns 500 with a generic
  message; documented in `.env.example`.

## 10. Testing

- **Unit (primary):** `lib/schedule.ts` — interval progression,
  Remembered advances, Forgot holds level, level cap at 5, due-date
  math, new-expression defaults. TDD.
- **Mapping tests:** `lib/notion.ts` record↔type mapping with fixture
  Notion payloads (no network).
- **Route handlers:** tested with the Notion client mocked — assert the
  right create/update calls (esp. "review creates a NEW example, never
  updates an old one").
- Manual smoke on Vercel preview against a real test Notion workspace.

## 11. Out of scope (business spec §13)

AI, auto-discovery of expressions, transcript analysis, AI scoring,
pronunciation, gamification, multi-user accounts, notifications, mobile
app.

## 12. Deltas from the design file (intentional)

The `Chunks.dc.html` prototype is UI-truthful but backs onto
localStorage with a *score-based* queue. V1 keeps its UI verbatim but
replaces the data/logic layer:

- **Storage**: localStorage → Notion via server routes.
- **Queue**: score-sort → **due-date spaced repetition** (the user's V1
  schedule correction is the behavioral source of truth).
- **Level**: added explicit **Review Level** property, tracked
  independently from Review Count.
- **Forgot**: due = tomorrow and the card is **not** requeued in the
  current session (prototype re-sorted it back into rotation).
- **History**: the prototype auto-revealed past sentences on Check; V1
  shows the current answer first and puts history behind a secondary
  "Show past sentences" action.
- **Progress third tile**: prototype's "feel solid" (Level ≥ 3) is
  replaced by the Remembered-rate metric; "Needs attention" now
  requires ≥ 2 completed reviews before ranking.
- Everything else visual (layout, type, color, motion, shortcuts,
  empty/done states) is ported faithfully.
