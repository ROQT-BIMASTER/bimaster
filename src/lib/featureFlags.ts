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
 * PWA Heartbeat — quando true, o PWAContext compara periodicamente o
 * `APP_VERSION` do bundle atual com a meta `<meta name="app-version">`
 * do `index.html` servido pela rede. Em caso de divergência, dispara o
 * toast "Nova versão disponível" mesmo se o Service Worker estiver
 * preso servindo bundle antigo. Default: false (apenas loga).
 *
 * Ativar por usuário piloto: `localStorage.setItem('ff_pwa_heartbeat', '1')`.
 * Ativar globalmente em build: `VITE_FF_PWA_HEARTBEAT=1`.
 */
export const isPwaHeartbeatEnabled = () =>
  flag("VITE_FF_PWA_HEARTBEAT", "ff_pwa_heartbeat");
