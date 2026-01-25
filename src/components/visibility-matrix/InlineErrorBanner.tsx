import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, X } from "lucide-react";

export interface InlineErrorBannerProps {
  error: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function InlineErrorBanner({ error, onRetry, onDismiss }: InlineErrorBannerProps) {
  if (!error) return null;

  return (
    <div className="bg-red-50 border-b border-red-200">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-800 font-medium">Data Loading Error</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs border-red-300 text-red-700 hover:bg-red-100"
            >
              Retry
            </Button>
          )}
          {onDismiss && (
            <Button
              onClick={onDismiss}
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-red-600 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
