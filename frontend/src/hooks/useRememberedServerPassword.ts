import { useCallback, useEffect, useMemo, useState } from 'react';

type ServerLoginKind = 'repeater' | 'room';

const STORAGE_KEY_PREFIX = 'remoteterm-server-password';

type StoredPassword = {
  password: string;
};

function getStorageKey(kind: ServerLoginKind, publicKey: string): string {
  return `${STORAGE_KEY_PREFIX}:${kind}:${publicKey}`;
}

function loadStoredPassword(kind: ServerLoginKind, publicKey: string): StoredPassword | null {
  try {
    const raw = localStorage.getItem(getStorageKey(kind, publicKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPassword>;
    if (typeof parsed.password !== 'string' || parsed.password.length === 0) {
      return null;
    }
    return { password: parsed.password };
  } catch {
    return null;
  }
}

export function useRememberedServerPassword(kind: ServerLoginKind, publicKey: string) {
  const storageKey = useMemo(() => getStorageKey(kind, publicKey), [kind, publicKey]);
  const [password, setPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(false);

  useEffect(() => {
    const stored = loadStoredPassword(kind, publicKey);
    if (!stored) {
      setPassword('');
      setRememberPassword(false);
      return;
    }
    setPassword(stored.password);
    setRememberPassword(true);
  }, [kind, publicKey]);

  const persistAfterLogin = useCallback(
    (submittedPassword: string) => {
      if (!rememberPassword) {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          // localStorage may be unavailable
        }
        setPassword('');
        return;
      }

      const trimmedPassword = submittedPassword.trim();
      if (!trimmedPassword) {
        return;
      }

      try {
        localStorage.setItem(storageKey, JSON.stringify({ password: trimmedPassword }));
      } catch {
        // localStorage may be unavailable
      }
      setPassword(trimmedPassword);
    },
    [rememberPassword, storageKey]
  );

  return {
    password,
    setPassword,
    rememberPassword,
    setRememberPassword,
    persistAfterLogin,
  };
}
