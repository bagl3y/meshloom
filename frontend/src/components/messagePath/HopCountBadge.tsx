import { useTranslation } from 'react-i18next';
import type { MessagePath } from '../../types';
import { usePathHopWidth } from '../../contexts/PathHopWidthContext';
import { formatHopCounts, formatPathHopWidths } from '../../utils/pathUtils';
import { handleKeyboardActivate } from '../../utils/a11y';
import type { MessagePathSelection } from './MessagePathModalHost';

// Clickable hop count badge that opens the path modal
interface HopCountBadgeProps {
  paths: MessagePath[];
  senderInfo: MessagePathSelection['senderInfo'];
  messageId?: number;
  packetId?: number | null;
  isOutgoingChan?: boolean;
  onOpen: (selection: MessagePathSelection) => void;
  variant: 'header' | 'inline';
}

export function HopCountBadge({
  paths,
  senderInfo,
  messageId,
  packetId,
  isOutgoingChan,
  onOpen,
  variant,
}: HopCountBadgeProps) {
  const { t } = useTranslation();
  const { showPathHopWidth } = usePathHopWidth();
  const hopInfo = formatHopCounts(paths);
  const widthLabel = showPathHopWidth ? formatPathHopWidths(paths) : null;
  const label = widthLabel ? `(${hopInfo.display} · ${widthLabel})` : `(${hopInfo.display})`;

  const className =
    variant === 'header'
      ? 'font-normal text-muted-foreground ml-1 text-[0.6875rem] cursor-pointer hover:text-primary hover:underline'
      : 'text-[0.625rem] text-muted-foreground ml-1 cursor-pointer hover:text-primary hover:underline';

  return (
    <span
      className={className}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyboardActivate}
      onClick={(e) => {
        e.stopPropagation();
        onOpen({ paths, senderInfo, messageId, packetId, isOutgoingChan });
      }}
      title={widthLabel ? t('path.viewPathWidth', { width: widthLabel }) : t('path.viewPath')}
      aria-label={
        widthLabel
          ? t('path.viewPathAriaWidth', { hops: hopInfo.display, width: widthLabel })
          : t('path.viewPathAria', { hops: hopInfo.display })
      }
    >
      {label}
    </span>
  );
}
