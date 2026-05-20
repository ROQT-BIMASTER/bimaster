/**
 * Registra o navegador atual no Web Push (VAPID) e grava a subscription
 * em `push_subscriptions`. Idempotente — pode chamar quantas vezes quiser.
 *
 * Fluxo:
 *  1. ServiceWorker.ready (precisa do SW PWA registrado)
 *  2. pushManager.getSubscription() — reaproveita se já existir
 *  3. caso contrário, pushManager.subscribe({ userVisibleOnly: true,
 *     applicationServerKey: VAPID_PUBLIC_KEY })
 *  4. upsert em push_subscriptions (endpoint é UNIQUE)
 */
import { supabase } from "@/integrations/supabase/client";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "./vapid";
import { logger } from "@/lib/logger";

function bufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return window.btoa(s);
}

export async function registerPushSubscription(): Promise<boolean> {
  try {
    if (typeof window === "undefined") return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    if (Notification.permission !== "granted") return false;

    const reg = await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
      });
    }

    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return false;

    const payload = {
      user_id: uid,
      endpoint: sub.endpoint,
      p256dh: bufferToBase64(sub.getKey("p256dh")),
      auth: bufferToBase64(sub.getKey("auth")),
      user_agent: navigator.userAgent.slice(0, 200),
      last_seen_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("push_subscriptions" as any)
      .upsert(payload, { onConflict: "endpoint" });

    if (error) {
      logger.warn("[push] upsert subscription error", error);
      return false;
    }
    return true;
  } catch (e) {
    logger.warn("[push] registerPushSubscription failed", e);
    return false;
  }
}

export async function unregisterPushSubscription(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await supabase.from("push_subscriptions" as any).delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  } catch {/* noop */}
}
