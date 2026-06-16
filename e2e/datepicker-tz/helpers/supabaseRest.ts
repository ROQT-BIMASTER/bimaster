/**
 * Wrapper REST direto para PostgREST, usado pela suíte de timezone para
 * validar o valor PERSISTIDO no backend (coluna Postgres DATE), sem depender
 * exclusivamente do que a UI exibe — assim qualquer shift fica visível em
 * algum dos dois lados.
 */
const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY ?? "";

function assertEnv() {
  if (!SUPABASE_URL) throw new Error("E2E_SUPABASE_URL ausente");
  if (!SUPABASE_ANON_KEY) throw new Error("E2E_SUPABASE_ANON_KEY ausente");
}

export type TarefaDateColumn =
  | "data_inicio_planejada"
  | "data_prazo"
  | "data_proxima_acao";

export type TarefaDatas = Partial<Record<TarefaDateColumn, string | null>>;

const ALL_COLS: TarefaDateColumn[] = [
  "data_inicio_planejada",
  "data_prazo",
  "data_proxima_acao",
];

export async function getTarefaDatas(
  tarefaId: string,
  accessToken: string,
  cols: TarefaDateColumn[] = ALL_COLS,
): Promise<TarefaDatas> {
  assertEnv();
  const select = cols.join(",");
  const url =
    `${SUPABASE_URL}/rest/v1/projeto_tarefas` +
    `?id=eq.${encodeURIComponent(tarefaId)}` +
    `&select=${encodeURIComponent(select)}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`PostgREST GET projeto_tarefas falhou: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as TarefaDatas[];
  if (rows.length === 0) {
    throw new Error(`Tarefa ${tarefaId} não encontrada (RLS ou id inválido)`);
  }
  return rows[0];
}

/**
 * PATCH direto via PostgREST autenticado. Usado pela suíte para "semear"
 * estados específicos (ex.: null) antes de validar o que a UI exibe.
 *
 * O usuário do token precisa ter permissão de UPDATE na tarefa (mesmas
 * regras de RLS que a UI). A função joga erro com corpo da resposta para
 * falhar o teste de forma legível.
 */
export async function patchTarefaDatas(
  tarefaId: string,
  accessToken: string,
  patch: TarefaDatas,
): Promise<TarefaDatas> {
  assertEnv();
  const url =
    `${SUPABASE_URL}/rest/v1/projeto_tarefas` +
    `?id=eq.${encodeURIComponent(tarefaId)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      Accept: "application/json",
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(`PostgREST PATCH projeto_tarefas falhou: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as TarefaDatas[];
  return rows[0] ?? {};
}

