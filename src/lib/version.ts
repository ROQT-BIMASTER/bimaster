// Versão do app - incrementar a cada deploy significativo
export const APP_VERSION = '1.1.3';

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
async function clearAllCaches(): Promise<void> {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      console.log(`[Version] Limpando ${cacheNames.length} caches...`);
      
      // Deletar TODOS os caches sem exceção
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
        console.log(`[Version] Cache limpo: ${cacheName}`);
      }
      
      console.log('[Version] Todos os caches foram limpos');
    } catch (error) {
      console.error('[Version] Erro ao limpar caches:', error);
    }
  }
  
  // Forçar desregistro do Service Worker antigo
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
  window.location.reload();
}
