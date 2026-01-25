import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";

export interface MatrixDataBoundaryProps {
  children: ReactNode;
  error: string | null;
  loading?: boolean;
  onRetry?: () => void;
}

export function MatrixDataBoundary({
  children,
  error,
  loading = false,
  onRetry,
}: MatrixDataBoundaryProps) {
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] px-6">
        <Card className="max-w-md w-full border-red-200 bg-red-50/50">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <CardTitle className="text-lg">Data Loading Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-red-600">{error}</p>
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-[var(--ink)]/60">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading matrix data...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
