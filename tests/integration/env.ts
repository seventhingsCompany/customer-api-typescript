import { onTestFinished } from 'vitest';
import {
  FieldTypeName,
  isFeatureInactive,
  SeventhingsClient,
  allowedValues,
  type AssetTrackingTemplate,
} from '../../src/index.js';

export const env = {
  baseUrl: process.env.SEVENTHINGS_BASE_URL ?? '',
  username: process.env.SEVENTHINGS_USERNAME ?? '',
  password: process.env.SEVENTHINGS_PASSWORD ?? '',
  clientId: process.env.SEVENTHINGS_CLIENT_ID ?? '',
};

/** True when any credential is missing; use with describe.skipIf. */
export const missingEnv = !env.baseUrl || !env.username || !env.password || !env.clientId;

export const SKIP_REASON =
  'set SEVENTHINGS_BASE_URL, SEVENTHINGS_USERNAME, SEVENTHINGS_PASSWORD, SEVENTHINGS_CLIENT_ID to run integration tests';

if (missingEnv) console.warn(`[integration] skipped: ${SKIP_REASON}`);

let shared: Promise<SeventhingsClient> | undefined;

/** A logged-in client shared by the test file. */
export function client(): Promise<SeventhingsClient> {
  shared ??= login();
  return shared;
}

export function login(): Promise<SeventhingsClient> {
  return SeventhingsClient.withCredentials({
    instanceUrl: env.baseUrl,
    username: env.username,
    password: env.password,
    clientId: env.clientId,
  });
}

export function unique(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Runs fn after the current test, ignoring errors (the resource may already be gone). */
export function cleanup(fn: () => Promise<unknown>): void {
  onTestFinished(async () => {
    await fn().catch(() => undefined);
  });
}

/** Creates a throwaway object and deletes it after the test. */
export async function tempObject(c: SeventhingsClient, label = 'obj'): Promise<string> {
  const uuid = await c.objects.create({
    inventory_name: `ts-int-${label}-${unique()}`,
    barcode: `TS-INT-${unique()}`,
  });
  cleanup(() => c.objects.delete(uuid));
  return uuid;
}

/**
 * Best-effort values for instance-specific mandatory fields: the first allowed
 * value for dropdowns, a string for text. Returns undefined if a mandatory
 * field cannot be filled automatically.
 */
export async function fillMandatory(
  c: SeventhingsClient,
  template: AssetTrackingTemplate,
  fields: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined> {
  const out = { ...fields };
  for (const d of await c.fieldDefinitions.mandatory(template)) {
    if (d.fieldKey in out) continue;
    const allowed = allowedValues(d.fieldType);
    if (d.fieldType.name === FieldTypeName.Dropdown && allowed?.length) {
      out[d.fieldKey] = allowed[0];
    } else if (
      d.fieldType.name === FieldTypeName.Text ||
      d.fieldType.name === FieldTypeName.LongText
    ) {
      out[d.fieldKey] = `ts-int-${unique()}`;
    } else {
      return undefined;
    }
  }
  return out;
}

/** Runs fn, returning undefined when the instance does not have the feature enabled. */
export async function ifFeatureActive<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    if (isFeatureInactive(err)) return undefined;
    throw err;
  }
}
