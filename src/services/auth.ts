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

  /**
   * Exchanges an OAuth 2.1 authorization code using PKCE. `redirectUri` must
   * match the URI used for authorization; `codeVerifier` is the original
   * verifier behind the authorization request's code challenge.
   */
  async loginAuthorizationCode(
    code: string,
    codeVerifier: string,
    redirectUri: string,
    clientId: string,
    options?: RequestOptions,
  ): Promise<TokenResponse> {
    this.http.session.clientId = clientId;
    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      client_id: clientId,
    });
    return this.#storeToken(
      await this.http.json<Wire>(
        { method: 'POST', path: AUTH_TOKEN_PATH, form, authenticated: false },
        options,
      ),
    );
  }

  /** Revokes the current access and refresh tokens. */
  async revokeTokens(options?: RequestOptions): Promise<void> {
    await this.http.send({ method: 'DELETE', path: AUTH_TOKEN_PATH }, options);
  }

  async #postAuthToken(body: Wire, options?: RequestOptions): Promise<TokenResponse> {
    return this.#storeToken(
      await this.http.json<Wire>(
        { method: 'POST', path: AUTH_TOKEN_PATH, body, authenticated: false },
        options,
      ),
    );
  }

  #storeToken(w: Wire | undefined): TokenResponse {
    const token = tokenFromApi(w ?? {});
    this.http.session.token = token.accessToken;
    return token;
  }
}
