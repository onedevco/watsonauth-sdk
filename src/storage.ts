import type { StorageAdapter } from './types';

const TOKEN_KEY = 'watsonauth_token';
const REFRESH_TOKEN_KEY = 'watsonauth_refresh_token';

export function createMemoryStorage(): StorageAdapter {
  const store = new Map<string, string>();
  return {
    get: (key) => store.get(key) ?? null,
    set: (key, value) => {
      store.set(key, value);
    },
    remove: (key) => {
      store.delete(key);
    },
  };
}

export function createLocalStorage(): StorageAdapter {
  return {
    get: (key) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Storage may be full or disabled
      }
    },
    remove: (key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Storage may be disabled
      }
    },
  };
}

export function createSessionStorage(): StorageAdapter {
  return {
    get: (key) => {
      try {
        return sessionStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        sessionStorage.setItem(key, value);
      } catch {
        // Storage may be full or disabled
      }
    },
    remove: (key) => {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // Storage may be disabled
      }
    },
  };
}

export function resolveStorage(
  storage: 'memory' | 'localStorage' | 'sessionStorage' | StorageAdapter | undefined
): StorageAdapter {
  if (!storage || storage === 'memory') {
    return createMemoryStorage();
  }
  if (storage === 'localStorage') {
    return createLocalStorage();
  }
  if (storage === 'sessionStorage') {
    return createSessionStorage();
  }
  return storage;
}

export { TOKEN_KEY, REFRESH_TOKEN_KEY };
