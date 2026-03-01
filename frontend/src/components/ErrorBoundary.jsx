import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
          <div className="text-4xl mb-4">Something went wrong</div>
          <p className="text-focus-text-muted mb-6 max-w-md">
            An unexpected error occurred. Try refreshing the page.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-4 py-2 bg-focus-teal text-white rounded-lg hover:bg-focus-teal/80 transition-colors"
          >
            Refresh Page
          </button>
          {this.state.error && (
            <details className="mt-4 text-xs text-focus-text-dim max-w-lg">
              <summary className="cursor-pointer">Error details</summary>
              <pre className="mt-2 text-left overflow-auto p-2 bg-focus-surface rounded">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
