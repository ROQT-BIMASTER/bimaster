// Versão do app - incrementar a cada deploy significativo
// PR-14 / Onda 3 (v3.1.6): endpoints avançados do Contas a Pagar.
// - Nova tabela cp_anexos (RLS admin-only) — handler de /anexos apontava para
//   payment_attachments inexistente (toda chamada → 500).
// - /parcelas/sync agora usa onConflict=(conta_pagar_id,numero_parcela) com UNIQUE
//   criado em migration; aceita alias `numero` (spec) → `numero_parcela` (coluna);
//   pré-valida FK conta_pagar_id e devolve errosDetalhe[] granular (paridade upsert-lote).
// - GET /parcelas e GET /anexos devolvem [] para títulos sem itens (não 404).
// PR-13 / Onda 2 (v3.1.5): ciclo completo (RPC fix, /update validate refs, /cancelar granular).
export const APP_VERSION = '3.1.6';

// Chave para armazenar versão no localStorage
const VERSION_KEY = 'app_version';
const LAST_CLEAR_KEY = 'app_last_cache_clear';

/**
 * Verifica se há uma nova versão do app e limpa caches se necessário
 */
export function checkAndUpdateVersion(): boolean {
  const storedVersion = localStorage.getItem(VERSION_KEY);
  
  if (storedVersion !== APP_VERSION) {
    console.log(`[Version] Atualização detectada: ${storedVersion} → ${APP_VERSION}`);
    
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
      console.log(`[Version] Limpando ${cacheNames.length} caches...`);
      
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
        console.log(`[Version] Cache limpo: ${cacheName}`);
      }
      
      console.log('[Version] Todos os caches foram limpos');
    } catch (error) {
      console.error('[Version] Erro ao limpar caches:', error);
    }
  }
  
  // Forçar desregistro de TODOS os Service Workers
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log('[Version] Service Worker desregistrado');
      }
    } catch (error) {
      console.error('[Version] Erro ao desregistrar SW:', error);
    }
  }

  // Limpar sessionStorage (dados de sessão)
  try {
    sessionStorage.clear();
    console.log('[Version] sessionStorage limpo');
  } catch (e) {
    console.error('[Version] Erro ao limpar sessionStorage:', e);
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
