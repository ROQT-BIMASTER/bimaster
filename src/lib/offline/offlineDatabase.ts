/**
 * IndexedDB wrapper para armazenamento offline
 * Gerencia lojas, visitas e fotos pendentes de sincronização
 */

const DB_NAME = 'bimaster_offline';
const DB_VERSION = 1;

interface OfflineStore {
  id: string;
  name: string;
  address: string;
  city: string;
  uf: string;
  latitude?: number;
  longitude?: number;
  synced: boolean;
  lastUpdated: string;
}

interface OfflineVisit {
  id: string;
  storeId: string;
  storeName: string;
  userId: string;
  checkInTime?: string;
  checkOutTime?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  status: 'pending' | 'in_progress' | 'completed';
  synced: boolean;
  createdAt: string;
}

interface OfflinePhoto {
  id: string;
  visitId?: string;
  storeId: string;
  base64Data: string;
  photoType: 'gondola' | 'ponto_extra' | 'fachada' | 'preco' | 'general';
  latitude?: number;
  longitude?: number;
  synced: boolean;
  createdAt: string;
}

interface SyncQueueItem {
  id: string;
  type: 'store' | 'visit' | 'photo' | 'prospect';
  action: 'create' | 'update' | 'delete';
  data: any;
  attempts: number;
  lastAttempt?: string;
  createdAt: string;
}

let db: IDBDatabase | null = null;

export const initOfflineDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[OfflineDB] Erro ao abrir banco:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('[OfflineDB] Banco inicializado com sucesso');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Lojas offline
      if (!database.objectStoreNames.contains('stores')) {
        const storesStore = database.createObjectStore('stores', { keyPath: 'id' });
        storesStore.createIndex('synced', 'synced', { unique: false });
        storesStore.createIndex('city', 'city', { unique: false });
      }

      // Visitas offline
      if (!database.objectStoreNames.contains('visits')) {
        const visitsStore = database.createObjectStore('visits', { keyPath: 'id' });
        visitsStore.createIndex('synced', 'synced', { unique: false });
        visitsStore.createIndex('storeId', 'storeId', { unique: false });
        visitsStore.createIndex('status', 'status', { unique: false });
      }

      // Fotos offline
      if (!database.objectStoreNames.contains('photos')) {
        const photosStore = database.createObjectStore('photos', { keyPath: 'id' });
        photosStore.createIndex('synced', 'synced', { unique: false });
        photosStore.createIndex('visitId', 'visitId', { unique: false });
        photosStore.createIndex('storeId', 'storeId', { unique: false });
      }

      // Fila de sincronização
      if (!database.objectStoreNames.contains('syncQueue')) {
        const syncStore = database.createObjectStore('syncQueue', { keyPath: 'id' });
        syncStore.createIndex('type', 'type', { unique: false });
        syncStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Prospects offline
      if (!database.objectStoreNames.contains('prospects')) {
        const prospectsStore = database.createObjectStore('prospects', { keyPath: 'id' });
        prospectsStore.createIndex('synced', 'synced', { unique: false });
        prospectsStore.createIndex('status', 'status', { unique: false });
      }

      console.log('[OfflineDB] Esquema criado/atualizado');
    };
  });
};

// Generic CRUD operations
const getStore = async (storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> => {
  const database = await initOfflineDB();
  const transaction = database.transaction(storeName, mode);
  return transaction.objectStore(storeName);
};

export const addItem = async <T extends { id: string }>(storeName: string, item: T): Promise<void> => {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getItem = async <T>(storeName: string, id: string): Promise<T | undefined> => {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getAllItems = async <T>(storeName: string): Promise<T[]> => {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteItem = async (storeName: string, id: string): Promise<void> => {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getItemsByIndex = async <T>(
  storeName: string, 
  indexName: string, 
  value: IDBValidKey
): Promise<T[]> => {
  const store = await getStore(storeName);
  const index = store.index(indexName);
  return new Promise((resolve, reject) => {
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Sync Queue operations
export const addToSyncQueue = async (
  type: SyncQueueItem['type'],
  action: SyncQueueItem['action'],
  data: any
): Promise<void> => {
  const item: SyncQueueItem = {
    id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    action,
    data,
    attempts: 0,
    createdAt: new Date().toISOString()
  };
  await addItem('syncQueue', item);
  console.log('[OfflineDB] Item adicionado à fila de sync:', item.id);
};

export const getSyncQueue = async (): Promise<SyncQueueItem[]> => {
  return getAllItems<SyncQueueItem>('syncQueue');
};

export const removeSyncQueueItem = async (id: string): Promise<void> => {
  await deleteItem('syncQueue', id);
};

export const updateSyncQueueItem = async (item: SyncQueueItem): Promise<void> => {
  await addItem('syncQueue', item);
};

// Store operations
export const saveOfflineStore = async (store: OfflineStore): Promise<void> => {
  await addItem('stores', { ...store, synced: false, lastUpdated: new Date().toISOString() });
  await addToSyncQueue('store', 'create', store);
};

export const getOfflineStores = async (): Promise<OfflineStore[]> => {
  return getAllItems<OfflineStore>('stores');
};

export const getUnsyncedStores = async (): Promise<OfflineStore[]> => {
  return getItemsByIndex<OfflineStore>('stores', 'synced', false as unknown as IDBValidKey);
};

// Visit operations
export const saveOfflineVisit = async (visit: OfflineVisit): Promise<void> => {
  await addItem('visits', { ...visit, synced: false });
  await addToSyncQueue('visit', 'create', visit);
};

export const getOfflineVisits = async (): Promise<OfflineVisit[]> => {
  return getAllItems<OfflineVisit>('visits');
};

export const getUnsyncedVisits = async (): Promise<OfflineVisit[]> => {
  return getItemsByIndex<OfflineVisit>('visits', 'synced', false as unknown as IDBValidKey);
};

// Photo operations
export const saveOfflinePhoto = async (photo: OfflinePhoto): Promise<void> => {
  await addItem('photos', { ...photo, synced: false });
  await addToSyncQueue('photo', 'create', photo);
};

export const getOfflinePhotos = async (): Promise<OfflinePhoto[]> => {
  return getAllItems<OfflinePhoto>('photos');
};

export const getUnsyncedPhotos = async (): Promise<OfflinePhoto[]> => {
  return getItemsByIndex<OfflinePhoto>('photos', 'synced', false as unknown as IDBValidKey);
};

// Clear synced data
export const clearSyncedData = async (): Promise<void> => {
  const stores = await getItemsByIndex<OfflineStore>('stores', 'synced', true as unknown as IDBValidKey);
  const visits = await getItemsByIndex<OfflineVisit>('visits', 'synced', true as unknown as IDBValidKey);
  const photos = await getItemsByIndex<OfflinePhoto>('photos', 'synced', true as unknown as IDBValidKey);

  for (const store of stores) {
    await deleteItem('stores', store.id);
  }
  for (const visit of visits) {
    await deleteItem('visits', visit.id);
  }
  for (const photo of photos) {
    await deleteItem('photos', photo.id);
  }

  console.log('[OfflineDB] Dados sincronizados limpos');
};

// Get pending sync count
export const getPendingSyncCount = async (): Promise<number> => {
  const queue = await getSyncQueue();
  return queue.length;
};

export type { OfflineStore, OfflineVisit, OfflinePhoto, SyncQueueItem };
