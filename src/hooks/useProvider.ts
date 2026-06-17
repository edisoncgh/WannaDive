import { useState, useCallback } from 'react';

export interface ProviderConfig {
  baseUrl: string;   // e.g., "https://api.openai.com/v1"
  apiKey: string;
  model: string;     // e.g., "gpt-4o"
}

const STORAGE_KEY = 'rush_provider_config';

export function useProvider() {
  const [provider, setProvider] = useState<ProviderConfig | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const saveProvider = useCallback((config: ProviderConfig) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    setProvider(config);
  }, []);

  const clearProvider = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setProvider(null);
  }, []);

  const isConfigured = !!(provider !== null && provider.baseUrl && provider.apiKey && provider.model);

  return {
    provider,
    saveProvider,
    clearProvider,
    isConfigured,
  };
}
