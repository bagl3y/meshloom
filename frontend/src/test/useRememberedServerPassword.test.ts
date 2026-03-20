import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useRememberedServerPassword } from '../hooks/useRememberedServerPassword';

describe('useRememberedServerPassword', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads remembered passwords from localStorage', () => {
    localStorage.setItem(
      'remoteterm-server-password:repeater:abc123',
      JSON.stringify({ password: 'stored-secret' })
    );

    const { result } = renderHook(() => useRememberedServerPassword('repeater', 'abc123'));

    expect(result.current.password).toBe('stored-secret');
    expect(result.current.rememberPassword).toBe(true);
  });

  it('stores passwords after login when remember is enabled', () => {
    const { result } = renderHook(() => useRememberedServerPassword('room', 'room-key'));

    act(() => {
      result.current.setRememberPassword(true);
    });

    act(() => {
      result.current.persistAfterLogin('  hello  ');
    });

    expect(localStorage.getItem('remoteterm-server-password:room:room-key')).toBe(
      JSON.stringify({ password: 'hello' })
    );
    expect(result.current.password).toBe('hello');
  });

  it('clears stored passwords when login is done with remember disabled', () => {
    localStorage.setItem(
      'remoteterm-server-password:repeater:abc123',
      JSON.stringify({ password: 'stored-secret' })
    );

    const { result } = renderHook(() => useRememberedServerPassword('repeater', 'abc123'));

    act(() => {
      result.current.setRememberPassword(false);
    });

    act(() => {
      result.current.persistAfterLogin('new-secret');
    });

    expect(localStorage.getItem('remoteterm-server-password:repeater:abc123')).toBeNull();
    expect(result.current.password).toBe('');
  });

  it('preserves remembered passwords on guest login when remember stays enabled', () => {
    localStorage.setItem(
      'remoteterm-server-password:room:room-key',
      JSON.stringify({ password: 'stored-secret' })
    );

    const { result } = renderHook(() => useRememberedServerPassword('room', 'room-key'));

    act(() => {
      result.current.persistAfterLogin('');
    });

    expect(localStorage.getItem('remoteterm-server-password:room:room-key')).toBe(
      JSON.stringify({ password: 'stored-secret' })
    );
    expect(result.current.password).toBe('stored-secret');
  });
});
