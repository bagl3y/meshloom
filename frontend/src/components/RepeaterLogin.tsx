import { useCallback, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { shouldAutoFocusInput } from '../utils/autoFocusInput';

interface RepeaterLoginProps {
  repeaterName: string;
  loading: boolean;
  error: string | null;
  password: string;
  onPasswordChange: (password: string) => void;
  rememberPassword: boolean;
  onRememberPasswordChange: (checked: boolean) => void;
  onLogin: (password: string) => Promise<void>;
  onLoginAsGuest: () => Promise<void>;
  description?: string;
  passwordPlaceholder?: string;
  loginLabel?: string;
  guestLabel?: string;
}

export function RepeaterLogin({
  repeaterName,
  loading,
  error,
  password,
  onPasswordChange,
  rememberPassword,
  onRememberPasswordChange,
  onLogin,
  onLoginAsGuest,
  description,
  passwordPlaceholder,
  loginLabel,
  guestLabel,
}: RepeaterLoginProps) {
  const { t } = useTranslation();
  const resolvedDescription = description ?? t('repeater.loginDescription');
  const resolvedPlaceholder = passwordPlaceholder ?? t('repeater.passwordPlaceholder');
  const resolvedLoginLabel = loginLabel ?? t('repeater.loginPassword');
  const resolvedGuestLabel = guestLabel ?? t('repeater.loginGuest');

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (loading) return;
      await onLogin(password.trim());
    },
    [password, loading, onLogin]
  );

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold">{repeaterName}</h2>
          <p className="text-sm text-muted-foreground">{resolvedDescription}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <Input
            type="password"
            autoComplete="off"
            name="repeater-password"
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={resolvedPlaceholder}
            aria-label={t('repeater.passwordAria')}
            disabled={loading}
            autoFocus={shouldAutoFocusInput()}
          />

          <label
            htmlFor="remember-server-password"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Checkbox
              id="remember-server-password"
              checked={rememberPassword}
              disabled={loading}
              onCheckedChange={(checked) => onRememberPasswordChange(checked === true)}
            />
            <span>{t('repeater.rememberPassword')}</span>
          </label>

          {rememberPassword && (
            <p className="text-xs text-muted-foreground">{t('repeater.rememberPasswordWarning')}</p>
          )}

          {error && (
            <p className="text-sm text-destructive text-center" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? t('repeater.loggingIn') : resolvedLoginLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              className="w-full"
              onClick={onLoginAsGuest}
            >
              {resolvedGuestLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
