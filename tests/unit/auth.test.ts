import { describe, expect, it } from 'vitest';
import { ApiError, LoginDeniedReason, SSOAppTarget, SSOProviderName } from '../../src/index.js';
import { error, json, ok, setup } from './mock.js';

const TOKEN = {
  access_token: 'new-jwt',
  expires_in: 3600,
  token_type: 'Bearer',
  scope: null,
  refresh_token: 'refresh',
  user_id: 7,
};

describe('auth', () => {
  it('login posts the password grant unauthenticated and stores the token', async () => {
    const { client, last } = setup(() => json(TOKEN));
    const tok = await client.auth.login('user', 'pass', 'cid');
    expect(last().method).toBe('POST');
    expect(last().path).toBe('auth_token');
    expect(last().headers.has('Authorization')).toBe(false);
    expect(last().json()).toEqual({
      grant_type: 'password',
      username: 'user',
      password: 'pass',
      client_id: 'cid',
    });
    expect(tok).toEqual({
      accessToken: 'new-jwt',
      expiresIn: 3600,
      tokenType: 'Bearer',
      scope: null,
      refreshToken: 'refresh',
      userId: 7,
    });
    expect(client.token).toBe('new-jwt');
    expect(client.clientId).toBe('cid');
  });

  it('login surfaces 401', async () => {
    const { client } = setup(() => error(401));
    await expect(client.auth.login('u', 'p', 'c')).rejects.toMatchObject({ statusCode: 401 });
    expect(client.token).toBe('test-token');
  });

  it('login denial detail is readable from the error', async () => {
    const { client } = setup(() => error(403, '{"detail":"Banned"}'));
    const err = (await client.auth.login('u', 'p', 'c').catch((e: unknown) => e)) as ApiError;
    expect(err.json<{ detail: string }>()?.detail).toBe(LoginDeniedReason.Banned);
  });

  it('refresh uses the stored client id', async () => {
    const { client, last } = setup(() => json(TOKEN), { clientId: 'stored' });
    await client.auth.refresh('rt');
    expect(last().json()).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'rt',
      client_id: 'stored',
    });
    expect(client.token).toBe('new-jwt');
  });

  it('loginSSO sends sso_auth_code with provider_name', async () => {
    const { client, last } = setup(() => json(TOKEN));
    await client.auth.loginSSO(SSOProviderName.Azure, 'code', 'cid', SSOAppTarget.Mobile);
    expect(last().json()).toEqual({
      grant_type: 'sso_auth_code',
      provider_name: 'azure-open-id-connect',
      auth_code: 'code',
      client_id: 'cid',
      app_target: 'mobile',
    });
  });

  it('loginSSO omits app_target when not given', async () => {
    const { client, last } = setup(() => json(TOKEN));
    await client.auth.loginSSO(SSOProviderName.Google, 'code', 'cid');
    expect(last().json()).not.toHaveProperty('app_target');
  });

  it('revokeTokens sends an authenticated DELETE', async () => {
    const { client, last } = setup(() => ok());
    await client.auth.revokeTokens();
    expect(last().method).toBe('DELETE');
    expect(last().path).toBe('auth_token');
    expect(last().headers.get('Authorization')).toBe('Bearer test-token');
  });
});
