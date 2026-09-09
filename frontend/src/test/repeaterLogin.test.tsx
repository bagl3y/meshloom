import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RepeaterLogin } from '../components/RepeaterLogin';
import i18n from '../i18n';
import fEn from '../i18n/locales/slices/f.en.json';
import fFr from '../i18n/locales/slices/f.fr.json';

i18n.addResourceBundle('en', 'translation', fEn, true, true);
i18n.addResourceBundle('fr', 'translation', fFr, true, true);

describe('RepeaterLogin', () => {
  const defaultProps = {
    repeaterName: 'TestRepeater',
    loading: false,
    error: null as string | null,
    password: '',
    onPasswordChange: vi.fn(),
    rememberPassword: false,
    onRememberPasswordChange: vi.fn(),
    onLogin: vi.fn(),
    onLoginAsGuest: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders repeater name and description', () => {
    render(<RepeaterLogin {...defaultProps} />);

    expect(screen.getByText('TestRepeater')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('repeater.loginDescription'))).toBeInTheDocument();
  });

  it('renders password input and buttons', () => {
    render(<RepeaterLogin {...defaultProps} />);

    expect(screen.getByPlaceholderText(i18n.t('repeater.passwordPlaceholder'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('repeater.rememberPassword'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('repeater.loginPassword'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('repeater.loginGuest'))).toBeInTheDocument();
  });

  it('calls onLogin with trimmed password on submit', () => {
    render(<RepeaterLogin {...defaultProps} password="  secret  " />);
    fireEvent.submit(screen.getByText(i18n.t('repeater.loginPassword')).closest('form')!);

    expect(defaultProps.onLogin).toHaveBeenCalledWith('secret');
  });

  it('propagates password changes', () => {
    render(<RepeaterLogin {...defaultProps} />);

    const input = screen.getByPlaceholderText(i18n.t('repeater.passwordPlaceholder'));
    fireEvent.change(input, { target: { value: 'new secret' } });

    expect(defaultProps.onPasswordChange).toHaveBeenCalledWith('new secret');
  });

  it('toggles remember password checkbox', () => {
    render(<RepeaterLogin {...defaultProps} />);

    fireEvent.click(screen.getByLabelText(i18n.t('repeater.rememberPassword')));

    expect(defaultProps.onRememberPasswordChange).toHaveBeenCalledWith(true);
  });

  it('shows storage warning when remember password is enabled', () => {
    render(<RepeaterLogin {...defaultProps} rememberPassword={true} />);

    expect(screen.getByText(i18n.t('repeater.rememberPasswordWarning'))).toBeInTheDocument();
  });

  it('calls onLoginAsGuest when guest button clicked', () => {
    render(<RepeaterLogin {...defaultProps} />);

    fireEvent.click(screen.getByText(i18n.t('repeater.loginGuest')));
    expect(defaultProps.onLoginAsGuest).toHaveBeenCalledTimes(1);
  });

  it('disables inputs when loading', () => {
    render(<RepeaterLogin {...defaultProps} loading={true} />);

    expect(screen.getByPlaceholderText(i18n.t('repeater.passwordPlaceholder'))).toBeDisabled();
    expect(screen.getByText(i18n.t('repeater.loggingIn'))).toBeDisabled();
    expect(screen.getByText(i18n.t('repeater.loginGuest'))).toBeDisabled();
  });

  it('shows loading text on submit button', () => {
    render(<RepeaterLogin {...defaultProps} loading={true} />);

    expect(screen.getByText(i18n.t('repeater.loggingIn'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('repeater.loginPassword'))).not.toBeInTheDocument();
  });

  it('displays error message when present', () => {
    render(<RepeaterLogin {...defaultProps} error={i18n.t('toast.loginFailed')} />);

    expect(screen.getByText(i18n.t('toast.loginFailed'))).toBeInTheDocument();
  });

  it('does not call onLogin when loading', () => {
    render(<RepeaterLogin {...defaultProps} loading={true} />);

    fireEvent.submit(screen.getByText(i18n.t('repeater.loggingIn')).closest('form')!);
    expect(defaultProps.onLogin).not.toHaveBeenCalled();
  });
});
