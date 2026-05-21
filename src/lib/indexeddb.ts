// IndexedDB wrapper for KhmerDub Studio workspace persistence
const DB_NAME = 'khmer-dub-studio';
const DB_VERSION = 1;

export const STORES = {
  WORKSPACES: 'workspaces',
  VIDEOS: 'videos',
  AUDIO_CLIPS: 'audioClips',
  METADATA: 'metadata',
} as const;

let dbInstance: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(new Error(`Failed to open IndexedDB: ${request.error}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('IndexedDB initialized successfully');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.WORKSPACES)) {
        const wsStore = db.createObjectStore(STORES.WORKSPACES, { keyPath: 'id' });
        wsStore.createIndex('name', 'name', { unique: false });
        wsStore.createIndex('lastModified', 'lastModified', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.VIDEOS)) {
        db.createObjectStore(STORES.VIDEOS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.AUDIO_CLIPS)) {
        const audioStore = db.createObjectStore(STORES.AUDIO_CLIPS, { keyPath: 'id' });
        audioStore.createIndex('workspaceId', 'workspaceId', { unique: false });
        audioStore.createIndex('subtitleId', 'subtitleId', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.METADATA)) {
        db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
      }

      console.log('IndexedDB schema upgraded');
    };
  });
}

export async function getBlob(storeName: string, key: string): Promise<Blob | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result?.blob || null);
    };
  });
}

export async function putBlob(
  storeName: string,
  key: string,
  blob: Blob,
  metadata?: Record<string, any>
): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const data = {
      id: key,
      blob,
      storedAt: Date.now(),
      ...metadata,
    };
    const request = store.put(data);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function putJSON(
  storeName: string,
  key: string,
  data: any
): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const record = {
      id: key,
      data,
      updatedAt: Date.now(),
    };
    const request = store.put(record);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getJSON(storeName: string, key: string): Promise<any | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result?.data || null);
    };
  });
}

export async function deleteRecord(storeName: string, key: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getAllKeys(storeName: string): Promise<string[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAllKeys();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as string[]) || []);
  });
}

export async function getAllRecords(storeName: string): Promise<any[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as any[]) || []);
  });
}

export async function clearStore(storeName: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getStorageSize(): Promise<{
  usage: number;
  quota: number;
  percentage: number;
}> {
  if (!navigator.storage?.estimate) {
    return { usage: 0, quota: 0, percentage: 0 };
  }

  const estimate = await navigator.storage.estimate();
  const usage = estimate.usage || 0;
  const quota = estimate.quota || 0;
  const percentage = quota ? (usage / quota) * 100 : 0;

  return { usage, quota, percentage };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) {
    return false;
  }

  try {
    const isPersisted = await navigator.storage.persist();
    return isPersisted;
  } catch (error) {
    console.error('Failed to request persistent storage:', error);
    return false;
  }
}
