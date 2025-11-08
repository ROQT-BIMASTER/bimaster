/**
 * Gerenciador de armazenamento offline para fotos e dados
 */

interface PendingPhoto {
  id: string;
  file: File;
  storeId: string;
  visitId?: string;
  timestamp: number;
  retries: number;
}

interface PendingData {
  id: string;
  table: string;
  data: any;
  operation: 'insert' | 'update' | 'delete';
  timestamp: number;
  retries: number;
}

const DB_NAME = 'trade_offline_db';
const DB_VERSION = 1;
const PHOTO_STORE = 'pending_photos';
const DATA_STORE = 'pending_data';

class OfflineStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store para fotos pendentes
        if (!db.objectStoreNames.contains(PHOTO_STORE)) {
          const photoStore = db.createObjectStore(PHOTO_STORE, { keyPath: 'id' });
          photoStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store para dados pendentes
        if (!db.objectStoreNames.contains(DATA_STORE)) {
          const dataStore = db.createObjectStore(DATA_STORE, { keyPath: 'id' });
          dataStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // ==================== FOTOS ====================

  async savePendingPhoto(photo: Omit<PendingPhoto, 'id' | 'timestamp' | 'retries'>): Promise<string> {
    if (!this.db) await this.init();

    const id = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pendingPhoto: PendingPhoto = {
      ...photo,
      id,
      timestamp: Date.now(),
      retries: 0,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PHOTO_STORE], 'readwrite');
      const store = transaction.objectStore(PHOTO_STORE);
      const request = store.add(pendingPhoto);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingPhotos(): Promise<PendingPhoto[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PHOTO_STORE], 'readonly');
      const store = transaction.objectStore(PHOTO_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removePendingPhoto(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PHOTO_STORE], 'readwrite');
      const store = transaction.objectStore(PHOTO_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async incrementPhotoRetries(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise(async (resolve, reject) => {
      const transaction = this.db!.transaction([PHOTO_STORE], 'readwrite');
      const store = transaction.objectStore(PHOTO_STORE);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const photo = getRequest.result;
        if (photo) {
          photo.retries += 1;
          const putRequest = store.put(photo);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // ==================== DADOS ====================

  async savePendingData(data: Omit<PendingData, 'id' | 'timestamp' | 'retries'>): Promise<string> {
    if (!this.db) await this.init();

    const id = `data_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pendingData: PendingData = {
      ...data,
      id,
      timestamp: Date.now(),
      retries: 0,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([DATA_STORE], 'readwrite');
      const store = transaction.objectStore(DATA_STORE);
      const request = store.add(pendingData);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingData(): Promise<PendingData[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([DATA_STORE], 'readonly');
      const store = transaction.objectStore(DATA_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removePendingData(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([DATA_STORE], 'readwrite');
      const store = transaction.objectStore(DATA_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== LIMPEZA ====================

  async clearAll(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PHOTO_STORE, DATA_STORE], 'readwrite');
      
      const clearPhotos = transaction.objectStore(PHOTO_STORE).clear();
      const clearData = transaction.objectStore(DATA_STORE).clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getStorageSize(): Promise<{ photos: number; data: number }> {
    if (!this.db) await this.init();

    const photos = await this.getPendingPhotos();
    const data = await this.getPendingData();

    return {
      photos: photos.length,
      data: data.length,
    };
  }
}

export const offlineStorage = new OfflineStorage();

// Inicializar quando o módulo for importado
if (typeof window !== 'undefined') {
  offlineStorage.init().catch(console.error);
}
