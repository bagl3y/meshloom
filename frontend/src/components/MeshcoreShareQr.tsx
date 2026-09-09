import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from './ui/button';
import { toast } from './ui/sonner';

/** Official meshcore:// URI as QR + clipboard copy. Owns the render, not a pass-through. */
export function MeshcoreShareQr({ uri }: { uri: string }) {
  const { t } = useTranslation();
  const [showQr, setShowQr] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(uri).then(() => {
              toast.success(t('share.copied'));
            });
          }}
        >
          <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {t('share.copyUri')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={showQr}
          onClick={() => setShowQr((open) => !open)}
        >
          <QrCode className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {showQr ? t('share.hideQr') : t('share.showQr')}
        </Button>
      </div>
      {showQr && (
        <div className="w-fit rounded-md border border-border bg-white p-2">
          <QRCodeSVG
            value={uri}
            size={144}
            level="M"
            marginSize={1}
            bgColor="#ffffff"
            fgColor="#000000"
            title={t('share.qrTitle')}
            className="h-36 w-36"
          />
        </div>
      )}
    </div>
  );
}
