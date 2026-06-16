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

export interface TarefaDatas {
  data_inicio_planejada: string | null;
  data_prazo: string | null;
}

export async function getTarefaDatas(
  tarefaId: string,
  accessToken: string,
): Promise<TarefaDatas> {
  assertEnv();
  const url =
    `${SUPABASE_URL}/rest/v1/projeto_tarefas` +
    `?id=eq.${encodeURIComponent(tarefaId)}` +
    `&select=data_inicio_planejada,data_prazo`;
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
