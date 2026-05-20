/**
 * Chave pública VAPID — é pública por design (o navegador a envia ao
 * push service da Apple/Google). Pode ficar versionada no repo.
 *
 * Privada (VAPID_PRIVATE_KEY) e subject (VAPID_SUBJECT) ficam apenas
 * em secrets do backend, consumidos pela edge `send-push-notification`.
 *
 * Para rotacionar: gerar novo par, atualizar aqui + secrets, e expirar
 * todas as `push_subscriptions` existentes (cliente re-registra na próxima
 * permissão).
 */
export const VAPID_PUBLIC_KEY =
  "BChIsoAhrQdcIRDz-bnD7sTzvDHhIjda8Qx-DQilMlXF1vidHYvjOZlwDb2lGSPl50ELCoarxKtBl-eaGtyfjvY";

/** Converte base64url para Uint8Array (formato que PushManager exige). */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}
