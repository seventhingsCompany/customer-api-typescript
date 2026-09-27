import type { RequestOptions } from '../http.js';
import {
  tokenFromApi,
  type SSOAppTarget,
  type SSOProviderName,
  type TokenResponse,
} from '../models/auth.js';
import type { Wire } from '../models/wire.js';
import { Service } from './base.js';

const AUTH_TOKEN_PATH = 'auth_token';

/**
 * Token authentication. Every successful login stores the access token on the
 * client, so subsequent calls are authenticated. Tokens are not refreshed
 * automatically: call {@link refresh} with the refresh token before
 * `expiresIn` elapses.
 */
export class AuthService extends Service {
  /** Logs in with username and password (OAuth2 password grant). */
  login(
    username: string,
    password: string,
    clientId: string,
    options?: RequestOptions,
  ): Promise<TokenResponse> {
    this.http.session.clientId = clientId;
    return this.#postAuthToken(
      { grant_type: 'password', username, password, client_id: clientId },
      options,
    );
  }

  /** Exchanges a refresh token for a new access token, using the client ID of the last login. */
  refresh(refreshToken: string, options?: RequestOptions): Promise<TokenResponse> {
    return this.#postAuthToken(
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.http.session.clientId ?? '',
      },
      options,
    );
  }

  /** Logs in with an SSO authorization code. */
  loginSSO(
    provider: SSOProviderName,
    authCode: string,
    clientId: string,
    appTarget?: SSOAppTarget,
    options?: RequestOptions,
  ): Promise<TokenResponse> {
    this.http.session.clientId = clientId;
    const body: Wire = {
      grant_type: 'sso_auth_code',
      provider_name: provider,
      auth_code: authCode,
      client_id: clientId,
    };
    if (appTarget) body.app_target = appTarget;
    return this.#postAuthToken(body, options);
  }

  /** Revokes the current access and refresh tokens. */
  async revokeTokens(options?: RequestOptions): Promise<void> {
    await this.http.send({ method: 'DELETE', path: AUTH_TOKEN_PATH }, options);
  }

  async #postAuthToken(body: Wire, options?: RequestOptions): Promise<TokenResponse> {
    const w = await this.http.json<Wire>(
      { method: 'POST', path: AUTH_TOKEN_PATH, body, authenticated: false },
      options,
    );
    const token = tokenFromApi(w);
    this.http.session.token = token.accessToken;
    return token;
  }
}
