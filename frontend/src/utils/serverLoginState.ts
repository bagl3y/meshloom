import i18n from '../i18n';
import type { RepeaterLoginResponse } from '../types';

export type ServerLoginMethod = 'password' | 'blank';
export type ServerLoginEntity = 'repeater' | 'room';

export type ServerLoginAttemptState =
  | {
      method: ServerLoginMethod;
      outcome: 'confirmed';
      summary: string;
      details: string | null;
      heardBack: true;
      at: number;
    }
  | {
      method: ServerLoginMethod;
      outcome: 'not_confirmed';
      summary: string;
      details: string | null;
      heardBack: boolean;
      at: number;
    }
  | {
      method: ServerLoginMethod;
      outcome: 'request_failed';
      summary: string;
      details: string | null;
      heardBack: false;
      at: number;
    };

function getServerLoginMethodLabel(method: ServerLoginMethod, entity: ServerLoginEntity): string {
  return method === 'password'
    ? i18n.t(`${entity}.loginMethodPassword`)
    : i18n.t(`${entity}.loginMethodExisting`);
}

export function getServerLoginAttemptTone(
  attempt: ServerLoginAttemptState | null
): 'success' | 'warning' | 'destructive' | 'muted' {
  if (!attempt) return 'muted';
  if (attempt.outcome === 'confirmed') return 'success';
  if (attempt.outcome === 'not_confirmed') return 'warning';
  return 'destructive';
}

export function buildServerLoginAttemptFromResponse(
  method: ServerLoginMethod,
  result: RepeaterLoginResponse,
  entity: ServerLoginEntity
): ServerLoginAttemptState {
  const methodLabel = getServerLoginMethodLabel(method, entity);
  const at = Date.now();

  if (result.authenticated) {
    return {
      method,
      outcome: 'confirmed',
      summary: i18n.t(`${entity}.loginConfirmedSummary`),
      details: null,
      heardBack: true,
      at,
    };
  }

  if (result.status === 'timeout') {
    return {
      method,
      outcome: 'not_confirmed',
      summary: i18n.t(`${entity}.loginUnconfirmedSummary`),
      details: result.message ?? i18n.t(`${entity}.loginTimeoutDetail`, { method: methodLabel }),
      heardBack: false,
      at,
    };
  }

  return {
    method,
    outcome: 'not_confirmed',
    summary: i18n.t(`${entity}.loginNotConfirmedSummary`),
    details:
      result.message ??
      i18n.t(`${entity}.loginRespondedUnconfirmedDetail`, { method: methodLabel }),
    heardBack: true,
    at,
  };
}

export function buildServerLoginAttemptFromError(
  method: ServerLoginMethod,
  message: string,
  entity: ServerLoginEntity
): ServerLoginAttemptState {
  const methodLabel = getServerLoginMethodLabel(method, entity);
  return {
    method,
    outcome: 'request_failed',
    summary: i18n.t(`${entity}.loginRequestFailedSummary`),
    details: i18n.t(`${entity}.loginRequestFailedDetail`, { method: methodLabel, message }),
    heardBack: false,
    at: Date.now(),
  };
}
