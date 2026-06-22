import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from 'tdesign-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <div className="text-center">
            <div
              className="text-5xl mb-4"
              style={{ color: 'var(--td-text-color-placeholder)' }}
            >
              ⚠
            </div>
            <h2
              className="text-xl font-semibold mb-2"
              style={{ color: 'var(--td-text-color-primary)' }}
            >
              页面出错了
            </h2>
            <p
              className="text-sm mb-6 max-w-md"
              style={{ color: 'var(--td-text-color-secondary)' }}
            >
              {this.state.error?.message || '发生了未知错误'}
            </p>
            <Button theme="primary" onClick={this.handleReset}>
              重试
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
