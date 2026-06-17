import { useState } from 'react';
import {
  Form,
  Input,
  Button,
  Select,
  MessagePlugin,
  Tag,
} from 'tdesign-react';
import { useProvider, ProviderConfig } from '../hooks/useProvider';

interface SettingsPageProps {
  onClose: () => void;
}

const COMMON_PROVIDERS = [
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { name: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1' },
  { name: 'Ollama', baseUrl: 'http://localhost:11434/v1' },
];

export function SettingsPage({ onClose }: SettingsPageProps) {
  const { provider, saveProvider, clearProvider, isConfigured } = useProvider();

  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState(provider?.apiKey ?? '');
  const [model, setModel] = useState(provider?.model ?? '');

  // 连接测试状态
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    models?: string[];
    error?: string;
  } | null>(null);

  // 保存中状态
  const [saving, setSaving] = useState(false);

  /** 快捷选择预置 Provider */
  const handleQuickSelect = (preset: (typeof COMMON_PROVIDERS)[number]) => {
    setBaseUrl(preset.baseUrl);
    setTestResult(null);
  };

  /** 测试连接 */
  const testConnection = async () => {
    if (!baseUrl.trim()) {
      MessagePlugin.warning('请先填写 API Base URL');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const params = new URLSearchParams({ baseUrl: baseUrl.trim() });
      if (apiKey.trim()) params.set('apiKey', apiKey.trim());

      const res = await fetch(`/api/models?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.models) {
        setTestResult({ success: true, models: data.models });
        MessagePlugin.success('连接成功');
      } else {
        setTestResult({ success: false, error: data.error || '连接失败' });
        MessagePlugin.error(data.error || '连接失败');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err?.message || '网络错误，请检查 Base URL',
      });
      MessagePlugin.error('网络错误，请检查 Base URL');
    } finally {
      setTesting(false);
    }
  };

  /** 保存配置 */
  const handleSave = () => {
    if (!baseUrl.trim() || !apiKey.trim() || !model.trim()) {
      MessagePlugin.warning('请填写完整的 Provider 配置');
      return;
    }

    setSaving(true);
    try {
      const config: ProviderConfig = {
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        model: model.trim(),
      };
      saveProvider(config);
      MessagePlugin.success('Provider 配置已保存');
      onClose();
    } catch (err: any) {
      MessagePlugin.error(err?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  /** 清除配置 */
  const handleClear = () => {
    clearProvider();
    setBaseUrl('');
    setApiKey('');
    setModel('');
    setTestResult(null);
    MessagePlugin.success('配置已清除');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* 页面标题 */}
        <div>
          <h1
            className="text-2xl font-semibold mb-2"
            style={{ color: 'var(--td-text-color-primary)' }}
          >
            Provider 配置
          </h1>
          <p style={{ color: 'var(--td-text-color-secondary)' }}>
            配置 OpenAI 兼容的 LLM 接入点，用于对话和 Agent 调度
          </p>
        </div>

        {/* 当前状态指示 */}
        {isConfigured && (
          <div
            className="flex items-center gap-3 p-3 rounded-lg"
            style={{ backgroundColor: 'var(--td-bg-color-component)' }}
          >
            <Tag theme="success" variant="light">
              已配置
            </Tag>
            <span
              className="text-sm font-mono"
              style={{ color: 'var(--td-text-color-secondary)' }}
            >
              {provider!.baseUrl} / {provider!.model}
            </span>
          </div>
        )}

        {/* 常见 Provider 快捷选择 */}
        <div>
          <h2
            className="text-base font-medium mb-3"
            style={{ color: 'var(--td-text-color-primary)' }}
          >
            常见 Provider
          </h2>
          <div className="flex flex-wrap gap-2">
            {COMMON_PROVIDERS.map((p) => (
              <Button
                key={p.name}
                size="small"
                variant={baseUrl === p.baseUrl ? 'base' : 'outline'}
                theme={baseUrl === p.baseUrl ? 'primary' : 'default'}
                onClick={() => handleQuickSelect(p)}
              >
                {p.name}
              </Button>
            ))}
          </div>
        </div>

        {/* 配置表单 */}
        <Form labelAlign="top">
          {/* API Base URL */}
          <Form.FormItem
            label="API Base URL"
            requiredMark
            help="OpenAI 兼容接口地址，以 /v1 结尾"
          >
            <Input
              value={baseUrl}
              onChange={(v) => {
                setBaseUrl(v as string);
                setTestResult(null);
              }}
              placeholder="https://api.openai.com/v1"
            />
          </Form.FormItem>

          {/* API Key */}
          <Form.FormItem label="API Key" requiredMark>
            <Input
              type="password"
              value={apiKey}
              onChange={(v) => setApiKey(v as string)}
              placeholder="sk-..."
            />
          </Form.FormItem>

          {/* Model */}
          <Form.FormItem
            label="Model"
            requiredMark
            help={
              testResult?.models?.length
                ? `可用模型：${testResult.models.slice(0, 8).join(', ')}${testResult.models.length > 8 ? '...' : ''}`
                : '填写模型名称，或先测试连接获取可用列表'
            }
          >
            {testResult?.models?.length ? (
              <Select
                value={model}
                onChange={(v) => setModel(v as string)}
                placeholder="选择模型"
                filterable
                options={testResult.models.map((m) => ({
                  label: m,
                  value: m,
                }))}
              />
            ) : (
              <Input
                value={model}
                onChange={(v) => setModel(v as string)}
                placeholder="gpt-4o"
              />
            )}
          </Form.FormItem>

          {/* 测试连接 */}
          <Form.FormItem>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                loading={testing}
                onClick={testConnection}
                disabled={!baseUrl.trim()}
              >
                测试连接
              </Button>

              {testResult && (
                <span
                  className="text-sm"
                  style={{
                    color: testResult.success
                      ? 'var(--td-success-color)'
                      : 'var(--td-error-color)',
                  }}
                >
                  {testResult.success
                    ? `✓ 连接成功，发现 ${testResult.models?.length ?? 0} 个模型`
                    : `✗ ${testResult.error}`}
                </span>
              )}
            </div>
          </Form.FormItem>
        </Form>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            theme="primary"
            loading={saving}
            onClick={handleSave}
          >
            保存配置
          </Button>

          <Button variant="outline" onClick={onClose}>
            取消
          </Button>

          {isConfigured && (
            <Button variant="text" theme="danger" onClick={handleClear}>
              清除配置
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
