import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  private isFrench(): boolean {
    try { return localStorage.getItem('vision-lang') !== 'en'; } catch { return true; }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center min-h-[200px]">
          <AlertTriangle className="w-8 h-8 text-destructive mb-3" />
          <p className="text-sm font-bold text-foreground mb-1">
            {this.isFrench() ? 'Une erreur est survenue' : 'Something went wrong'}
          </p>
          <p className="text-xs text-muted-foreground mb-4 max-w-sm">
            {this.state.error?.message ??
              (this.isFrench()
                ? 'Une erreur inattendue est survenue.'
                : 'An unexpected error occurred.')}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs font-bold text-primary hover:underline"
          >
            {this.isFrench() ? 'Réessayer' : 'Try again'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
