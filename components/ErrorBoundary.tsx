import React from "react";
import { Button } from "./ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component that catches JavaScript errors in child components,
 * logs them, and displays a fallback UI instead of crashing the entire app.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error for debugging purposes (Requirement 7.3)
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
    
    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Render custom fallback if provided, otherwise use default
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <DefaultErrorFallback 
          error={this.state.error} 
          onRetry={this.handleRetry} 
        />
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
}

/**
 * Default fallback UI shown when an error is caught.
 * Provides retry functionality (Requirement 7.4)
 */
function DefaultErrorFallback({ error, onRetry }: DefaultErrorFallbackProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 bg-slate-800/50 rounded-lg border border-slate-700">
      <div className="text-red-400 mb-4">
        <svg 
          className="w-12 h-12" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
          />
        </svg>
      </div>
      
      <h2 className="text-xl font-semibold text-white mb-2">
        Something went wrong
      </h2>
      
      <p className="text-slate-400 text-center mb-4 max-w-md">
        An unexpected error occurred. You can try again or refresh the page.
      </p>
      
      {error && (
        <details className="mb-4 text-sm text-slate-500 max-w-md">
          <summary className="cursor-pointer hover:text-slate-400">
            Error details
          </summary>
          <pre className="mt-2 p-2 bg-slate-900 rounded text-xs overflow-auto max-h-32">
            {error.message}
          </pre>
        </details>
      )}
      
      <div className="flex gap-3">
        <Button 
          onClick={onRetry}
          variant="default"
          className="bg-purple-600 hover:bg-purple-700"
        >
          Try Again
        </Button>
        <Button 
          onClick={() => window.location.reload()}
          variant="outline"
          className="border-slate-600 text-slate-300 hover:bg-slate-700"
        >
          Refresh Page
        </Button>
      </div>
    </div>
  );
}

export { ErrorBoundary, DefaultErrorFallback };
