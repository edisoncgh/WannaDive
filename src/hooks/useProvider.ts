import { useState, useEffect, useCallback } from 'react';

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ProviderProfile {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'rush_provider_profile_id';

export function useProvider() {
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProvider = useCallback(async () => {
    try {
      const savedId = localStorage.getItem(STORAGE_KEY);

      if (savedId) {
        const res = await fetch(`/api/settings/provider-profiles/${savedId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setProvider(data.profile);
            return;
          }
        }
      }

      const defaultRes = await fetch('/api/settings/default-provider');
      if (defaultRes.ok) {
        const data = await defaultRes.json();
        if (data.profile) {
          setProvider(data.profile);
          localStorage.setItem(STORAGE_KEY, data.profile.id);
          return;
        }
      }

      setProvider(null);
    } catch {
      setProvider(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProvider();
  }, [loadProvider]);

  const selectProvider = useCallback((profile: ProviderProfile) => {
    localStorage.setItem(STORAGE_KEY, profile.id);
    setProvider(profile);
  }, []);

  const clearProvider = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setProvider(null);
  }, []);

  const isConfigured = !!provider;

  const saveProvider = useCallback(async (config: ProviderConfig, name?: string) => {
    const profileName = name || config.baseUrl.split('//')[1]?.split('/')[0] || 'Default';
    const res = await fetch('/api/settings/provider-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: profileName,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        isDefault: true,
      }),
    });

    if (!res.ok) {
      throw new Error('Failed to save provider profile');
    }

    const data = await res.json();
    setProvider(data.profile);
    localStorage.setItem(STORAGE_KEY, data.profile.id);
    return data.profile;
  }, []);

  return {
    provider,
    loading,
    selectProvider,
    clearProvider,
    isConfigured,
    saveProvider,
    reload: loadProvider,
  };
}
