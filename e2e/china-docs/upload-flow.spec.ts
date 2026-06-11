/**
 * E2E — China: upload → persistência → preview → download.
 *
 * Matriz de papéis (RLS de `china_produto_documentos` + storage `china-documentos`):
 *   EXISTS submissão s WHERE s.id = submissao_id
 *     AND (s.created_by = auth.uid()
 *          OR check_user_access(auth.uid(), 'fabrica')
 *          OR check_user_access(auth.uid(), 'china'))
 *
 * | Papel        | Esperado | Como satisfaz a policy                              |
 * | ------------ | -------- | --------------------------------------------------- |
 * | admin        | allow    | check_user_access (admin tem tudo)                  |
 * | gerente      | allow    | módulo 'fabrica' habilitado                         |
 * | supervisor   | allow    | módulo 'fabrica' habilitado                         |
 * | china_owner  | allow    | created_by = auth.uid() na submissão de teste       |
 * | china_other  | allow    | módulo 'china' habilitado (sem ser dono nem fabrica)|
 * | vendedor     | deny     | sem módulo china/fabrica e não é dono               |
 *
 * Cada papel exige um par de envs E2E_<KEY>_EMAIL / _PASSWORD. Quando
 * faltam, o caso é `skip`-ado (a menos que STRICT_E2E=1 — então falha).
 *
 * Envs (compartilhadas):
 *   E2E_BASE_URL, E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY
 *   E2E_CHINA_SUBMISSAO_ID            (submissão acessível por admin/gerente/supervisor)
 *   E2E_CHINA_OWNER_SUBMISSAO_ID      (submissão CRIADA pelo china_owner)
 *   E2E_CHINA_CHECKLIST_TIPO          (default: "outros")
 *   E2E_ADMIN_TOKEN_EMAIL / _PASSWORD (usado APENAS para verificação REST
 *                                      no caso "deny"; default cai no admin)
 *
 * Em produção, os casos "deny" são pulados para não poluir audit log.
 */
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loginAs, authToken, countDocsSince, type RoleCreds } from "./helpers/auth";

const BASE = process.env.E2E_BASE_URL;
const SUBM = process.env.E2E_CHINA_SUBMISSAO_ID;
const OWNER_SUBM = process.env.E2E_CHINA_OWNER_SUBMISSAO_ID ?? SUBM;
const TIPO = process.env.E2E_CHINA_CHECKLIST_TIPO ?? "outros";
const SB_URL = process.env.E2E_SUPABASE_URL;
const SB_KEY = process.env.E2E_SUPABASE_ANON_KEY;
const STRICT = process.env.STRICT_E2E === "1";
const ENV_NAME = (process.env.E2E_ENV_NAME ?? "").toLowerCase();
const IS_PROD = ENV_NAME === "production" || ENV_NAME === "prod";

const FIXTURE = join(__dirname, "fixtures", "sample.pdf");
const FIXTURE_BUF = (() => {
  try { return readFileSync(FIXTURE); } catch { return null; }
})();

type Outcome = "allow" | "deny";

interface RoleCase {
  key: string;
  emailEnv: string;
  passEnv: string;
  submissaoId: string | undefined;
  expect: Outcome;
  prodSafe: boolean;
}

const ROLES: RoleCase[] = [
  { key: "admin",       emailEnv: "E2E_ADMIN_EMAIL",       passEnv: "E2E_ADMIN_PASSWORD",       submissaoId: SUBM,        expect: "allow", prodSafe: true  },
  { key: "gerente",     emailEnv: "E2E_GERENTE_EMAIL",     passEnv: "E2E_GERENTE_PASSWORD",     submissaoId: SUBM,        expect: "allow", prodSafe: true  },
  { key: "supervisor",  emailEnv: "E2E_SUPERVISOR_EMAIL",  passEnv: "E2E_SUPERVISOR_PASSWORD",  submissaoId: SUBM,        expect: "allow", prodSafe: true  },
  { key: "china_owner", emailEnv: "E2E_CHINA_OWNER_EMAIL", passEnv: "E2E_CHINA_OWNER_PASSWORD", submissaoId: OWNER_SUBM,  expect: "allow", prodSafe: true  },
  { key: "china_other", emailEnv: "E2E_CHINA_OTHER_EMAIL", passEnv: "E2E_CHINA_OTHER_PASSWORD", submissaoId: OWNER_SUBM,  expect: "deny",  prodSafe: false },
  { key: "vendedor",    emailEnv: "E2E_VENDEDOR_EMAIL",    passEnv: "E2E_VENDEDOR_PASSWORD",    submissaoId: SUBM,        expect: "deny",  prodSafe: false },
];

// Credenciais para verificação REST nos casos "deny" (precisa de quem
// realmente enxerga `china_produto_documentos`). Default = admin.
const VERIFIER: RoleCreds | null = (() => {
  const email = process.env.E2E_ADMIN_TOKEN_EMAIL ?? process.env.E2E_ADMIN_EMAIL;
  const pass  = process.env.E2E_ADMIN_TOKEN_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD;
  return email && pass ? { email, password: pass } : null;
})();

function envCreds(c: RoleCase): RoleCreds | null {
  const email = process.env[c.emailEnv];
  const password = process.env[c.passEnv];
  return email && password ? { email, password } : null;
}

async function tryUpload(page: Page, submissaoId: string): Promise<{
  uploaded: boolean;
  blockedAtRoute: boolean;
  errorToast: boolean;
}> {
  await page.goto(`/dashboard/fabrica-china/caixa-entrada?submissaoId=${submissaoId}`);

  // Se o usuário não tem o módulo, o ModuleProtectedRoute renderiza AccessDenied.
  const denied = page.getByText(/não tem permissão|acesso negado/i);
  if (await denied.first().isVisible().catch(() => false)) {
    return { uploaded: false, blockedAtRoute: true, errorToast: false };
  }

  const fileInput = page
    .locator(`[data-testid="china-upload-${TIPO}"] input[type="file"], input[type="file"]`)
    .first();
  const attached = await fileInput.waitFor({ state: "attached", timeout: 10_000 })
    .then(() => true).catch(() => false);
  if (!attached) {
    return { uploaded: false, blockedAtRoute: true, errorToast: false };
  }

  await fileInput.setInputFiles({
    name: "Relatório Teste E2E.pdf",
    mimeType: "application/pdf",
    buffer: FIXTURE_BUF!,
  });

  // Espera o desfecho: ou toast de sucesso, ou toast de erro de permissão.
  const success = page.getByText(/documento.*(enviado|salvo|carregado|anexado)/i);
  const failure = page.getByText(/permissão|negad|denied|sess[ãa]o expirou/i);
  const outcome = await Promise.race([
    success.first().waitFor({ timeout: 60_000 }).then(() => "ok" as const).catch(() => null),
    failure.first().waitFor({ timeout: 60_000 }).then(() => "fail" as const).catch(() => null),
  ]);
  return {
    uploaded: outcome === "ok",
    blockedAtRoute: false,
    errorToast: outcome === "fail",
  };
}

async function verifyDownloadAndPreview(page: Page) {
  const trigger = page.getByText(/Relat[óo]rio Teste E2E/i).first();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByText(/erro|falha/i)).toHaveCount(0);
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30_000 }),
    dialog.getByRole("button", { name: /baixar|download/i }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/Relat[óo]rio Teste E2E\.pdf$/i);
}

async function getVerifierToken(req: APIRequestContext, browser: Page["context"] extends never ? never : Page): Promise<string | null> {
  // unused — placeholder para refactor futuro
  return null;
}

void getVerifierToken;

test.describe("@china-docs upload por papel", () => {
  test.skip(
    !BASE || !SUBM || !SB_URL || !SB_KEY || !FIXTURE_BUF,
    "Defina E2E_BASE_URL, E2E_SUPABASE_URL/ANON_KEY, E2E_CHINA_SUBMISSAO_ID e tenha e2e/china-docs/fixtures/sample.pdf",
  );

  for (const role of ROLES) {
    test.describe.serial(`papel: ${role.key} (${role.expect})`, () => {
      const creds = envCreds(role);

      test(`${role.key} → ${role.expect}`, async ({ page, browser }) => {
        // Skip controlado
        if (!creds) {
          const msg = `Credenciais ausentes (${role.emailEnv}/${role.passEnv})`;
          if (STRICT) throw new Error(msg);
          test.skip(true, msg);
          return;
        }
        if (!role.submissaoId) {
          test.skip(true, "submissaoId ausente para esse papel");
          return;
        }
        if (role.expect === "deny" && IS_PROD && !role.prodSafe) {
          test.skip(true, "caso deny não roda em produção (poluiria audit log)");
          return;
        }

        await loginAs(page, creds);
        const before = Date.now();
        const result = await tryUpload(page, role.submissaoId);

        if (role.expect === "allow") {
          expect(result.uploaded, `papel ${role.key} deveria conseguir upload`).toBeTruthy();
          await verifyDownloadAndPreview(page);
        } else {
          expect(result.uploaded, `papel ${role.key} NÃO deveria conseguir upload`).toBeFalsy();
          expect(
            result.blockedAtRoute || result.errorToast,
            "deve bloquear no route guard ou exibir toast de erro",
          ).toBeTruthy();

          // Verificação cruzada via REST (token do verificador).
          if (VERIFIER) {
            const verifierCtx = await browser.newContext();
            const verifierPage = await verifierCtx.newPage();
            try {
              await loginAs(verifierPage, VERIFIER);
              const tok = await authToken(verifierPage);
              if (tok) {
                const count = await countDocsSince(verifierPage.request, {
                  supabaseUrl: SB_URL!,
                  anonKey: SB_KEY!,
                  token: tok,
                  submissaoId: role.submissaoId!,
                  tipo: TIPO,
                  sinceMs: before - 5_000,
                });
                expect(count, "não deve ter criado linha no DB").toBe(0);
              }
            } finally {
              await verifierCtx.close();
            }
          }
        }
      });
    });
  }
});
