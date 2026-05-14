/**
 * Feature flags simples para rollouts graduais e refatorações de risco.
 * Fonte: variável de ambiente Vite (`VITE_FF_*`) OU localStorage (`ff_*=1`).
 *
 * localStorage permite ativação por usuário em piloto interno sem novo deploy.
 * Use em refatorações com possibilidade de regressão (D1 lazy drawer, D3 RPC ordering, etc).
 */

function readEnv(key: string): boolean {
  try {
    const v = (import.meta.env as Record<string, string | undefined>)[key];
    return v === "true" || v === "1";
  } catch {
    return false;
  }
}

function readLs(key: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function flag(envKey: string, lsKey: string): boolean {
  return readEnv(envKey) || readLs(lsKey);
}

/** D1 — Lazy mounting das seções do drawer de tarefa. */
export const isLazyDrawerEnabled = () => flag("VITE_FF_LAZY_DRAWER", "ff_lazy_drawer");

/** D3 — Cálculo de `ordem` no servidor via RPC `inserir_projeto_tarefa`. */
export const isServerSideOrderingEnabled = () =>
  flag("VITE_FF_SERVER_SIDE_ORDERING", "ff_server_side_ordering");
