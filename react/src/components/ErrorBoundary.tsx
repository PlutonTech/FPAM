import { Component, type ReactNode } from 'react';
import { reportError } from '../lib/errorReporting';

/** Shows a recoverable message instead of a blank screen, and reports the error. */
export default class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    reportError(Object.assign(error, { stack: `${error.stack || ''}\n${info.componentStack || ''}` }), 'Render');
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Navigating to another page clears the error.
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page"><div className="card empty-state">
        <div className="empty-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
        <div className="empty-title">Something went wrong on this page</div>
        <div className="empty-sub">The problem has been reported. Try again, or go to another page.</div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => this.setState({ error: null })}>Try again</button>
          <button className="btn btn-ghost btn-sm" onClick={() => location.reload()}>Reload</button>
        </div>
      </div></div>
    );
  }
}
