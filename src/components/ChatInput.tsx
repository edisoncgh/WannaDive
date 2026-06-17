import { useRef, useCallback } from 'react';
import { ChatSender } from '@tdesign-react/chat';

interface ChatInputProps {
  inputValue: string;
  isLoading: boolean;
  onSend: (message: string) => void;
  onStop: () => void;
  onChange: (value: string) => void;
}

export function ChatInput({
  inputValue,
  isLoading,
  onSend,
  onStop,
  onChange,
}: ChatInputProps) {
  const chatSenderRef = useRef<any>(null);

  const handleSend = useCallback((e: any) => {
    const content = e?.detail?.message || e?.detail || e?.message || inputValue;
    if (content && typeof content === 'string' && content.trim()) {
      onSend(content.trim());
    } else if (inputValue.trim()) {
      onSend(inputValue.trim());
    }
  }, [inputValue, onSend]);

  const handleChange = useCallback((e: any) => {
    const value = e?.detail ?? e ?? '';
    onChange(typeof value === 'string' ? value : '');
  }, [onChange]);

  return (
    <div
      className="px-4 pb-6 pt-4"
      style={{ backgroundColor: 'var(--td-bg-color-page)' }}
    >
      <div className="max-w-3xl mx-auto">
        <ChatSender
          ref={chatSenderRef}
          value={inputValue}
          placeholder="输入消息..."
          loading={isLoading}
          autosize={{ minRows: 1, maxRows: 6 }}
          actions={['send']}
          onSend={handleSend}
          onStop={onStop}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
