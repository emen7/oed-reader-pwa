// IndexedDB Storage Layer
// Handles persistent local storage of OED entries in the browser

const DB_NAME = 'OEDReaderDB';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

let db;

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const newDB = event.target.result;
            
            if (!newDB.objectStoreNames.contains(STORE_NAME)) {
                const store = newDB.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('headword', 'headword', { unique: false });
                store.createIndex('savedAt', 'savedAt', { unique: false });
            }
        };
    });
}

async function saveEntryToDB(entry) {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(entry);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function getEntryById(id) {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function getAllEntries() {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('savedAt');
        const request = index.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            // Return in reverse chronological order
            const entries = request.result;
            resolve(entries.reverse());
        };
    });
}

async function deleteEntry(id) {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

async function clearAllEntries() {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

async function searchEntries(query) {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('headword');
        const range = IDBKeyRange.bound(query.toLowerCase(), query.toLowerCase() + '\uffff');
        const request = index.getAll(range);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

// Initialize database on script load
initDB().catch(error => {
    console.error('Failed to initialize database:', error);
});