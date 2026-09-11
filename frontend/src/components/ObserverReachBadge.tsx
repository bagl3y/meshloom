import { Ear } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ObserverReachCountState } from '../types';
import { handleKeyboardActivate } from '../utils/a11y';
import { cn } from '@/lib/utils';

interface ObserverReachBadgeProps {
  state?: ObserverReachCountState;
  variant: 'header' | 'inline';
  onOpen: () => void;
}

export function ObserverReachBadge({ state, variant, onOpen }: ObserverReachBadgeProps) {
  const { t } = useTranslation();
  const isError = state?.status === 'error';
  const count = state?.status === 'ok' ? state.count : undefined;
  const label =
    count === undefined
      ? isError
        ? t('messageList.observerReachUnavailable')
        : t('messageList.observerReachLoading')
      : t('messageList.observerReachAria', { count });

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 cursor-pointer hover:text-primary',
        variant === 'header'
          ? 'ml-1 text-[0.6875rem] text-muted-foreground'
          : 'ml-1 text-[0.625rem] text-muted-foreground',
        isError && 'text-warning'
      )}
      role="button"
      tabIndex={0}
      data-testid="observer-reach-badge"
      onKeyDown={handleKeyboardActivate}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      title={label}
      aria-label={label}
    >
      <Ear className="h-3 w-3" aria-hidden="true" />
      {count !== undefined && <span className="tabular-nums">{count}</span>}
    </span>
  );
}
