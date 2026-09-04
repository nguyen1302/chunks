// Generate a VAPID keypair for Web Push. Run once; copy the output into .env
// (and the two public lines into Vercel env). Keep the private key secret.
import webpush from "web-push";

const k = webpush.generateVAPIDKeys();
console.log("VAPID_PUBLIC_KEY=" + k.publicKey);
console.log("VAPID_PRIVATE_KEY=" + k.privateKey);
console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=" + k.publicKey);
