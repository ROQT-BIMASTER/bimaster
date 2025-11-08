// Service Worker para modo offline
const CACHE_NAME = 'trade-marketing-cache-v1';
const PHOTO_CACHE = 'trade-photos-cache-v1';

// Arquivos essenciais para cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html'
];

// Instalar service worker e fazer cache dos assets estáticos
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((err) => {
        console.error('[SW] Cache installation failed:', err);
      })
  );
  self.skipWaiting();
});

// Ativar service worker e limpar caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== PHOTO_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Estratégia de cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições de outras origens (exceto imagens)
  if (url.origin !== location.origin && !request.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    return;
  }

  // Estratégia para fotos: Cache First, depois Network
  if (request.url.includes('trade-photos')) {
    event.respondWith(
      caches.open(PHOTO_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            // Retornar do cache e atualizar em background
            fetch(request).then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
            }).catch(() => {});
            return cachedResponse;
          }

          // Se não está no cache, buscar da rede
          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Retornar imagem placeholder se offline
            return new Response(
              '<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect fill="#ddd" width="400" height="300"/><text x="50%" y="50%" text-anchor="middle" fill="#999">Imagem offline</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          });
        });
      })
    );
    return;
  }

  // Estratégia para API: Network First, depois Cache
  if (url.origin.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cachear apenas respostas bem-sucedidas
          if (response && response.status === 200 && request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Se offline, tentar buscar do cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Se não há cache e está offline, retornar resposta vazia
            return new Response(
              JSON.stringify({ error: 'Offline', offline: true }),
              { 
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
    return;
  }

  // Estratégia padrão para outros recursos: Cache First
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });

        return response;
      });
    })
  );
});

// Sincronização em background quando voltar online
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-photos') {
    event.waitUntil(syncPendingPhotos());
  }
});

async function syncPendingPhotos() {
  try {
    // Buscar fotos pendentes do IndexedDB
    const pendingPhotos = await getPendingPhotos();
    
    for (const photo of pendingPhotos) {
      try {
        // Tentar enviar foto
        await uploadPhoto(photo);
        // Remover do IndexedDB após sucesso
        await removePendingPhoto(photo.id);
      } catch (error) {
        console.error('[SW] Failed to sync photo:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// Helpers para IndexedDB (implementação básica)
async function getPendingPhotos() {
  // Implementar busca no IndexedDB
  return [];
}

async function uploadPhoto(photo) {
  // Implementar upload
}

async function removePendingPhoto(id) {
  // Implementar remoção do IndexedDB
}
