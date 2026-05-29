import { useCallback } from 'react';

const DB_NAME = 'MonteeqChatDB';
const MESSAGES_STORE = 'Messages';
const CONVERSATIONS_STORE = 'Conversations';

export const useChatDB = () => {
    const getDB = useCallback(() => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
                    db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(CONVERSATIONS_STORE)) {
                    db.createObjectStore(CONVERSATIONS_STORE, { keyPath: 'id' });
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }, []);

    const saveMessage = useCallback(async (msg) => {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(MESSAGES_STORE, 'readwrite');
            const store = transaction.objectStore(MESSAGES_STORE);
            const request = store.put(msg);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }, [getDB]);

    const getMessagesForConversation = useCallback(async (convId) => {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(MESSAGES_STORE, 'readonly');
            const store = transaction.objectStore(MESSAGES_STORE);
            const request = store.getAll();
            request.onsuccess = () => {
                const all = request.result || [];
                const filtered = all.filter(m => String(m.conversation_id) === String(convId));
                filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                resolve(filtered);
            };
            request.onerror = () => reject(request.error);
        });
    }, [getDB]);

    const saveConversation = useCallback(async (conv) => {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(CONVERSATIONS_STORE, 'readwrite');
            const store = transaction.objectStore(CONVERSATIONS_STORE);
            const request = store.put(conv);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }, [getDB]);

    const getLocalConversations = useCallback(async () => {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(CONVERSATIONS_STORE, 'readonly');
            const store = transaction.objectStore(CONVERSATIONS_STORE);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }, [getDB]);

    return {
        saveMessage,
        getMessagesForConversation,
        saveConversation,
        getLocalConversations
    };
};
