# Learning Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pronunciation (TTS), varied review modes (Cloze/Reverse/Mixed), tags/topics, and daily web-push reminders to the chunks app.

**Architecture:** Extend the existing Next.js + MongoDB app. Pure logic in small `lib/*` modules (unit-tested); data access in `lib/store.ts`; API route handlers under `app/api`; client views under `app/components`. Three independent phases, each committed separately.

**Tech Stack:** Next.js 15 (App Router), React 18, TypeScript, MongoDB driver, Vitest, Web Speech API (TTS), Web Push (`web-push`) + Vercel Cron.

**Spec:** `docs/superpowers/specs/2026-09-04-learning-features-design.md`

## Global Constraints

- Node ≥ 20; package manager npm. Mongo URI / VAPID keys / CRON_SECRET are server-only (never in client bundles except `NEXT_PUBLIC_VAPID_PUBLIC_KEY`).
- Dates are `YYYY-MM-DD` strings. Palette: bg `#FBFAF7`, ink `#171614`, accent `#A9563C` (hover `#8C4530`), green `#4E6E52`, muted `#B4AFA3`/`#A79F90`, hairline `#EDE9E0`. Fonts: Instrument Serif (display), IBM Plex Sans (body), IBM Plex Mono (labels).
- API routes: `runtime="nodejs"`, `dynamic="force-dynamic"`; errors via `errorResponse(msg, err)`.
- Cloze/Reverse reviews update the schedule but never create a Review Example. Only Write mode writes a sentence.

---

# PHASE 1 — TTS + Review Modes

## Task 1: Cloze helper (TDD)

**Files:**
- Create: `lib/cloze.ts`, `test/cloze.test.ts`

**Interfaces:**
- Produces: `clozeExample(example: string, expression: string): { text: string; found: boolean }` — replaces the first case-insensitive occurrence of `expression` in `example` with `_____`; `found=false` (and `text=example`) when absent.

- [ ] **Step 1: Failing test** — `test/cloze.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { clozeExample } from "../lib/cloze";

describe("clozeExample", () => {
  it("blanks the expression case-insensitively", () => {
    expect(clozeExample("I ran into a problem today.", "ran into a problem")).toEqual({
      text: "I _____ today.", found: true,
    });
  });
  it("matches regardless of case", () => {
    expect(clozeExample("Circle back later.", "circle back").found).toBe(true);
  });
  it("returns found=false when the expression is not present", () => {
    expect(clozeExample("We solved it.", "run into a problem")).toEqual({
      text: "We solved it.", found: false,
    });
  });
});
```

- [ ] **Step 2:** `npm test` → FAIL (module missing).

- [ ] **Step 3: Implement** — `lib/cloze.ts`:
```ts
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function clozeExample(example: string, expression: string): { text: string; found: boolean } {
  const expr = expression.trim();
  if (!expr) return { text: example, found: false };
  const re = new RegExp(escapeRegExp(expr), "i");
  if (!re.test(example)) return { text: example, found: false };
  return { text: example.replace(re, "_____"), found: true };
}
```

- [ ] **Step 4:** `npm test` → PASS.

- [ ] **Step 5: Commit** `git add lib/cloze.ts test/cloze.test.ts && git commit -m "feat: cloze helper for review mode"`

---

## Task 2: submitReview accepts optional sentence

**Files:**
- Modify: `lib/store.ts` (`submitReview`), `app/api/review/route.ts`

**Interfaces:**
- Produces: `submitReview({ expressionId, sentence?, result }, today)` — creates a Review Example only when `sentence` is a non-empty string; always updates the schedule.

- [ ] **Step 1:** In `lib/store.ts`, change the signature and guard example creation:
```ts
export async function submitReview(
  input: { expressionId: string; sentence?: string; result: ReviewResult },
  today: string,
): Promise<void> {
  const expr = await getExpression(input.expressionId);
  const next = computeNextReview({ level: expr.level, reviewCount: expr.reviewCount }, input.result, today);

  const sentence = (input.sentence ?? "").trim();
  if (sentence) {
    const examples = await reviewExamplesCol();
    await examples.insertOne({ sentence, reviewDate: today, result: input.result, expressionId: input.expressionId });
  }

  const exprs = await expressionsCol();
  await exprs.updateOne(
    { _id: oid(input.expressionId) },
    { $set: { level: next.level, reviewCount: next.reviewCount, reviewDue: next.reviewDue, lastReview: next.lastReview } },
  );
}
```

- [ ] **Step 2:** In `app/api/review/route.ts`, make `sentence` optional (require only a valid result):
```ts
    const expressionId = body?.expressionId;
    const sentence = (body?.sentence ?? "").trim();
    const result = body?.result;
    if (!expressionId || (result !== "Remembered" && result !== "Forgot")) {
      return NextResponse.json({ error: "Invalid review payload" }, { status: 400 });
    }
    await submitReview({ expressionId, sentence: sentence || undefined, result }, todayStr());
```

- [ ] **Step 3:** `npx tsc --noEmit` → clean; `npm run build` → succeeds.

- [ ] **Step 4: Commit** `git add lib/store.ts app/api/review/route.ts && git commit -m "feat: review submit without a sentence (for cloze/reverse)"`

---

## Task 3: SpeakButton component

**Files:**
- Create: `app/components/SpeakButton.tsx`

**Interfaces:**
- Produces: `<SpeakButton text={string} label?={string} />` — a small speaker button; speaks `text` in en-US; renders `null` when `speechSynthesis` is unavailable.

- [ ] **Step 1: Implement** — `app/components/SpeakButton.tsx`:
```tsx
"use client";
import { useState, useEffect } from "react";

export default function SpeakButton({ text, size = 16 }: { text: string; size?: number }) {
  const [ok, setOk] = useState(false);
  useEffect(() => { setOk(typeof window !== "undefined" && "speechSynthesis" in window); }, []);
  if (!ok || !text) return null;
  function speak(e: React.MouseEvent) {
    e.stopPropagation();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
  return (
    <button onClick={speak} aria-label="Play pronunciation" title="Play pronunciation"
      style={{ border: "none", background: "none", cursor: "pointer", padding: 4, color: "#A9563C", lineHeight: 0, verticalAlign: "middle" }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 2:** `npm run build` → succeeds. Commit `git add app/components/SpeakButton.tsx && git commit -m "feat: SpeakButton (TTS via Web Speech API)"`

---

## Task 4: ReviewView — mode picker + Cloze/Reverse + TTS

**Files:**
- Modify: `app/components/ReviewView.tsx`

**Interfaces:**
- Consumes: `clozeExample`, `SpeakButton`, `POST /api/review` (sentence optional).
- Behavior: session starts from a mode picker; per-card rendering differs by mode; Cloze/Reverse call `/api/review` without a sentence.

**Reference:** current `ReviewView.tsx` (Write flow, keyboard handling, done/empty states, styles). Keep those. Add:
- `mode` state: `"write" | "cloze" | "reverse" | null` (null = show picker). `Mixed` sets a per-card mode array.
- Before session (mode === null), render a picker: heading "How do you want to review?" + 4 buttons (Write / Cloze / Reverse / Mixed) using `btnDark`/`btnLight` styles. Mixed → assign each queued card a random mode in `cardModes[]`.
- Per card, effective mode = `mode` (or `cardModes[qi]` for mixed).
- **Write**: existing UI (textarea, Check, reveal, grade). On grade → `/api/review` with sentence.
- **Cloze**: prompt "Recall the expression" + `clozeExample(cur.example, cur.text)` — show `text` (or, when `found=false`, show the meaning as the cue with label "Meaning"). Button "Show answer" → reveal full example (with SpeakButton) + the expression (big, with SpeakButton) + meaning → grade. On grade → `/api/review` **without** sentence.
- **Reverse**: show `cur.meaning` big as the cue. "Show answer" → reveal expression (big + SpeakButton) + example (+ SpeakButton). Grade → `/api/review` without sentence.
- Add `<SpeakButton text={cur.text} />` next to the revealed expression and `<SpeakButton text={cur.example} />` next to the example, in all modes.
- Grade handler generalized: `mark(ok)` builds body `{ expressionId, result, sentence? }` where sentence is included only in Write mode.
- After session ends, the done screen returns to the mode picker on "Review again".

- [ ] **Step 1:** Refactor `ReviewView` per the above. Keep Write behavior identical.
- [ ] **Step 2:** `npx tsc --noEmit` clean; `npm run build` succeeds.
- [ ] **Step 3:** Commit `git add app/components/ReviewView.tsx && git commit -m "feat: review mode picker (Write/Cloze/Reverse/Mixed) + TTS"`

---

## Task 5: TTS in Flashcard + Library

**Files:**
- Modify: `app/components/FlashcardView.tsx`, `app/components/LibraryView.tsx`

- [ ] **Step 1:** In `FlashcardView` flipped view, add `<SpeakButton text={current.text} />` by the word and `<SpeakButton text={current.example} />` by the example.
- [ ] **Step 2:** In `LibraryView` expanded detail, add `<SpeakButton text={e.text} />` by the (row header or) original example line.
- [ ] **Step 3:** `npm run build` succeeds. Live smoke: Phase-1 modes + TTS work (see Task 6).
- [ ] **Step 4:** Commit `git add app/components/FlashcardView.tsx app/components/LibraryView.tsx && git commit -m "feat: TTS in flashcard and library"`

---

## Task 6: Phase 1 live verification

- [ ] Start `npm start`. For a due expression: **Write** grades + creates a Review Example (check via `/api/expressions/[id]/history`). **Cloze** and **Reverse** grade, advance `reviewDue`/`level`, and add **no** new example. Confirm via Mongo counts before/after. Verify TTS button appears (browser).
- [ ] `npm test` (cloze test green) + `npm run build` green.

---

# PHASE 2 — Tags / topics

## Task 7: tags parser (TDD) + type + store

**Files:**
- Create: `lib/tags.ts`, `test/tags.test.ts`
- Modify: `lib/types.ts` (add `tags: string[]` to `Expression`), `lib/store.ts` (map/create/update tags), `lib/db.ts` (`ExpressionDoc.tags`)

**Interfaces:**
- Produces: `parseTags(raw: string): string[]` (split comma/newline, trim, lowercase, dedupe).

- [ ] **Step 1: Failing test** — `test/tags.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseTags } from "../lib/tags";
describe("parseTags", () => {
  it("lowercases, trims, splits, dedupes", () => {
    expect(parseTags("Work, travel\nWORK")).toEqual(["work", "travel"]);
  });
  it("returns [] for empty", () => { expect(parseTags("  , \n")).toEqual([]); });
});
```
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implement** — `lib/tags.ts`:
```ts
export function parseTags(raw: string): string[] {
  const out: string[] = [], seen = new Set<string>();
  for (const p of (raw ?? "").split(/[,\n]/)) {
    const s = p.trim().toLowerCase();
    if (!s || seen.has(s)) continue;
    seen.add(s); out.push(s);
  }
  return out;
}
```
- [ ] **Step 4:** Add `tags: string[];` to `Expression` in `lib/types.ts` and to `ExpressionDoc` in `lib/db.ts`. In `lib/store.ts`: `mapExpression` → `tags: doc.tags ?? []`; `createExpression` input gains `tags?: string[]` and writes `tags: input.tags ?? []`; `updateExpression` input gains `tags: string[]` and `$set` includes `tags`.
- [ ] **Step 5:** `npm test` PASS; `npx tsc --noEmit` clean.
- [ ] **Step 6: Commit** `git add lib/tags.ts test/tags.test.ts lib/types.ts lib/db.ts lib/store.ts && git commit -m "feat: tags on expressions (data layer)"`

---

## Task 8: tags in API + tag-filtered queue

**Files:**
- Modify: `app/api/expressions/route.ts` (POST accepts tags), `app/api/expressions/[id]/route.ts` (PATCH accepts tags), `lib/store.ts` (`getDueExpressions` optional tag), `app/api/review-queue/route.ts` (read `?tag=`)

- [ ] **Step 1:** POST + PATCH: parse `body.tags` via `parseTags` and pass to create/update.
- [ ] **Step 2:** `getDueExpressions(today, limit=20, tag?)` — when `tag` set, add `tags: tag` to the filter. `review-queue` route reads `new URL(req.url).searchParams.get("tag")` and passes it (route GET gains `req: Request` param).
- [ ] **Step 3:** `npm run build` succeeds. Commit `git add app/api lib/store.ts && git commit -m "feat: tags in API + tag-filtered review queue"`

---

## Task 9: tags in UI (Add / Library filter / Review picker)

**Files:**
- Modify: `app/components/AddView.tsx`, `app/components/LibraryView.tsx`, `app/components/ReviewView.tsx`, `app/page.tsx`

- [ ] **Step 1: Add form** — add a "Tags" input (`f.tags`), include `tags: f.tags` in the POST body, reset it on save.
- [ ] **Step 2: Library** — show tags as small chips (mono, `#F4F1E9` bg) on each detail; a tag filter row built from `[...new Set(all.flatMap(e => e.tags))]`; clicking a tag narrows `rows`. Include tags in the edit form (`form.tags` seeded from `e.tags.join(", ")`, sent in PATCH).
- [ ] **Step 3: Review picker** — a "Topic" `<select>` (default "All topics") built from all tags (fetch via existing `/api/expressions` or pass down from page). On start, if a tag is chosen, fetch `/api/review-queue?tag=<tag>` instead of the plain queue. `page.tsx` `loadQueue` gains an optional tag arg.
- [ ] **Step 4:** `npm run build` succeeds; live smoke (Task 10). Commit `git add app/ && git commit -m "feat: tags UI — add, library filter, review by topic"`

---

## Task 10: Phase 2 live verification

- [ ] Create an expression with tags `work, api`; confirm stored lowercased/deduped. Filter Library by `work`. Start a Review session scoped to `work` and confirm the queue only contains tagged items. `npm test` + `npm run build` green.

---

# PHASE 3 — Web Push reminders

## Task 11: VAPID keys + env + deps

**Files:**
- Create: `scripts/gen-vapid.mjs`
- Modify: `package.json` (add `web-push`), `.env.example`, `.env` (local, not committed)

- [ ] **Step 1:** `npm install web-push`.
- [ ] **Step 2:** `scripts/gen-vapid.mjs`:
```js
import webpush from "web-push";
const k = webpush.generateVAPIDKeys();
console.log("VAPID_PUBLIC_KEY=" + k.publicKey);
console.log("VAPID_PRIVATE_KEY=" + k.privateKey);
console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=" + k.publicKey);
```
- [ ] **Step 3:** `node scripts/gen-vapid.mjs` → append the three lines to `.env`, plus `VAPID_SUBJECT=mailto:dev1.bachkhoa@gmail.com` and `CRON_SECRET=<random hex>` (generate with `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`).
- [ ] **Step 4:** Add all five keys (placeholders) to `.env.example`.
- [ ] **Step 5: Commit** `git add package.json package-lock.json scripts/gen-vapid.mjs .env.example && git commit -m "chore: web-push dep + VAPID key generator + env"`

---

## Task 12: push subscription storage + API

**Files:**
- Create: `app/api/push/subscribe/route.ts`, `app/api/push/unsubscribe/route.ts`, `lib/push.ts`
- Modify: `lib/db.ts` (add `pushSubscriptionsCol`)

**Interfaces:**
- `lib/push.ts` produces: `saveSubscription(sub)`, `removeSubscription(endpoint)`, `getSubscriptions()`, `sendToAll(payload)` (uses `web-push`, prunes 404/410).

- [ ] **Step 1:** In `lib/db.ts` add:
```ts
export interface PushSubscriptionDoc { _id?: ObjectId; endpoint: string; keys: { p256dh: string; auth: string }; createdAt: string; }
export async function pushSubscriptionsCol() { return (await getDb()).collection<PushSubscriptionDoc>("pushSubscriptions"); }
```
and in `getDb` index setup add `db.collection("pushSubscriptions").createIndex({ endpoint: 1 }, { unique: true })`.
- [ ] **Step 2:** `lib/push.ts`:
```ts
import webpush from "web-push";
import { pushSubscriptionsCol } from "./db";

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}
export async function saveSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const col = await pushSubscriptionsCol();
  await col.updateOne({ endpoint: sub.endpoint }, { $set: { endpoint: sub.endpoint, keys: sub.keys, createdAt: new Date().toISOString() } }, { upsert: true });
}
export async function removeSubscription(endpoint: string) {
  await (await pushSubscriptionsCol()).deleteOne({ endpoint });
}
export async function sendToAll(payload: { title: string; body: string; url?: string }) {
  configure();
  const col = await pushSubscriptionsCol();
  const subs = await col.find().toArray();
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload));
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await col.deleteOne({ endpoint: s.endpoint });
    }
  }
  return { total: subs.length, sent };
}
```
- [ ] **Step 3:** `app/api/push/subscribe/route.ts` (POST body = a PushSubscription JSON) → `saveSubscription({ endpoint, keys })` → `{ ok: true }`. `unsubscribe` route → `removeSubscription(endpoint)`.
- [ ] **Step 4:** `npx tsc --noEmit` clean; `npm run build` succeeds. Commit `git add lib/db.ts lib/push.ts app/api/push && git commit -m "feat: push subscription storage + api"`

---

## Task 13: service worker push handlers + client toggle

**Files:**
- Modify: `public/sw.js`, `app/components/ProgressView.tsx`
- Create: `app/components/ReminderToggle.tsx`

- [ ] **Step 1:** In `public/sw.js` add:
```js
self.addEventListener("push", (event) => {
  let data = { title: "chunks", body: "Time to review." };
  try { data = event.data ? event.data.json() : data; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: "/icon-192.png", badge: "/icon-192.png", data: { url: data.url || "/" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window" }).then((cs) => {
    for (const c of cs) if ("focus" in c) return c.focus();
    return clients.openWindow(event.notification.data?.url || "/");
  }));
});
```
Bump `const CACHE = "chunks-v2";` so the SW updates.
- [ ] **Step 2:** `ReminderToggle.tsx` (client): shows a button reflecting state. On enable → check `"Notification" in window && "serviceWorker" in navigator && "PushManager" in window`; request permission; `reg = await navigator.serviceWorker.ready`; `sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) })`; POST to `/api/push/subscribe`. On disable → `sub.unsubscribe()` + POST `/api/push/unsubscribe`. Include the standard `urlBase64ToUint8Array` helper. If unsupported/denied, show the reason (e.g. "Install the app first on iOS").
- [ ] **Step 3:** Render `<ReminderToggle />` in `ProgressView` (a "Daily reminders" row near the top).
- [ ] **Step 4:** `npm run build` succeeds. Commit `git add public/sw.js app/components/ReminderToggle.tsx app/components/ProgressView.tsx && git commit -m "feat: push SW handlers + reminder toggle"`

---

## Task 14: cron reminder endpoint + schedule

**Files:**
- Create: `app/api/cron/remind/route.ts`
- Modify: `vercel.json` (add crons), `README.md`

- [ ] **Step 1:** `app/api/cron/remind/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getStats } from "@/lib/store";
import { sendToAll } from "@/lib/push";
import { todayStr } from "@/lib/dates";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const stats = await getStats(todayStr());
    const due = stats.activity.dueToday;
    if (due <= 0) return NextResponse.json({ skipped: true, due });
    const res = await sendToAll({ title: "chunks", body: `${due} word${due === 1 ? "" : "s"} ready to review.`, url: "/" });
    return NextResponse.json({ due, ...res });
  } catch (err) {
    return errorResponse("Failed to send reminders", err);
  }
}
```
- [ ] **Step 2:** In `vercel.json` add:
```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "regions": ["sin1"], "crons": [{ "path": "/api/cron/remind", "schedule": "0 1 * * *" }] }
```
- [ ] **Step 3:** README: document reminders (VAPID env, CRON_SECRET, iOS install-first caveat, how to add env on Vercel).
- [ ] **Step 4:** `npm run build` succeeds. Commit `git add app/api/cron vercel.json README.md && git commit -m "feat: daily reminder cron (08:00 ICT)"`

---

## Task 15: Phase 3 live verification (local + deploy notes)

- [ ] Local: `npm start`; subscribe from the browser (grant permission) → confirm a doc in `pushSubscriptions`. Call `curl -H "authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/remind` → if `dueToday>0`, a notification appears; response shows `sent`.
- [ ] Confirm `sendToAll` prunes a dead subscription (unsubscribe in browser, re-run cron → 410 → doc removed).
- [ ] Document (not execute): add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` to Vercel env; redeploy; Vercel Cron runs daily.
- [ ] `npm test` + `npm run build` green. Final push.

---

## Self-Review Notes

- **Spec coverage:** TTS (Tasks 3,5, ReviewView in 4) · mode picker + Cloze/Reverse + optional-sentence submit (Tasks 1,2,4) · tags data/API/UI (Tasks 7,8,9) · tag-filtered queue (8,9) · push storage/api (12) · SW + toggle (13) · cron sender (14) · verifications (6,10,15).
- **No new Review Example for Cloze/Reverse:** enforced by omitting `sentence` in Task 4's grade body + Task 2's guard.
- **Type consistency:** `Expression.tags: string[]` added in Task 7 and consumed in 8/9; `submitReview` optional `sentence` in Task 2 consumed in 4; `sendToAll`/`saveSubscription` names consistent across 12/13/14.
- **Secrets:** VAPID private + CRON_SECRET server-only; only `NEXT_PUBLIC_VAPID_PUBLIC_KEY` client-exposed. `.env` stays gitignored.
