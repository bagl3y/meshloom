import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { RepeaterPane, NotFetched } from './repeaterPaneShared';
import type { RepeaterAclResponse, PaneState } from '../../types';

export function AclPane({
  data,
  state,
  onRefresh,
  disabled,
}: {
  data: RepeaterAclResponse | null;
  state: PaneState;
  onRefresh: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const permColor: Record<number, string> = {
    0: 'bg-muted text-muted-foreground',
    1: 'bg-info/10 text-info',
    2: 'bg-success/10 text-success',
    3: 'bg-warning/10 text-warning',
  };

  return (
    <RepeaterPane title={t('repeater.acl')} state={state} onRefresh={onRefresh} disabled={disabled}>
      {!data ? (
        <NotFetched />
      ) : data.acl.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('repeater.noAcl')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground text-xs">
              <th className="pb-1 font-medium">{t('repeater.name')}</th>
              <th className="pb-1 font-medium text-right">{t('repeater.permission')}</th>
            </tr>
          </thead>
          <tbody>
            {data.acl.map((entry, i) => (
              <tr key={i} className="border-t border-border/50">
                <td className="py-1">{entry.name || entry.pubkey_prefix}</td>
                <td className="py-1 text-right">
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded',
                      permColor[entry.permission] ?? 'bg-muted text-muted-foreground'
                    )}
                  >
                    {entry.permission_name}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </RepeaterPane>
  );
}
