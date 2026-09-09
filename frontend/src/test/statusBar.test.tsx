import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StatusBar } from '../components/StatusBar';
import i18n from '../i18n';
import type { HealthStatus } from '../types';

const baseHealth: HealthStatus = {
  status: 'degraded',
  radio_connected: false,
  radio_initializing: false,
  connection_info: null,
  database_size_mb: 1.2,
  oldest_undecrypted_timestamp: null,
  fanout_statuses: {},
  bots_disabled: false,
};

describe('StatusBar', () => {
  it('shows Radio Initializing while setup is still running', () => {
    render(
      <StatusBar
        health={{ ...baseHealth, radio_connected: true, radio_initializing: true }}
        config={null}
        onSettingsClick={vi.fn()}
      />
    );

    expect(
      screen.getByRole('status', { name: i18n.t('statusBar.radioInitializing') })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('statusBar.reconnect') })
    ).not.toBeInTheDocument();
  });

  it('shows Radio OK when the radio is connected and ready', () => {
    render(
      <StatusBar
        health={{ ...baseHealth, status: 'ok', radio_connected: true }}
        config={null}
        onSettingsClick={vi.fn()}
      />
    );

    expect(screen.getByRole('status', { name: i18n.t('statusBar.radioOk') })).toBeInTheDocument();
  });

  it('shows Radio Disconnected when the radio is unavailable', () => {
    render(<StatusBar health={baseHealth} config={null} onSettingsClick={vi.fn()} />);

    expect(
      screen.getByRole('status', { name: i18n.t('statusBar.radioDisconnected') })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('statusBar.reconnect') })).toBeInTheDocument();
  });

  it('shows Radio Paused and a Connect action when reconnect attempts are paused', () => {
    render(
      <StatusBar
        health={{ ...baseHealth, radio_state: 'paused' }}
        config={null}
        onSettingsClick={vi.fn()}
      />
    );

    expect(
      screen.getByRole('status', { name: i18n.t('statusBar.radioPaused') })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('statusBar.connect') })).toBeInTheDocument();
  });

  it('toggles between classic and light themes from the shortcut button', () => {
    localStorage.setItem('remoteterm-theme', 'cyberpunk');

    render(<StatusBar health={baseHealth} config={null} onSettingsClick={vi.fn()} />);

    const themeToggle = screen.getByRole('button', { name: i18n.t('statusBar.themeLight') });
    fireEvent.click(themeToggle);

    expect(localStorage.getItem('remoteterm-theme')).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');

    fireEvent.click(screen.getByRole('button', { name: i18n.t('statusBar.themeClassic') }));

    expect(localStorage.getItem('remoteterm-theme')).toBe('original');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  describe('with Follow OS theme saved', () => {
    const originalMatchMedia = globalThis.matchMedia;

    afterEach(() => {
      globalThis.matchMedia = originalMatchMedia;
    });

    // Stub matchMedia so prefers-color-scheme: light returns the desired value.
    const setPrefersLight = (isLight: boolean) => {
      Object.defineProperty(globalThis, 'matchMedia', {
        configurable: true,
        value: (query: string) => ({
          matches: query.includes('light') ? isLight : !isLight,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      });
    };

    it('clicking toggle while OS prefers dark overrides follow-os into explicit light', () => {
      setPrefersLight(false);
      localStorage.setItem('remoteterm-theme', 'follow-os');

      render(<StatusBar health={baseHealth} config={null} onSettingsClick={vi.fn()} />);

      // OS is dark → effective is original → toggle offers light theme
      const toggle = screen.getByRole('button', { name: i18n.t('statusBar.themeLight') });
      fireEvent.click(toggle);

      expect(localStorage.getItem('remoteterm-theme')).toBe('light');
      expect(document.documentElement.dataset.theme).toBe('light');
    });

    it('clicking toggle while OS prefers light overrides follow-os into explicit dark', () => {
      setPrefersLight(true);
      localStorage.setItem('remoteterm-theme', 'follow-os');

      render(<StatusBar health={baseHealth} config={null} onSettingsClick={vi.fn()} />);

      // OS is light → effective is light → toggle offers classic theme
      const toggle = screen.getByRole('button', { name: i18n.t('statusBar.themeClassic') });
      fireEvent.click(toggle);

      expect(localStorage.getItem('remoteterm-theme')).toBe('original');
      expect(document.documentElement.dataset.theme).toBeUndefined();
    });
  });
});
