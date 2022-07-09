export const defaultPersistence = {
    'NODEJS': 'fs',
    'BROWSER': 'localStorage',
    'CORDOVA': 'localStorage',
    'MEMORY': 'memory'
}

export const persistenceMethods = {
    'fs': LokiFsAdapter,
    'localStorage': LokiLocalStorageAdapter,
    'memory': LokiMemoryAdapter
};
