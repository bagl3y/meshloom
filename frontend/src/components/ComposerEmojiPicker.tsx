import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { REACTION_EMOJIS } from '../utils/meshcoreOpenPayloads';

interface ComposerEmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  disabled?: boolean;
}

export function ComposerEmojiPicker({
  onSelect,
  onClose,
  disabled = false,
}: ComposerEmojiPickerProps) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="emoji-picker"
      className="absolute inset-x-0 bottom-full z-40 mb-2 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <p className="min-w-0 flex-1 text-sm font-semibold">{t('chat.emojiPicker')}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          aria-label={t('chat.emojiClose')}
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto p-2">
        {REACTION_EMOJIS.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            type="button"
            disabled={disabled}
            className="h-9 w-full rounded-md text-lg hover:bg-accent disabled:opacity-50"
            aria-label={emoji}
            onClick={() => onSelect(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
