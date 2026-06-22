import { Button } from 'tdesign-react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = '📭', title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-8">
      <div className="text-center">
        <div
          className="text-5xl mb-4"
          style={{ color: 'var(--td-text-color-placeholder)' }}
        >
          {icon}
        </div>
        <h3
          className="text-lg font-semibold mb-2"
          style={{ color: 'var(--td-text-color-primary)' }}
        >
          {title}
        </h3>
        {description && (
          <p
            className="text-sm mb-6 max-w-sm"
            style={{ color: 'var(--td-text-color-secondary)' }}
          >
            {description}
          </p>
        )}
        {actionLabel && onAction && (
          <Button theme="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
