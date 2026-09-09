import { useTranslation } from 'react-i18next';
import type { BulkCreateHashtagChannelsResult, Channel } from '../types';
import { getConversationHash } from '../utils/urlHash';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface BulkAddChannelResultModalProps {
  open: boolean;
  result: BulkCreateHashtagChannelsResult | null;
  onClose: () => void;
}

function getChannelHref(channel: Channel): string {
  const hash = getConversationHash({
    type: 'channel',
    id: channel.key,
    name: channel.name,
  });
  if (typeof window === 'undefined') {
    return hash;
  }
  return `${window.location.origin}${window.location.pathname}${hash}`;
}

export function BulkAddChannelResultModal({
  open,
  result,
  onClose,
}: BulkAddChannelResultModalProps) {
  const { t } = useTranslation();
  const createdChannels = result?.created_channels ?? [];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t('newMessage.bulkTitle')}</DialogTitle>
          <DialogDescription>{result?.message ?? t('newMessage.bulkFallback')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {result && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2">
                <div className="text-[0.625rem] uppercase tracking-wider font-medium text-muted-foreground">
                  {t('newMessage.bulkCreated')}
                </div>
                <div className="mt-1 font-medium">{createdChannels.length}</div>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2">
                <div className="text-[0.625rem] uppercase tracking-wider font-medium text-muted-foreground">
                  {t('newMessage.bulkExisting')}
                </div>
                <div className="mt-1 font-medium">{result.existing_count}</div>
              </div>
            </div>
          )}

          {createdChannels.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('newMessage.bulkOpenHint')}</p>
              <div className="max-h-64 overflow-y-auto rounded-md border border-border/70">
                <ul className="divide-y divide-border/70">
                  {createdChannels.map((channel) => (
                    <li key={channel.key}>
                      <a
                        href={getChannelHref(channel)}
                        className="block px-3 py-2 text-sm text-primary hover:bg-accent hover:text-primary"
                      >
                        {channel.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('newMessage.bulkNone')}</p>
          )}

          {result && result.invalid_names.length > 0 && (
            <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              {t('newMessage.bulkIgnored', { names: result.invalid_names.join(', ') })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>{t('newMessage.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
