/**
 * Gerenciador de armazenamento offline para fotos e dados
 * COM CRIPTOGRAFIA para proteção de dados sensíveis
 */

import { encryptFile, decryptFile, encryptData, decryptData } from './encryption';

interface EncryptedPendingPhoto {
  id: string;
  encryptedFile: string; // Encrypted file data
  storeId: string;
  visitId?: string;
  timestamp: number;
  retries: number;
  expiresAt: number; // Auto-expiration
}

interface EncryptedPendingData {
  id: string;
  table: string;
  encryptedData: string; // Encrypted JSON data
  operation: 'insert' | 'update' | 'delete';
  timestamp: number;
  retries: number;
  expiresAt: number; // Auto-expiration
}

// Legacy interfaces for backward compatibility during migration
interface LegacyPendingPhoto {
  id: string;
  file: File;
  storeId: string;
  visitId?: string;
  timestamp: number;
  retries: number;
}

interface LegacyPendingData {
  id: string;
  table: string;
  data: any;
  operation: 'insert' | 'update' | 'delete';
  timestamp: number;
  retries: number;
}

// Public interface (decrypted)
export interface PendingPhoto {
  id: string;
  file: File;
  storeId: string;
  visitId?: string;
  timestamp: number;
  retries: number;
}

export interface PendingData {
  id: string;
  table: string;
  data: any;
  operation: 'insert' | 'update' | 'delete';
  timestamp: number;
  retries: number;
}

const DB_NAME = 'trade_offline_db';
const DB_VERSION = 2; // Incremented for encrypted storage
const PHOTO_STORE = 'pending_photos';
const DATA_STORE = 'pending_data';
const DATA_EXPIRATION_DAYS = 7;

class OfflineStorage {
  private db: IDBDatabase | null = null;
  private userId: string | null = null;

  /**
   * Set the user ID for encryption/decryption
   * MUST be called before saving or retrieving data
   */
  setUserId(userId: string) {
    this.userId = userId;
  }

  /**
   * Clear user context and optionally all data on logout
   */
  async clearOnLogout(clearData: boolean = true): Promise<void> {
    if (clearData) {
      await this.clearAll();
    }
    this.userId = null;
  }

  private getExpirationTime(): number {
    return Date.now() + (DATA_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        // Clean expired data on init
        this.cleanExpiredData().catch(console.error);
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store para fotos pendentes (encrypted)
        if (!db.objectStoreNames.contains(PHOTO_STORE)) {
          const photoStore = db.createObjectStore(PHOTO_STORE, { keyPath: 'id' });
          photoStore.createIndex('timestamp', 'timestamp', { unique: false });
          photoStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        // Store para dados pendentes (encrypted)
        if (!db.objectStoreNames.contains(DATA_STORE)) {
          const dataStore = db.createObjectStore(DATA_STORE, { keyPath: 'id' });
          dataStore.createIndex('timestamp', 'timestamp', { unique: false });
          dataStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };
    });
  }

  /**
   * Clean expired data automatically
   */
  private async cleanExpiredData(): Promise<void> {
    if (!this.db) return;

    const now = Date.now();

    // Clean expired photos
    const photoTransaction = this.db.transaction([PHOTO_STORE], 'readwrite');
    const photoStore = photoTransaction.objectStore(PHOTO_STORE);
    const photoCursor = photoStore.openCursor();

    photoCursor.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const record = cursor.value as EncryptedPendingPhoto;
        if (record.expiresAt && record.expiresAt < now) {
          cursor.delete();
        }
        cursor.continue();
      }
    };

    // Clean expired data
    const dataTransaction = this.db.transaction([DATA_STORE], 'readwrite');
    const dataStore = dataTransaction.objectStore(DATA_STORE);
    const dataCursor = dataStore.openCursor();

    dataCursor.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const record = cursor.value as EncryptedPendingData;
        if (record.expiresAt && record.expiresAt < now) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  }

  // ==================== FOTOS ====================

  async savePendingPhoto(photo: Omit<PendingPhoto, 'id' | 'timestamp' | 'retries'>): Promise<string> {
    if (!this.db) await this.init();
    
    if (!this.userId) {
      throw new Error('User ID required for encrypted storage. Call setUserId() first.');
    }

    const id = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Encrypt the file before storing
    const encryptedFile = await encryptFile(photo.file, this.userId);
    
    const encryptedPhoto: EncryptedPendingPhoto = {
      id,
      encryptedFile,
      storeId: photo.storeId,
      visitId: photo.visitId,
      timestamp: Date.now(),
      retries: 0,
      expiresAt: this.getExpirationTime(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PHOTO_STORE], 'readwrite');
      const store = transaction.objectStore(PHOTO_STORE);
      const request = store.add(encryptedPhoto);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingPhotos(): Promise<PendingPhoto[]> {
    if (!this.db) await this.init();
    
    if (!this.userId) {
      console.warn('User ID not set, returning empty array');
      return [];
    }

    return new Promise(async (resolve, reject) => {
      const transaction = this.db!.transaction([PHOTO_STORE], 'readonly');
      const store = transaction.objectStore(PHOTO_STORE);
      const request = store.getAll();

      request.onsuccess = async () => {
        const encryptedPhotos: (EncryptedPendingPhoto | LegacyPendingPhoto)[] = request.result;
        const decryptedPhotos: PendingPhoto[] = [];

        for (const photo of encryptedPhotos) {
          try {
            // Handle legacy unencrypted data
            if ('file' in photo && photo.file instanceof File) {
              decryptedPhotos.push(photo as LegacyPendingPhoto);
              continue;
            }

            // Decrypt encrypted data
            if ('encryptedFile' in photo) {
              const decryptedFile = await decryptFile(photo.encryptedFile, this.userId!);
              decryptedPhotos.push({
                id: photo.id,
                file: decryptedFile,
                storeId: photo.storeId,
                visitId: photo.visitId,
                timestamp: photo.timestamp,
                retries: photo.retries,
              });
            }
          } catch (error) {
            console.error('Failed to decrypt photo:', photo.id, error);
            // Skip corrupted/unreadable entries
          }
        }

        resolve(decryptedPhotos);
      };
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
    
    if (!this.userId) {
      throw new Error('User ID required for encrypted storage. Call setUserId() first.');
    }

    const id = `data_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Encrypt the data before storing
    const encryptedDataStr = await encryptData(JSON.stringify(data.data), this.userId);
    
    const encryptedPendingData: EncryptedPendingData = {
      id,
      table: data.table,
      encryptedData: encryptedDataStr,
      operation: data.operation,
      timestamp: Date.now(),
      retries: 0,
      expiresAt: this.getExpirationTime(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([DATA_STORE], 'readwrite');
      const store = transaction.objectStore(DATA_STORE);
      const request = store.add(encryptedPendingData);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingData(): Promise<PendingData[]> {
    if (!this.db) await this.init();
    
    if (!this.userId) {
      console.warn('User ID not set, returning empty array');
      return [];
    }

    return new Promise(async (resolve, reject) => {
      const transaction = this.db!.transaction([DATA_STORE], 'readonly');
      const store = transaction.objectStore(DATA_STORE);
      const request = store.getAll();

      request.onsuccess = async () => {
        const encryptedDataItems: (EncryptedPendingData | LegacyPendingData)[] = request.result;
        const decryptedDataItems: PendingData[] = [];

        for (const item of encryptedDataItems) {
          try {
            // Handle legacy unencrypted data
            if ('data' in item && !('encryptedData' in item)) {
              decryptedDataItems.push(item as LegacyPendingData);
              continue;
            }

            // Decrypt encrypted data
            if ('encryptedData' in item) {
              const encryptedItem = item as EncryptedPendingData;
              const decryptedDataStr = await decryptData(encryptedItem.encryptedData, this.userId!);
              decryptedDataItems.push({
                id: encryptedItem.id,
                table: encryptedItem.table,
                data: JSON.parse(decryptedDataStr),
                operation: encryptedItem.operation,
                timestamp: encryptedItem.timestamp,
                retries: encryptedItem.retries,
              });
            }
          } catch (error) {
            console.error('Failed to decrypt data:', item.id, error);
            // Skip corrupted/unreadable entries
          }
        }

        resolve(decryptedDataItems);
      };
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
      
      transaction.objectStore(PHOTO_STORE).clear();
      transaction.objectStore(DATA_STORE).clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getStorageSize(): Promise<{ photos: number; data: number }> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PHOTO_STORE, DATA_STORE], 'readonly');
      
      const photoRequest = transaction.objectStore(PHOTO_STORE).count();
      const dataRequest = transaction.objectStore(DATA_STORE).count();
      
      let photos = 0;
      let data = 0;

      photoRequest.onsuccess = () => { photos = photoRequest.result as number; };
      dataRequest.onsuccess = () => { data = dataRequest.result as number; };

      transaction.oncomplete = () => resolve({ photos, data });
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export const offlineStorage = new OfflineStorage();

// Inicializar quando o módulo for importado
if (typeof window !== 'undefined') {
  offlineStorage.init().catch(console.error);
}
