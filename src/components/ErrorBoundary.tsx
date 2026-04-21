import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Canonical Vision Affichage logo served from Shopify CDN. Duplicated from
// Navbar on purpose: the ErrorBoundary must keep rendering even if the
// component tree (where a shared logo constant would live) is the exact
// thing that just crashed, so we inline the URL here to avoid any import
// graph dependency that could itself throw during catch.
const VA_LOGO_SRC =
  'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/Asset_1_d5d82510-0b83-4657-91b7-3ac1992ee697.svg?height=90&v=1769614651';

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

  // Hard reset: wipe both storages then reload. Catches the "bad persisted
  // cart / stale Shopify checkout / corrupt auth token" class of crashes
  // where plain Retry keeps re-hydrating the same broken state.
  private clearCachesAndReload = () => {
    try { localStorage.clear(); } catch { /* private mode / quota — fall through */ }
    try { sessionStorage.clear(); } catch { /* same */ }
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const fr = this.isFrench();
      const rawMessage = (this.state.error?.message && this.state.error.message.trim()) || '';
      const rawStack = this.state.error?.stack?.trim() || '';

      return (
        <div
          role="alert"
          className="min-h-[60vh] flex items-center justify-center px-4 py-12 bg-background"
        >
          <div className="w-full max-w-md rounded-2xl border border-[hsl(var(--navy))]/10 bg-card shadow-sm p-8 text-center">
            {/* Brand lockup: the logo signals "this is still Vision Affichage,
                not a raw browser crash page" even when the app tree below has
                blown up. onError hides the image so a CDN outage doesn't
                produce a broken-image icon stacked on top of an error screen. */}
            <img
              src={VA_LOGO_SRC}
              alt="Vision Affichage"
              width={120}
              height={30}
              decoding="async"
              className="block h-7 w-auto mx-auto mb-6"
              onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
            />

            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
              style={{ backgroundColor: 'hsl(var(--destructive) / 0.1)' }}
            >
              <AlertTriangle
                className="w-6 h-6 text-destructive"
                aria-hidden="true"
              />
            </div>

            <h1 className="text-xl font-bold text-foreground mb-2 font-serif">
              {fr ? "Quelque chose s'est mal passé" : 'Something went wrong'}
            </h1>

            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              {fr
                ? "Nous n'avons pas pu charger cette page. Essayez à nouveau, ou videz la cache si le problème persiste."
                : "We couldn't load this page. Try again, or clear the cache if the problem persists."}
            </p>

            {/* Technical details collapsed by default — most users don't want
                to see "Cannot read property 'x' of undefined", but support
                tickets are much easier when the reporter can copy the raw
                message. Only render the <details> block if we actually have
                something to show. */}
            {(rawMessage || rawStack) && (
              <details className="mb-6 text-left">
                <summary
                  className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded inline-block"
                >
                  {fr ? 'Détails techniques' : 'Technical details'}
                </summary>
                <pre
                  className="mt-2 p-3 rounded-md bg-muted text-[10px] leading-relaxed text-muted-foreground overflow-auto max-h-48 whitespace-pre-wrap break-words"
                >
                  {rawMessage && <span className="font-bold">{rawMessage}</span>}
                  {rawMessage && rawStack ? '\n\n' : ''}
                  {rawStack}
                </pre>
              </details>
            )}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-opacity"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                {fr ? 'Réessayer' : 'Try again'}
              </button>

              <button
                type="button"
                onClick={() => { window.location.href = '/'; }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[hsl(var(--navy))]/15 bg-background text-foreground text-sm font-semibold hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors"
              >
                <Home className="w-4 h-4" aria-hidden="true" />
                {fr ? "Retour à l'accueil" : 'Back home'}
              </button>

              <button
                type="button"
                onClick={this.clearCachesAndReload}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                {fr ? 'Vider la cache et recharger' : 'Clear cache and reload'}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
