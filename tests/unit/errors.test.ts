import { describe, expect, it } from 'vitest';
import {
  ApiError,
  isApiError,
  isConflict,
  isFeatureInactive,
  isForbidden,
  isNotFound,
  isRateLimited,
  isServerError,
  isUnauthorized,
  NetworkError,
  SeventhingsError,
} from '../../src/index.js';

describe('ApiError', () => {
  it('formats the message like the Go and PHP SDKs', () => {
    const err = new ApiError(404, 'Not Found', 'nope');
    expect(err.message).toBe('seventhings API error 404 (Not Found): nope');
    expect(err).toBeInstanceOf(SeventhingsError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
  });

  it.each([
    [401, isUnauthorized],
    [403, isForbidden],
    [404, isNotFound],
    [409, isConflict],
    [429, isRateLimited],
    [503, isServerError],
  ])('%i matches its predicate', (status, pred) => {
    const err = new ApiError(status, '', '');
    expect(pred(err)).toBe(true);
    expect(pred(new ApiError(400, '', ''))).toBe(false);
    expect(err.isStatusCode(status)).toBe(true);
  });

  it('predicates reject non-ApiErrors', () => {
    expect(isNotFound(new Error('x'))).toBe(false);
    expect(isNotFound(undefined)).toBe(false);
    expect(isApiError(new NetworkError('x'))).toBe(false);
  });

  it('detects inactive features', () => {
    const body = JSON.stringify({
      message: 'The required feature for this endpoint is not active',
    });
    expect(isFeatureInactive(new ApiError(403, 'Forbidden', body))).toBe(true);
    expect(isFeatureInactive(new ApiError(404, 'Not Found', body))).toBe(false);
    expect(isFeatureInactive(new ApiError(403, 'Forbidden', '{"message":"other"}'))).toBe(false);
    expect(isFeatureInactive(new ApiError(403, 'Forbidden', 'not json'))).toBe(false);
  });

  it('parses the JSON body', () => {
    expect(new ApiError(403, '', '{"detail":"Banned"}').json()).toEqual({ detail: 'Banned' });
    expect(new ApiError(500, '', '<html>').json()).toBeUndefined();
  });
});
