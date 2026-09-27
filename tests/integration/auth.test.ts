import { describe, expect, it } from 'vitest';
import { isUnauthorized, SeventhingsClient } from '../../src/index.js';
import { env, login, missingEnv } from './env.js';

describe.skipIf(missingEnv)('auth', () => {
  it('ping works without credentials', async () => {
    const c = new SeventhingsClient({ instanceUrl: env.baseUrl });
    const ping = await c.ping();
    expect(typeof ping.status).toBe('string');
  });

  it('login returns a token', async () => {
    const c = new SeventhingsClient({ instanceUrl: env.baseUrl });
    const tok = await c.auth.login(env.username, env.password, env.clientId);
    expect(tok.accessToken).not.toBe('');
    expect(tok.expiresIn).toBeGreaterThan(0);
    expect(c.token).toBe(tok.accessToken);
  });

  it('rejects bad credentials', async () => {
    const c = new SeventhingsClient({ instanceUrl: env.baseUrl });
    const err = await c.auth.login(env.username, 'definitely-wrong', env.clientId).catch((e) => e);
    expect(isUnauthorized(err) || (err as { statusCode?: number }).statusCode === 400).toBe(true);
  });

  it('refresh and revoke', async () => {
    const c = new SeventhingsClient({ instanceUrl: env.baseUrl });
    const first = await c.auth.login(env.username, env.password, env.clientId);
    const refreshed = await c.auth.refresh(first.refreshToken);
    expect(refreshed.accessToken).not.toBe('');
    expect(c.token).toBe(refreshed.accessToken);
    await c.auth.revokeTokens();
    await expect(c.users.list({ perPage: 1 })).rejects.toSatisfy(isUnauthorized);
  });

  it('withCredentials', async () => {
    const c = await login();
    expect(c.token).toBeTruthy();
  });
});
