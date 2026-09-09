import { Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Green repeater glyph for a unique local type-2 hop at 2+ bytes. */
export function LocalRepeaterIcon() {
  const { t } = useTranslation();
  return (
    <Radio
      aria-label={t('path.localRepeater')}
      data-testid="local-repeater-icon"
      className="size-3.5 shrink-0 text-success"
    />
  );
}
