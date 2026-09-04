# Chunks — Learning Features (TTS, Review Modes, Tags, Reminders) — Design

**Date:** 2026-09-04
**Status:** Approved for planning
**Scope:** Three feature areas added to the existing chunks app, built in phases.

## Context

chunks is a Next.js PWA (MongoDB Atlas backend via `lib/store.ts`, pure logic
in `lib/schedule.ts` / `lib/stats.ts` / `lib/synonyms.ts`). Core loop: collect
English words/phrases, review by writing a new sentence, self-grade
(Remembered/Forgot), spaced repetition. This design amplifies recall variety,
adds pronunciation, organization (tags), and habit (reminders).

Global constraints (unchanged): Node ≥20, Notion token/Mongo URI server-only,
dates as `YYYY-MM-DD`, visual language ported from the original design
(Instrument Serif / IBM Plex, palette `#FBFAF7`/`#171614`/`#A9563C`/`#4E6E52`).

---

## Phase 1 — Pronunciation (TTS) + Review Modes

### TTS
- `SpeakButton` client component: on click, `speechSynthesis.speak(new
  SpeechSynthesisUtterance(text))` with `lang="en-US"`, cancelling any ongoing
  utterance first. No-op (hidden) when `speechSynthesis` is unavailable.
- Placed next to the **word/phrase** and the **original example** in: Review
  reveal, Flashcard back, Library detail. Client-only, no data changes.

### Review modes
- Entering the Review tab shows a **mode picker** (4 buttons):
  `Write · Cloze · Reverse · Mixed`. Picking one starts the session in that mode.
  A queue snapshot is taken at session start (Forgot never requeues in-session).
- **Write** (unchanged): recall → write a new sentence → Check reveals
  meaning/example → grade → creates a Review Example via `POST /api/review`.
- **Cloze**: show the original example with the expression blanked (`_____`);
  user recalls it; "Show answer" reveals the full example + expression +
  meaning; grade Remembered/Forgot. **No sentence written.**
- **Reverse**: show the Vietnamese meaning; user recalls the English
  expression; "Show answer" reveals expression + example; grade. **No sentence.**
- **Mixed**: each card is randomly assigned one of Write/Cloze/Reverse.
- **Cloze/Reverse do not create a Review Example** (nothing was written) but
  **do advance the schedule** (Remembered/Forgot via `computeNextReview`).

### Technical changes
- `POST /api/review` + `store.submitReview`: `sentence` becomes **optional**.
  With a non-empty sentence → create a Review Example then update schedule
  (Write). Without a sentence → update schedule only (Cloze/Reverse). Route
  still requires a valid `result` (`Remembered`/`Forgot`).
- `lib/cloze.ts` (pure, unit-tested): `clozeExample(example, expression) ->
  { text, found }`. Case-insensitive blanking of the expression's occurrence in
  the example; when not found (e.g. conjugated forms), `found=false` and the UI
  falls back to a meaning-based cue.
- `ReviewView` refactored: a `mode` state + mode-picker screen; three card
  renderers sharing the reveal/grade footer. Keyboard: ⌘↵ = check/reveal,
  1/2 = grade.

### Testing
- Unit: `lib/cloze.ts` (found / not-found / case-insensitive / multiple words).
- Manual/live: each mode grades correctly; Cloze/Reverse update schedule but add
  no Review Example; Write still adds one.

---

## Phase 2 — Tags / topics

### Data
- Add `tags: string[]` to the expression doc + `Expression` type.
- `lib/tags.ts` reuses the synonyms-style parser: `parseTags(raw)` (split on
  comma/newline, trim, dedupe case-insensitively, lowercase for storage).

### API
- `POST /api/expressions` and `PATCH /api/expressions/[id]` accept `tags`
  (raw string, parsed server-side).
- `getExpressionsWithStats` already returns full expressions → tags flow to the
  client for free.

### UI
- **Add** form: a "Tags" input (comma-separated).
- **Library**: tags shown as small chips on each row/detail; a **tag filter**
  (dropdown or chip row built from all existing tags) narrows the list.
- **Review mode picker**: an optional "Topic" dropdown (default "All topics")
  that filters the session queue by tag. `getDueExpressions` gains an optional
  `tag` filter; `GET /api/review-queue?tag=` passes it through.

### Testing
- Unit: `lib/tags.ts` parsing.
- Live: create with tags, filter Library by tag, start a tag-scoped session.

---

## Phase 3 — Reminders (Web Push)

### Overview
Daily push reminder when the user has words due. Works on installed PWAs
(iOS 16.4+, Android, desktop Chrome). Requires VAPID keys and a scheduled sender.

### Dependencies & env
- Add `web-push` dependency.
- Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
  (`mailto:...`), `CRON_SECRET`. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` exposed to the
  client for subscription. Keys generated once via `web-push generate-vapid-keys`
  (a helper script `scripts/gen-vapid.mjs`).

### Data
- New Mongo collection `pushSubscriptions`: `{ endpoint (unique), keys:{p256dh,
  auth}, createdAt }`. Endpoint is the natural unique id.

### Client
- A "Daily reminders" toggle on the **Progress** page. Enabling: request
  `Notification.permission` → `registration.pushManager.subscribe({
  userVisibleOnly: true, applicationServerKey: <vapid public> })` →
  `POST /api/push/subscribe` with the subscription. Disabling: unsubscribe +
  `POST /api/push/unsubscribe`.
- Reflects current permission/subscription state; explains iOS "install first".

### Service worker (`public/sw.js`)
- Add `push` handler → `showNotification(title, { body, icon, badge, data:{url} })`.
- Add `notificationclick` handler → focus an existing client or open `/`.

### Sender (cron)
- `vercel.json` cron: `{ "path": "/api/cron/remind", "schedule": "0 1 * * *" }`
  (01:00 UTC ≈ 08:00 ICT).
- `GET /api/cron/remind`: verify `Authorization: Bearer <CRON_SECRET>` (Vercel
  sends this automatically for crons when `CRON_SECRET` is set). Compute
  `dueToday` (expressions with `reviewDue <= today`); if > 0, send a push
  ("N words ready to review") to every stored subscription. Prune subscriptions
  that return 404/410 (gone).

### Testing
- Unit: pure "should remind?" helper (due count > 0) if extracted.
- Live: subscribe from the browser, hit `/api/cron/remind` with the secret,
  confirm a notification arrives and dead subscriptions are pruned.

### Caveats (documented in README)
- iOS: only for an installed PWA on 16.4+; permission must be granted.
- Vercel Hobby crons run once/day — daily reminder fits.

---

## Sequencing & isolation

Phases are independent and shipped/committed separately:
1. Phase 1 (Review + TTS) — no schema change.
2. Phase 2 (Tags) — additive schema field.
3. Phase 3 (Push) — new collection + cron + env; isolated from 1–2.

Each phase: unit tests where logic is pure, `npm run build` + live smoke test
against Atlas, commit, push.

## Deltas / risks
- Cloze relies on substring match; conjugated expressions fall back to a
  meaning cue (acceptable, no data needed).
- iOS web push is finicky; if a device won't subscribe, the toggle surfaces the
  reason (not installed / permission denied) rather than failing silently.
