/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDraft, setDraft, deleteDraft } from '../../lib/utils/indexedDB';

type MockIDBRequest = {
    onsuccess: (() => void) | null;
    onerror: (() => void) | null;
    onupgradeneeded: (() => void) | null;
    result: any;
    error?: Error;
};

type SetupOptions = {
    hasStore?: boolean;
    getResult?: any;
    triggerGetError?: boolean;
    triggerPutError?: boolean;
    triggerDeleteError?: boolean;
    triggerOpenError?: boolean;
    throwSyncOpenError?: boolean;
};

const setupIndexedDB = (options: SetupOptions = {}) => {
    const {
        hasStore = true,
        getResult = 'value-from-store',
        triggerGetError = false,
        triggerPutError = false,
        triggerDeleteError = false,
    } = options;

    const createObjectStore = jest.fn();

    const db = {
        objectStoreNames: { contains: () => hasStore },
        createObjectStore,
        transaction: jest.fn((storeName: string, mode: string) => {
            expect(storeName).toBe('questionDrafts');
            expect(['readonly', 'readwrite']).toContain(mode);
            const store = {
                get: jest.fn(() => {
                    const req: any = { onsuccess: null, onerror: null, result: getResult };
                    setTimeout(() => {
                        if (triggerGetError && req.onerror) req.onerror();
                        else if (req.onsuccess) req.onsuccess();
                    }, 0);
                    return req;
                }),
                put: jest.fn(() => {
                    const req: any = { onsuccess: null, onerror: null };
                    setTimeout(() => {
                        if (triggerPutError && req.onerror) req.onerror();
                        else if (req.onsuccess) req.onsuccess();
                    }, 0);
                    return req;
                }),
                delete: jest.fn(() => {
                    const req: any = { onsuccess: null, onerror: null };
                    setTimeout(() => {
                        if (triggerDeleteError && req.onerror) req.onerror();
                        else if (req.onsuccess) req.onsuccess();
                    }, 0);
                    return req;
                })
            };
            return { objectStore: () => store } as any;
        })
    };

    const request: MockIDBRequest = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: db,
    };

    const open = jest.fn(() => {
        if ((options as any).throwSyncOpenError) {
            throw new Error('sync open error');
        }
        // Fire upgrade first so code path is covered
        setTimeout(() => {
            if (!hasStore && request.onupgradeneeded) {
                // Attach createObjectStore on result
                (request.result as any).createObjectStore = createObjectStore;
                request.onupgradeneeded();
            }
            if ((options as any).triggerOpenError) {
                request.error = new Error('open error');
                request.onerror && request.onerror();
            } else if (request.onsuccess) {
                request.onsuccess();
            }
        }, 0);
        return request as any;
    });

    (global as any).indexedDB = { open };
    (window as any).indexedDB = (global as any).indexedDB;

    return { open, request, db, createObjectStore };
};

describe('indexedDB utils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('creates object store on upgrade when missing, then resolves getDraft with value', async () => {
        const { createObjectStore } = setupIndexedDB({ hasStore: false, getResult: 'hello' });

        const p = getDraft('k1');
        await new Promise(res => setTimeout(res, 0));
        await expect(p).resolves.toBe('hello');
        expect(createObjectStore).toHaveBeenCalledWith('questionDrafts');
    });

    it('returns null from getDraft when key not found (null result)', async () => {
        setupIndexedDB({ getResult: null });
        const valPromise = getDraft('missing');
        await new Promise(res => setTimeout(res, 0));
        const val = await valPromise;
        expect(val).toBeNull();
    });

    it('returns null from getDraft when get request errors', async () => {
        setupIndexedDB({ triggerGetError: true });
        const valPromise = getDraft('err');
        await new Promise(res => setTimeout(res, 0));
        const val = await valPromise;
        expect(val).toBeNull();
    });

    it('resolves setDraft successfully on put success', async () => {
        setupIndexedDB();
        const p = setDraft('k2', 'v2');
        await new Promise(res => setTimeout(res, 0));
        await expect(p).resolves.toBeUndefined();
    });

    it('does not throw when setDraft put errors (no-op catch)', async () => {
        setupIndexedDB({ triggerPutError: true });
        const p = setDraft('k3', 'v3');
        await new Promise(res => setTimeout(res, 0));
        await expect(p).resolves.toBeUndefined();
    });

    it('resolves deleteDraft successfully on delete success', async () => {
        setupIndexedDB();
        const p = deleteDraft('k4');
        await new Promise(res => setTimeout(res, 0));
        await expect(p).resolves.toBeUndefined();
    });

    it('does not throw when deleteDraft delete errors (no-op catch)', async () => {
        setupIndexedDB({ triggerDeleteError: true });
        const p = deleteDraft('k5');
        await new Promise(res => setTimeout(res, 0));
        await expect(p).resolves.toBeUndefined();
    });

    it('handles request.onerror from open (reject with request.error) and returns null from getDraft', async () => {
        setupIndexedDB({ triggerOpenError: true });
        const p = getDraft('any');
        await new Promise(res => setTimeout(res, 0));
        await expect(p).resolves.toBeNull();
    });

    it('handles synchronous throw in indexedDB.open and returns null from getDraft', async () => {
        setupIndexedDB({ throwSyncOpenError: true });
        const p = getDraft('any');
        await new Promise(res => setTimeout(res, 0));
        await expect(p).resolves.toBeNull();
    });
});


