import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getNotificationEnableToastInfo,
  useBrowserNotifications,
} from '../hooks/useBrowserNotifications';
import i18n from '../i18n';
import fEn from '../i18n/locales/slices/f.en.json';
import fFr from '../i18n/locales/slices/f.fr.json';
import type { Message } from '../types';

i18n.addResourceBundle('en', 'translation', fEn, true, true);
i18n.addResourceBundle('fr', 'translation', fFr, true, true);

const mocks = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../components/ui/sonner', () => ({
  toast: mocks.toast,
}));

const incomingChannelMessage: Message = {
  id: 42,
  type: 'CHAN',
  conversation_key: 'ab'.repeat(16),
  text: 'hello room',
  sender_timestamp: 1700000000,
  received_at: 1700000001,
  paths: null,
  txt_type: 0,
  signature: null,
  sender_key: 'cd'.repeat(32),
  outgoing: false,
  acked: 0,
  sender_name: 'Alice',
  channel_name: '#flightless',
};

describe('useBrowserNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.location.hash = '';
    vi.spyOn(window, 'open').mockReturnValue(null);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);

    const NotificationMock = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      this.close = vi.fn();
      this.onclick = null;
    });
    Object.assign(NotificationMock, {
      permission: 'granted',
      requestPermission: vi.fn(async () => 'granted'),
    });
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: NotificationMock,
    });
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });
  });

  it('stores notification opt-in per conversation', async () => {
    const { result } = renderHook(() => useBrowserNotifications());

    await act(async () => {
      await result.current.toggleConversationNotifications(
        'channel',
        incomingChannelMessage.conversation_key,
        '#flightless'
      );
    });

    expect(
      result.current.isConversationNotificationsEnabled(
        'channel',
        incomingChannelMessage.conversation_key
      )
    ).toBe(true);
    expect(result.current.isConversationNotificationsEnabled('contact', 'ef'.repeat(32))).toBe(
      false
    );
    expect(window.Notification).toHaveBeenCalledWith(
      i18n.t('notifications.newMessageIn', { name: '#flightless' }),
      {
        body: i18n.t('notifications.previewBody'),
        icon: './favicon-256x256.png',
        tag: `meshcore-notification-preview-channel-${incomingChannelMessage.conversation_key}`,
      }
    );
    expect(mocks.toast.warning).toHaveBeenCalledWith(i18n.t('notifications.enabledWarning'), {
      description: i18n.t('notifications.httpWarning'),
    });
  });

  it('only sends desktop notifications for opted-in conversations', async () => {
    const { result } = renderHook(() => useBrowserNotifications());

    await act(async () => {
      await result.current.toggleConversationNotifications(
        'channel',
        incomingChannelMessage.conversation_key,
        '#flightless'
      );
    });

    act(() => {
      result.current.notifyIncomingMessage(incomingChannelMessage);
      result.current.notifyIncomingMessage({
        ...incomingChannelMessage,
        id: 43,
        conversation_key: '34'.repeat(16),
        channel_name: '#elsewhere',
      });
    });

    expect(window.Notification).toHaveBeenCalledTimes(2);
    expect(window.Notification).toHaveBeenNthCalledWith(
      2,
      i18n.t('notifications.newMessageIn', { name: '#flightless' }),
      {
        body: 'hello room',
        icon: './favicon-256x256.png',
        tag: 'meshcore-message-42',
      }
    );
  });

  it('notification click deep-links to the conversation hash', async () => {
    const focusSpy = vi.spyOn(window, 'focus').mockImplementation(() => {});
    const { result } = renderHook(() => useBrowserNotifications());

    await act(async () => {
      await result.current.toggleConversationNotifications(
        'channel',
        incomingChannelMessage.conversation_key,
        '#flightless'
      );
    });

    act(() => {
      result.current.notifyIncomingMessage(incomingChannelMessage);
    });

    const notificationInstance = (window.Notification as unknown as ReturnType<typeof vi.fn>).mock
      .instances[1] as {
      onclick: (() => void) | null;
      close: ReturnType<typeof vi.fn>;
    };

    act(() => {
      notificationInstance.onclick?.();
    });

    expect(window.open).toHaveBeenCalledWith(
      `${window.location.origin}${window.location.pathname}#channel/${incomingChannelMessage.conversation_key}/%23flightless`,
      '_self'
    );
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(notificationInstance.close).toHaveBeenCalledTimes(1);
  });

  it('shows the browser guidance toast when notifications are blocked', async () => {
    Object.assign(window.Notification, {
      permission: 'denied',
    });

    const { result } = renderHook(() => useBrowserNotifications());

    await act(async () => {
      await result.current.toggleConversationNotifications(
        'channel',
        incomingChannelMessage.conversation_key,
        '#flightless'
      );
    });

    expect(mocks.toast.error).toHaveBeenCalledWith(i18n.t('notifications.blocked'), {
      description: i18n.t('notifications.blockedDetail'),
    });
  });

  it('shows a warning toast when notifications are enabled on HTTP', async () => {
    const { result } = renderHook(() => useBrowserNotifications());

    await act(async () => {
      await result.current.toggleConversationNotifications(
        'channel',
        incomingChannelMessage.conversation_key,
        '#flightless'
      );
    });

    expect(mocks.toast.warning).toHaveBeenCalledWith(i18n.t('notifications.enabledWarning'), {
      description: i18n.t('notifications.httpWarning'),
    });
    expect(mocks.toast.success).not.toHaveBeenCalledWith(i18n.t('notifications.enabled'));
  });

  it('best-effort detects insecure HTTPS for the enable-warning copy', () => {
    expect(
      getNotificationEnableToastInfo({
        protocol: 'https:',
        isSecureContext: false,
      })
    ).toEqual({
      level: 'warning',
      title: i18n.t('notifications.enabledWarning'),
      description: i18n.t('notifications.httpsUntrustedWarning'),
    });
  });

  it('shows a descriptive success toast when notifications are disabled', async () => {
    const { result } = renderHook(() => useBrowserNotifications());

    await act(async () => {
      await result.current.toggleConversationNotifications(
        'channel',
        incomingChannelMessage.conversation_key,
        '#flightless'
      );
    });

    await act(async () => {
      await result.current.toggleConversationNotifications(
        'channel',
        incomingChannelMessage.conversation_key,
        '#flightless'
      );
    });

    expect(mocks.toast.success).toHaveBeenCalledWith(i18n.t('notifications.disabled'), {
      description: i18n.t('notifications.disabledOn', { label: '#flightless' }),
    });
  });
});
