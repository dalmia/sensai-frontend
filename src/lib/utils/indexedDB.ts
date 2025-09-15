const IDB_DB_NAME = 'sensai-question-drafts';
const IDB_STORE_NAME = 'questionDrafts';

const openIndexedDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        try {
            const request = window.indexedDB.open(IDB_DB_NAME, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
                    db.createObjectStore(IDB_STORE_NAME);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        } catch (err) {
            reject(err);
        }
    });
};

export const getDraft = async (key: string): Promise<string | null> => {
    try {
        const db = await openIndexedDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE_NAME, 'readonly');
            const store = tx.objectStore(IDB_STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => resolve((req.result as string) ?? null);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return null;
    }
};

export const setDraft = async (key: string, value: string): Promise<void> => {
    try {
        const db = await openIndexedDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
            const store = tx.objectStore(IDB_STORE_NAME);
            const req = store.put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch {
        // no-op
    }
};

export const deleteDraft = async (key: string): Promise<void> => {
    try {
        const db = await openIndexedDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
            const store = tx.objectStore(IDB_STORE_NAME);
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch {
        // no-op
    }
};

export default {
    getDraft,
    setDraft,
    deleteDraft,
};


