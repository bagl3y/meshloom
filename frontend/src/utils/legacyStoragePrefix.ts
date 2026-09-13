const LEGACY_PREFIX = 'remoteterm-';
const CURRENT_PREFIX = 'meshloom-';

/** Copy leftover Remote Terminal localStorage keys onto the Meshloom prefix. */
export function migrateLegacyLocalStoragePrefix(): void {
  try {
    const legacyKeys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(LEGACY_PREFIX)) {
        legacyKeys.push(key);
      }
    }
    for (const oldKey of legacyKeys) {
      const newKey = CURRENT_PREFIX + oldKey.slice(LEGACY_PREFIX.length);
      if (localStorage.getItem(newKey) === null) {
        const value = localStorage.getItem(oldKey);
        if (value !== null) {
          localStorage.setItem(newKey, value);
        }
      }
      localStorage.removeItem(oldKey);
    }
  } catch {
    // localStorage may be unavailable
  }
}
