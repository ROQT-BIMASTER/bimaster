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

/**
 * Suporte v2 — help desk multi-departamento (Fase 3B: IA por fila +
 * transferência automática entre departamentos).
 *
 * **Default a partir da Fase 3B: LIGADO** para todos os usuários.
 * Para desligar por usuário (rollback): `localStorage.setItem('ff_suporte_v2', '0')`.
 * Para desligar globalmente: `VITE_FF_SUPORTE_V2=0` no build.
 */
export const isSuporteV2Enabled = (): boolean => {
  try {
    const env = (import.meta.env as Record<string, string | undefined>).VITE_FF_SUPORTE_V2;
    if (env === "0" || env === "false") return false;
    if (typeof window !== "undefined") {
      const ls = window.localStorage.getItem("ff_suporte_v2");
      if (ls === "0") return false;
    }
  } catch {
    // ignore
  }
  return true;
};

/**
 * PWA Heartbeat — quando true, o PWAContext compara periodicamente o
 * `APP_VERSION` do bundle atual com a meta `<meta name="app-version">`
 * do `index.html` servido pela rede, e escuta `app_release_pins` via
 * Realtime. Em caso de divergência ou pin remoto ativo, dispara o
 * toast "Nova versão disponível" mesmo se o Service Worker estiver
 * preso servindo bundle antigo.
 *
 * **Default a partir da v3.4.96: LIGADO** (após validação em produção).
 * O toast é não-destrutivo (usuário escolhe "Atualizar agora" ou "Depois"),
 * não força reload, não altera permissões nem sessão.
 *
 * Para desligar globalmente (rollback): `VITE_FF_PWA_HEARTBEAT=0` no build.
 * Para desligar por usuário: `localStorage.setItem('ff_pwa_heartbeat', '0')`.
 */
export const isPwaHeartbeatEnabled = (): boolean => {
  // Override explícito por localStorage tem prioridade (permite desligar individualmente).
  try {
    if (typeof window !== "undefined") {
      const ls = window.localStorage.getItem("ff_pwa_heartbeat");
      if (ls === "0") return false;
      if (ls === "1") return true;
    }
  } catch { /* noop */ }
  // Env var explícita ("0" desliga, "1"/"true" liga).
  try {
    const v = (import.meta.env as Record<string, string | undefined>).VITE_FF_PWA_HEARTBEAT;
    if (v === "0" || v === "false") return false;
    if (v === "1" || v === "true") return true;
  } catch { /* noop */ }
  // Default: ligado.
  return true;
};
