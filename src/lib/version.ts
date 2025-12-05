// Versão do app - incrementar a cada deploy significativo
export const APP_VERSION = '1.0.1';

// Chave para armazenar versão no localStorage
const VERSION_KEY = 'app_version';

/**
 * Verifica se há uma nova versão do app e limpa caches se necessário
 */
export function checkAndUpdateVersion(): boolean {
  const storedVersion = localStorage.getItem(VERSION_KEY);
  
  if (storedVersion !== APP_VERSION) {
    console.log(`[Version] Atualização detectada: ${storedVersion} → ${APP_VERSION}`);
    
    // Limpar caches antigos
    clearOldCaches();
    
    // Salvar nova versão
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    
    return true; // Nova versão detectada
  }
  
  return false; // Mesma versão
}

/**
 * Limpa caches do navegador para garantir dados frescos
 */
async function clearOldCaches(): Promise<void> {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      const apiCaches = cacheNames.filter(name => 
        name.includes('supabase-api-cache') || 
        name.includes('workbox')
      );
      
      for (const cacheName of apiCaches) {
        await caches.delete(cacheName);
        console.log(`[Version] Cache limpo: ${cacheName}`);
      }
    } catch (error) {
      console.error('[Version] Erro ao limpar caches:', error);
    }
  }
}

/**
 * Força reload da página após atualização
 */
export function forceReload(): void {
  window.location.reload();
}
