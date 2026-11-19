// Daten dauerhaft im Browser (IndexedDB) ablegen: hochgeladene Schriften und das Vorschau-Foto.

export interface StoredFontFile {
  id: string;
  fileName: string;
  data: ArrayBuffer;
  addedAt: number;
}

const DB_NAME = 'calcellprintgen';
const DB_VERSION = 2;
const FONTS = 'fonts';
const ASSETS = 'assets';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB nicht verfügbar'));
      return;
    }
    // Manche Umgebungen (z. B. Datei per Doppelklick geöffnet) antworten nie – dann ohne Speicher weiter.
    const timer = setTimeout(() => reject(new Error('IndexedDB antwortet nicht')), 2500);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      clearTimeout(timer);
      reject(err);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FONTS)) db.createObjectStore(FONTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(ASSETS)) db.createObjectStore(ASSETS);
    };
    req.onsuccess = () => {
      clearTimeout(timer);
      resolve(req.result);
    };
    req.onerror = () => {
      clearTimeout(timer);
      reject(req.error);
    };
    req.onblocked = () => {
      clearTimeout(timer);
      reject(new Error('IndexedDB blockiert'));
    };
  });
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

export async function listStoredFonts(): Promise<StoredFontFile[]> {
  try {
    return (await run(FONTS, 'readonly', (s) => s.getAll())) as StoredFontFile[];
  } catch {
    return [];
  }
}

export async function putStoredFont(file: StoredFontFile): Promise<boolean> {
  try {
    await run(FONTS, 'readwrite', (s) => s.put(file));
    return true;
  } catch {
    return false;
  }
}

export async function deleteStoredFont(id: string): Promise<void> {
  try {
    await run(FONTS, 'readwrite', (s) => s.delete(id));
  } catch {
    /* ignorieren */
  }
}

export async function getAsset(key: string): Promise<Blob | null> {
  try {
    return ((await run(ASSETS, 'readonly', (s) => s.get(key))) as Blob | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function putAsset(key: string, blob: Blob): Promise<void> {
  try {
    await run(ASSETS, 'readwrite', (s) => s.put(blob, key));
  } catch {
    /* ohne Speicher geht es trotzdem weiter */
  }
}

export async function deleteAsset(key: string): Promise<void> {
  try {
    await run(ASSETS, 'readwrite', (s) => s.delete(key));
  } catch {
    /* ignorieren */
  }
}
