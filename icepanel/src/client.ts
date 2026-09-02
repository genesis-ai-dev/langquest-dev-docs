import { IcePanelClient, LandscapeVersion } from '@icepanel/sdk';
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(root, '.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} in icepanel/.env`);
  }
  return value;
}

export const env = {
  apiKey: required('ICEPANEL_API_KEY'),
  landscapeId: required('ICEPANEL_LANDSCAPE_KEY'),
  organizationId: required('ICEPANEL_ORGANIZATION_ID'),
  versionId: LandscapeVersion.Latest
};

export function createClient() {
  return new IcePanelClient({
    apiKey: env.apiKey,
    apiVersion: 'v1'
  });
}

export { root };
