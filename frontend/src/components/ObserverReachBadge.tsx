import { Ear } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ObserverReachCountState } from '../types';
import { handleKeyboardActivate } from '../utils/a11y';
import { cn } from '@/lib/utils';

interface ObserverReachBadgeProps {
  state?: ObserverReachCountState;
  variant: 'header' | 'inline';
  onOpen: () => void;
  className?: string;
}

export function ObserverReachBadge({
  state,
  variant,
  onOpen,
  className,
}: ObserverReachBadgeProps) {
  const { t } = useTranslation();
  if (state?.status !== 'ok' || state.count <= 0) {
    return null;
  }
  const count = state.count;
  const label = t('messageList.observerReachAria', { count });

  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-0.5 cursor-pointer hover:text-primary hover:underline',
        variant === 'header'
          ? 'font-normal text-muted-foreground ml-1 text-[0.6875rem]'
          : 'text-[0.625rem] text-muted-foreground ml-1',
        className
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
      <Ear className="h-[1em] w-[1em] shrink-0 self-center" aria-hidden="true" />
      <span className="tabular-nums">{count}</span>
    </span>
  );
}
