'use client';

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { ModelConfig, ModelSettingsModal } from '@/components/ModelSettingsModal';
import { Switch } from './ui/switch';
import { useConfig } from '@/contexts/ConfigContext';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface SummaryModelSettingsProps {
  refetchTrigger?: number; // Change this to trigger refetch
}

const SUMMARY_LANGUAGE_OPTIONS = [
  { value: 'system', label: 'System default', mode: 'system' as const, language: null },
  { value: 'transcript', label: 'Same as transcript', mode: 'transcript' as const, language: null },
  { value: 'English', label: 'English', mode: 'fixed' as const, language: 'English' },
  { value: 'Russian', label: 'Russian', mode: 'fixed' as const, language: 'Russian' },
  { value: 'Polish', label: 'Polish', mode: 'fixed' as const, language: 'Polish' },
  { value: 'German', label: 'German', mode: 'fixed' as const, language: 'German' },
  { value: 'Spanish', label: 'Spanish', mode: 'fixed' as const, language: 'Spanish' },
  { value: 'French', label: 'French', mode: 'fixed' as const, language: 'French' },
  { value: 'custom', label: 'Custom...', mode: 'custom' as const, language: null },
];

const getSummaryLanguageSelectValue = (config: ModelConfig) => {
  if (config.summaryLanguageMode === 'fixed' && config.summaryLanguageValue) {
    return config.summaryLanguageValue;
  }
  return config.summaryLanguageMode || 'system';
};

const getSystemLanguageName = () => {
  if (typeof window === 'undefined') return null;

  const locale = window.navigator.language || window.navigator.languages?.[0];
  if (!locale) return null;

  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
    return displayNames.of(locale.split('-')[0]) || null;
  } catch {
    return null;
  }
};

export function SummaryModelSettings({ refetchTrigger }: SummaryModelSettingsProps) {
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    provider: 'ollama',
    model: 'llama3.2:latest',
    whisperModel: 'large-v3',
    apiKey: null,
    ollamaEndpoint: null,
    summaryLanguageMode: 'system',
    summaryLanguageValue: null
  });

  const { isAutoSummary, toggleIsAutoSummary } = useConfig();

  // Reusable fetch function
  const fetchModelConfig = useCallback(async () => {
    try {
      const data = await invoke('api_get_model_config') as any;
      if (data && data.provider !== null) {
        // Fetch API key if not included and provider requires it
        if (data.provider !== 'ollama' && data.provider !== 'builtin-ai' && !data.apiKey) {
          try {
            const apiKeyData = await invoke('api_get_api_key', {
              provider: data.provider
            }) as string;
            data.apiKey = apiKeyData;
          } catch (err) {
            console.error('Failed to fetch API key:', err);
          }
        }
        // Fetch Custom OpenAI config if that's the active provider
        if (data.provider === 'custom-openai') {
          try {
            const customConfig = (await invoke('api_get_custom_openai_config')) as any;
            if (customConfig) {
              data.customOpenAIDisplayName = customConfig.displayName || null;
              data.customOpenAIEndpoint = customConfig.endpoint || null;
              data.customOpenAIModel = customConfig.model || null;
              data.customOpenAIApiKey = customConfig.apiKey || null;
              data.maxTokens = customConfig.maxTokens || null;
              data.temperature = customConfig.temperature || null;
              data.topP = customConfig.topP || null;
              // For custom-openai, model field should match customOpenAIModel
              data.model = customConfig.model || data.model;
            }
          } catch (err) {
            console.error('Failed to fetch custom OpenAI config:', err);
          }
        }
        setModelConfig({
          ...data,
          summaryLanguageMode: data.summaryLanguageMode || 'system',
          summaryLanguageValue: data.summaryLanguageValue || null,
        });
      }
    } catch (error) {
      console.error('Failed to fetch model config:', error);
      toast.error('Failed to load model settings');
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchModelConfig();
  }, [fetchModelConfig]);

  // Refetch when trigger changes (optional external control)
  useEffect(() => {
    if (refetchTrigger !== undefined && refetchTrigger > 0) {
      fetchModelConfig();
    }
  }, [refetchTrigger, fetchModelConfig]);

  // Listen for model config updates from other components
  useEffect(() => {
    const setupListener = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<ModelConfig>('model-config-updated', (event) => {
        console.log('SummaryModelSettings received model-config-updated event:', event.payload);
        setModelConfig({
          ...event.payload,
          summaryLanguageMode: event.payload.summaryLanguageMode || 'system',
          summaryLanguageValue: event.payload.summaryLanguageValue || null,
        });
      });

      return unlisten;
    };

    let cleanup: (() => void) | undefined;
    setupListener().then(fn => cleanup = fn);

    return () => {
      cleanup?.();
    };
  }, []);

  // Save handler
  const handleSaveModelConfig = async (config: ModelConfig) => {
    try {
      await invoke('api_save_model_config', {
        provider: config.provider,
        model: config.model,
        whisperModel: config.whisperModel,
        apiKey: config.apiKey,
        ollamaEndpoint: config.ollamaEndpoint,
        summaryLanguageMode: config.summaryLanguageMode || 'system',
        summaryLanguageValue: config.summaryLanguageValue || null,
      });

      setModelConfig(config);

      // Emit event to sync other components
      const { emit } = await import('@tauri-apps/api/event');
      await emit('model-config-updated', config);

      toast.success('Model settings saved successfully');
    } catch (error) {
      console.error('Error saving model config:', error);
      toast.error('Failed to save model settings');
    }
  };

  const saveSummaryLanguageConfig = async (nextConfig: ModelConfig) => {
    try {
      await invoke('api_save_model_config', {
        provider: nextConfig.provider,
        model: nextConfig.model,
        whisperModel: nextConfig.whisperModel,
        apiKey: nextConfig.apiKey,
        ollamaEndpoint: nextConfig.ollamaEndpoint,
        summaryLanguageMode: nextConfig.summaryLanguageMode || 'system',
        summaryLanguageValue: nextConfig.summaryLanguageValue || null,
      });

      setModelConfig(nextConfig);

      const { emit } = await import('@tauri-apps/api/event');
      await emit('model-config-updated', nextConfig);

      toast.success('Summary language saved successfully');
    } catch (error) {
      console.error('Error saving summary language:', error);
      toast.error('Failed to save summary language');
    }
  };

  const handleSummaryLanguageSelect = async (value: string) => {
    const option = SUMMARY_LANGUAGE_OPTIONS.find((item) => item.value === value);
    if (!option) return;

    const nextConfig: ModelConfig = {
      ...modelConfig,
      summaryLanguageMode: option.mode,
      summaryLanguageValue: option.mode === 'fixed'
        ? option.language
        : option.mode === 'system'
          ? getSystemLanguageName()
          : null,
    };

    setModelConfig(nextConfig);

    if (option.mode !== 'custom') {
      await saveSummaryLanguageConfig(nextConfig);
    }
  };

  const handleCustomLanguageBlur = async () => {
    if (modelConfig.summaryLanguageMode !== 'custom') return;
    const customLanguage = modelConfig.summaryLanguageValue?.trim();
    await saveSummaryLanguageConfig({
      ...modelConfig,
      summaryLanguageValue: customLanguage || null,
    });
  };

  return (
    <div className='flex flex-col gap-4'>
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Auto Summary</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Auto Generating summary after meeting completion(Stopping)</p>
          </div>
          <Switch checked={isAutoSummary} onCheckedChange={toggleIsAutoSummary} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Summary Output Language</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Choose the language used for generated summaries, independent of the spoken language.
        </p>

        <div className="space-y-3">
          <Select
            value={getSummaryLanguageSelectValue(modelConfig)}
            onValueChange={handleSummaryLanguageSelect}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select summary language" />
            </SelectTrigger>
            <SelectContent>
              {SUMMARY_LANGUAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {modelConfig.summaryLanguageMode === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="summary-custom-language">Custom language name</Label>
              <Input
                id="summary-custom-language"
                value={modelConfig.summaryLanguageValue || ''}
                onChange={(event) => setModelConfig((prev) => ({
                  ...prev,
                  summaryLanguageValue: event.target.value,
                }))}
                onBlur={handleCustomLanguageBlur}
                placeholder="e.g. Brazilian Portuguese"
              />
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Summary Model Configuration</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          Configure the AI model used for generating meeting summaries.
        </p>

        <ModelSettingsModal
          modelConfig={modelConfig}
          setModelConfig={setModelConfig}
          onSave={handleSaveModelConfig}
          skipInitialFetch={true}
        />
      </div>
    </div>
  );
}
