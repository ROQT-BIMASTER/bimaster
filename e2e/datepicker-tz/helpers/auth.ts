/**
 * Helper de login compartilhado pela suíte de timezone do datepicker.
 *
 * Reusa o mesmo padrão de e2e/aprovacoes/00-smoke-permissoes.spec.ts e
 * e2e/projetos/00-smoke-projetos.spec.ts, mas isolado nesta pasta para não
 * acoplar a suíte nova ao layout dos seeds dessas áreas.
 */
import type { Page } from "@playwright/test";

export async function login(page: Page): Promise<void> {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_TEST_EMAIL / E2E_TEST_PASSWORD ausentes");
  }
  await page.goto("/auth");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

/**
 * Recupera o access_token do supabase-js gravado em localStorage pela página
 * já logada. Necessário para chamadas REST diretas autenticadas (PostgREST
 * respeita RLS quando o JWT é enviado no header Authorization).
 *
 * O storage key segue o padrão `sb-<project-ref>-auth-token` desde supabase-js v2.
 */
export async function getAccessToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const tok = parsed?.access_token ?? parsed?.currentSession?.access_token;
        if (typeof tok === "string" && tok.length > 0) return tok;
      } catch {
        /* ignore */
      }
    }
    return "";
  });
  if (!token) throw new Error("access_token do supabase não encontrado no localStorage");
  return token;
}
