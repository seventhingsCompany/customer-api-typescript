import { num, strOrNull, str, type Wire } from './wire.js';

/** SSO identity provider for {@link AuthService.loginSSO}. */
export const SSOProviderName = {
  Azure: 'azure-open-id-connect',
  Google: 'google-open-id-connect',
  OneLogin: 'one-login-open-id-connect',
} as const;
export type SSOProviderName = (typeof SSOProviderName)[keyof typeof SSOProviderName];

/** Application target for SSO login. */
export const SSOAppTarget = {
  Web: 'web',
  Mobile: 'mobile',
} as const;
export type SSOAppTarget = (typeof SSOAppTarget)[keyof typeof SSOAppTarget];

/**
 * Why a login was denied. A denied login is an ApiError with status 403 whose
 * JSON body is `{ "detail": LoginDeniedReason }`.
 */
export const LoginDeniedReason = {
  Deactivated: 'LoginDeactivated',
  Banned: 'Banned',
  EmailUnconfirmed: 'EmailUnconfirmed',
  Inactive: 'Inactive',
  OnlySSOLoginAllowed: 'OnlySSOLoginAllowed',
} as const;
export type LoginDeniedReason = (typeof LoginDeniedReason)[keyof typeof LoginDeniedReason];

/** Response of a successful login or refresh. */
export interface TokenResponse {
  accessToken: string;
  /** Lifetime of the access token in seconds. */
  expiresIn: number;
  tokenType: string;
  scope: string | null;
  refreshToken: string;
  userId: number;
}

/** @internal */
export function tokenFromApi(w: Wire): TokenResponse {
  return {
    accessToken: str(w.access_token),
    expiresIn: num(w.expires_in),
    tokenType: str(w.token_type),
    scope: strOrNull(w.scope),
    refreshToken: str(w.refresh_token),
    userId: num(w.user_id),
  };
}
