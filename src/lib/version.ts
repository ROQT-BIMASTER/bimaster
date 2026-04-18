// Versão do app - incrementar a cada deploy significativo
// PR-16 (v3.1.8): SDK v3.2.0 / OpenAPI v4.2.0 — padronização final pré-produção do CP.
// - SDKs (TS/JS/PY) ganham 11 métodos novos: cpUpdate + 10 wrappers da Export API
//   (cpExportStatus/Pending/Paid/Cancelled/Batch/Confirm/History/Summary/Reconciliation/RetryFailed).
//   Cobertura SDK do CP sobe de 19/19 para 30/30 (incluindo Export API 100%).
// - Comentários "USE QUANDO/PREFIRA" expandidos em cpIncluir vs cpUpsert (3 SDKs).
// - Glossário SDK→banco adicionado (codigo_categoria→categoria_codigo, valor_documento→valor_original etc).
// - Quick Start passo 5 documenta fluxo Export API completo.
// - Smoke tests trocam chave probe `/listar` por `/cnae-api/listar` (lookup real, evita falso-positivo grep).
// - 8 invariantes novos em regression-greps.sh (cobertura métodos × 3 linguagens, sem cpListar reaparecendo).
// PR-15 / Onda 4 (v3.1.7): Export API alinhada com `contas_pagar`.
// - handleGetItems(/pending /paid) e handleStatusDetail agora consultam `contas_pagar`
//   (financial_payment_queue era módulo legado vazio → arrays sempre vazios).
// - /cancelled e /reconciliation removidos refs a `conta_pagar_id` (coluna inexistente em
//   erp_export_queue → 500 PGRST204). Decisão arquitetural: payment_queue_id armazena
//   UUID de contas_pagar.id (zero migration; tabela estava vazia).
// - /export-batch agora pré-valida que cada id exista em contas_pagar; IDs ausentes vão
//   para errors[] em vez de virarem 23503 silencioso.
// PR-14 / Onda 3 (v3.1.6): endpoints avançados do Contas a Pagar.
// - Nova tabela cp_anexos (RLS admin-only) — handler de /anexos apontava para
//   payment_attachments inexistente (toda chamada → 500).
// - /parcelas/sync agora usa onConflict=(conta_pagar_id,numero_parcela) com UNIQUE
//   criado em migration; aceita alias `numero` (spec) → `numero_parcela` (coluna);
//   pré-valida FK conta_pagar_id e devolve errosDetalhe[] granular (paridade upsert-lote).
// - GET /parcelas e GET /anexos devolvem [] para títulos sem itens (não 404).
// PR-13 / Onda 2 (v3.1.5): ciclo completo (RPC fix, /update validate refs, /cancelar granular).
export const APP_VERSION = '3.1.8';

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
