import { v4 as uuidv4 } from 'uuid';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import * as db from '../db.js';

const APP_SECRET = process.env.APP_SECRET || '';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT = 'wannadive-provider-salt';

if (!APP_SECRET) {
  console.warn('[WARN] APP_SECRET is not set. Provider API keys are stored insecurely. This is only acceptable for local development.');
}

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, SALT, 32);
}

function encryptApiKey(apiKey: string): string {
  if (!APP_SECRET) {
    return Buffer.from(apiKey).toString('base64');
  }

  const key = deriveKey(APP_SECRET);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptApiKey(encrypted: string): string {
  if (!APP_SECRET) {
    return Buffer.from(encrypted, 'base64').toString('utf8');
  }

  const [ivHex, authTagHex, encryptedData] = encrypted.split(':');
  if (!ivHex || !authTagHex || !encryptedData) {
    throw new Error('Invalid encrypted format');
  }

  const key = deriveKey(APP_SECRET);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export interface ProviderProfile {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyEncrypted: string;
  model: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderProfileWithKey extends Omit<ProviderProfile, 'apiKeyEncrypted'> {
  apiKey: string;
}

function mapDbToProfile(row: db.DbProviderProfile): ProviderProfile {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    apiKeyEncrypted: row.api_key_encrypted,
    model: row.model,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDbToProfileWithKey(row: db.DbProviderProfile): ProviderProfileWithKey {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    apiKey: decryptApiKey(row.api_key_encrypted),
    model: row.model,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProviderService {
  getAll(): ProviderProfile[] {
    const rows = db.getAllProviderProfiles();
    return rows.map(mapDbToProfile);
  }

  getById(id: string): ProviderProfile | null {
    const row = db.getProviderProfile(id);
    return row ? mapDbToProfile(row) : null;
  }

  getByIdWithKey(id: string): ProviderProfileWithKey | null {
    const row = db.getProviderProfile(id);
    return row ? mapDbToProfileWithKey(row) : null;
  }

  getDefault(): ProviderProfile | null {
    const row = db.getDefaultProviderProfile();
    return row ? mapDbToProfile(row) : null;
  }

  getDefaultWithKey(): ProviderProfileWithKey | null {
    const row = db.getDefaultProviderProfile();
    return row ? mapDbToProfileWithKey(row) : null;
  }

  create(profile: { name: string; baseUrl: string; apiKey: string; model: string; isDefault?: boolean }): ProviderProfile {
    const now = new Date().toISOString();
    const id = uuidv4();
    const apiKeyEncrypted = encryptApiKey(profile.apiKey);

    if (profile.isDefault) {
      db.clearDefaultProviderProfiles();
    }

    const dbProfile: db.DbProviderProfile = {
      id,
      name: profile.name,
      base_url: profile.baseUrl,
      api_key_encrypted: apiKeyEncrypted,
      model: profile.model,
      is_default: profile.isDefault ? 1 : 0,
      created_at: now,
      updated_at: now,
    };

    db.createProviderProfile(dbProfile);
    return mapDbToProfile(dbProfile);
  }

  update(id: string, updates: { name?: string; baseUrl?: string; apiKey?: string; model?: string; isDefault?: boolean }): ProviderProfile {
    const existing = db.getProviderProfile(id);
    if (!existing) {
      throw new Error('Provider profile not found');
    }

    const dbUpdates: Partial<Pick<db.DbProviderProfile, 'name' | 'base_url' | 'api_key_encrypted' | 'model' | 'is_default'>> = {};

    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.baseUrl !== undefined) dbUpdates.base_url = updates.baseUrl;
    if (updates.apiKey !== undefined) dbUpdates.api_key_encrypted = encryptApiKey(updates.apiKey);
    if (updates.model !== undefined) dbUpdates.model = updates.model;
    if (updates.isDefault !== undefined) {
      if (updates.isDefault) {
        db.clearDefaultProviderProfiles();
      }
      dbUpdates.is_default = updates.isDefault ? 1 : 0;
    }

    db.updateProviderProfile(id, dbUpdates);

    const updated = db.getProviderProfile(id)!;
    return mapDbToProfile(updated);
  }

  delete(id: string): void {
    const success = db.deleteProviderProfile(id);
    if (!success) {
      throw new Error('Provider profile not found');
    }
  }

  setDefault(id: string): void {
    const existing = db.getProviderProfile(id);
    if (!existing) {
      throw new Error('Provider profile not found');
    }

    db.clearDefaultProviderProfiles();
    db.updateProviderProfile(id, { is_default: 1 });
  }

  getDecryptedApiKey(id: string): string {
    const profile = db.getProviderProfile(id);
    if (!profile) {
      throw new Error('Provider profile not found');
    }
    return decryptApiKey(profile.api_key_encrypted);
  }
}

export const providerService = new ProviderService();
