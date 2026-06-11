/**
 * Helpers compartilhados pelos specs de China Docs.
 * Mantém o spec principal enxuto e reusável por papel.
 */
import { expect, type APIRequestContext, type Page } from "@playwright/test";

export interface RoleCreds {
  email: string;
  password: string;
}

export async function loginAs(page: Page, { email, password }: RoleCreds) {
  await page.goto("/auth");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  // Usuários sem acesso ao dashboard caem em /portal/* ou /access-denied;
  // aceitamos qualquer URL pós-login que não seja /auth.
  await page.waitForURL((url) => !/\/auth(\/|$)/.test(url.pathname), { timeout: 30_000 });
}

export async function authToken(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
        try {
          const v = JSON.parse(localStorage.getItem(k) ?? "{}");
          return v?.access_token ?? null;
        } catch { /* ignore */ }
      }
    }
    return null;
  });
}

/**
 * Conta documentos criados em `china_produto_documentos` para um par
 * (submissao_id, tipo_documento) após `sinceMs`. Usa o token do usuário
 * logado — respeita RLS — então sempre faça a chamada com um token
 * de admin/gerente para a verificação ser determinística.
 */
export async function countDocsSince(
  req: APIRequestContext,
  opts: {
    supabaseUrl: string;
    anonKey: string;
    token: string;
    submissaoId: string;
    tipo: string;
    sinceMs: number;
  },
): Promise<number> {
  const url =
    `${opts.supabaseUrl}/rest/v1/china_produto_documentos` +
    `?select=id,created_at` +
    `&submissao_id=eq.${opts.submissaoId}` +
    `&tipo_documento=eq.${opts.tipo}` +
    `&created_at=gte.${new Date(opts.sinceMs).toISOString()}`;
  const res = await req.get(url, {
    headers: {
      apikey: opts.anonKey,
      Authorization: `Bearer ${opts.token}`,
    },
  });
  expect(res.ok(), `GET ${url} → ${res.status()}`).toBeTruthy();
  const rows = await res.json();
  return Array.isArray(rows) ? rows.length : 0;
}
