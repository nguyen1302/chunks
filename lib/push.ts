import webpush from "web-push";
import { pushSubscriptionsCol } from "./db";

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function saveSubscription(sub: Sub): Promise<void> {
  const col = await pushSubscriptionsCol();
  await col.updateOne(
    { endpoint: sub.endpoint },
    { $set: { endpoint: sub.endpoint, keys: sub.keys, createdAt: new Date().toISOString() } },
    { upsert: true },
  );
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await (await pushSubscriptionsCol()).deleteOne({ endpoint });
}

/** Send a payload to every stored subscription; prune ones that are gone. */
export async function sendToAll(payload: { title: string; body: string; url?: string }): Promise<{ total: number; sent: number }> {
  configure();
  const col = await pushSubscriptionsCol();
  const subs = await col.find().toArray();
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload));
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) await col.deleteOne({ endpoint: s.endpoint });
    }
  }
  return { total: subs.length, sent };
}
