import { logger } from "@/lib/logger";

// Histórico de versões em CHANGELOG.md (raiz do repo).

export const APP_VERSION = '3.6.0';

// Chave para armazenar versão no localStorage
const VERSION_KEY = 'app_version';
const LAST_CLEAR_KEY = 'app_last_cache_clear';

/**
 * Verifica se há uma nova versão do app e limpa caches se necessário
 */
export function checkAndUpdateVersion(): boolean {
  const storedVersion = localStorage.getItem(VERSION_KEY);
  
  if (storedVersion !== APP_VERSION) {
    logger.log(`[Version] Atualização detectada: ${storedVersion} → ${APP_VERSION}`);
    
    // Limpar TODOS os caches para garantir versão nova
    clearAllCaches();
    
    // Salvar nova versão
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    localStorage.setItem(LAST_CLEAR_KEY, new Date().toISOString());
    
    return true; // Nova versão detectada
  }
  
  return false; // Mesma versão
}

/**
 * Limpa TODOS os caches do navegador agressivamente
 */
export async function clearAllCaches(): Promise<void> {
  // Limpar Cache Storage (Service Worker caches)
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      logger.log(`[Version] Limpando ${cacheNames.length} caches...`);
      
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
        logger.log(`[Version] Cache limpo: ${cacheName}`);
      }
      
      logger.log('[Version] Todos os caches foram limpos');
    } catch (error) {
      logger.error('[Version] Erro ao limpar caches:', error);
    }
  }
  
  // Forçar desregistro de TODOS os Service Workers
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        logger.log('[Version] Service Worker desregistrado');
      }
    } catch (error) {
      logger.error('[Version] Erro ao desregistrar SW:', error);
    }
  }

  // Limpar sessionStorage (dados de sessão)
  try {
    sessionStorage.clear();
    logger.log('[Version] sessionStorage limpo');
  } catch (e) {
    logger.error('[Version] Erro ao limpar sessionStorage:', e);
  }
}

/**
 * Força reload da página após atualização
 */
export function forceReload(): void {
  window.location.reload();
}

/**
 * Força limpeza e reload completo
 */
export async function forceCleanReload(): Promise<void> {
  await clearAllCaches();
  localStorage.setItem(VERSION_KEY, APP_VERSION);
  // Forçar reload sem cache do navegador
  window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
}

/**
 * Força limpeza completa e navega para uma rota específica após login.
 *
 * A limpeza de caches/SW é protegida por timeout: caches.delete e
 * registration.unregister podem pendurar (SW corrompido, rede instável)
 * e impedir o window.location.replace, deixando o usuário preso na tela
 * de login com a sessão já persistida no localStorage.
 */
const CLEAN_NAVIGATE_TIMEOUT = 2000;

export async function forceCleanNavigate(targetPath: string): Promise<void> {
  try {
    await Promise.race([
      clearAllCaches(),
      new Promise<void>((resolve) =>
        setTimeout(() => {
          logger.warn('[Version] clearAllCaches timeout — seguindo com navegação');
          resolve();
        }, CLEAN_NAVIGATE_TIMEOUT)
      ),
    ]);
  } catch (error) {
    logger.error('[Version] Erro em clearAllCaches, seguindo com navegação:', error);
  }
  localStorage.setItem(VERSION_KEY, APP_VERSION);

  const url = new URL(targetPath || '/dashboard', window.location.origin);
  url.searchParams.set('app_version', APP_VERSION);
  url.searchParams.set('v', Date.now().toString());
  window.location.replace(url.toString());
}

// ============================================================================
// Heartbeat de versão (Fase 2 — quebra do deadlock de cache)
// ============================================================================
// Lê <meta name="app-version"> do index.html servido pela rede (sem cache),
// que é injetado em build time por appVersionMetaPlugin em vite.config.ts.
// Como index.html é NetworkFirst + Cache-Control no-cache (Cloudflare),
// essa meta tag sempre reflete o deploy mais recente — mesmo quando o
// bundle JS no Service Worker está preso na versão antiga.
//
// Uso seguro: falha silenciosa em qualquer erro de rede/parse; nunca
// quebra a UI; apenas retorna null.
export async function getDeployedVersionFromHtml(): Promise<{ version: string | null; buildId: string | null }> {
  try {
    const res = await fetch(`/index.html?ts=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!res.ok) return { version: null, buildId: null };
    const html = await res.text();
    const v = html.match(/<meta\s+name=["']app-version["']\s+content=["']([^"']+)["']/i);
    const b = html.match(/<meta\s+name=["']app-build-id["']\s+content=["']([^"']+)["']/i);
    return { version: v ? v[1] : null, buildId: b ? b[1] : null };
  } catch {
    return { version: null, buildId: null };
  }
}

/** Lê o build-id do bundle atual (embutido em index.html pelo plugin Vite). */
export function getLocalBuildId(): string | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector('meta[name="app-build-id"]');
  return el?.getAttribute('content') || null;
}

/** Retorna true se a versão OU o build-id remoto for diferente do local. */
export function isVersionMismatch(
  remote: { version: string | null; buildId: string | null } | string | null,
): boolean {
  // Backwards-compat: aceita string simples (versão) além do objeto novo.
  if (remote === null) return false;
  if (typeof remote === 'string') {
    if (!remote || remote === 'unknown') return false;
    return remote !== APP_VERSION;
  }
  const { version, buildId } = remote;
  if (version && version !== 'unknown' && version !== APP_VERSION) return true;
  const localBuild = getLocalBuildId();
  if (buildId && localBuild && buildId !== localBuild) return true;
  return false;
}
