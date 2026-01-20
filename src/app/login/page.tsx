"use client";

import { createSupabaseBrowserClient } from "@/lib/auth/supabase";
import { useState } from "react";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f1e8] flex flex-col items-center justify-center">
      {/* Logo / Brand */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-[#1f3b2c] tracking-tight">
          AI Visibility Baseline
        </h1>
        <p className="mt-2 text-sm text-[#1e1b16]/60">
          Lakewood Ranch Brand Monitoring
        </p>
      </div>

      {/* Login Card */}
      <div className="bg-white rounded-lg shadow-md border border-[#e3dacb] p-8 w-full max-w-sm">
        <h2 className="text-lg font-semibold text-[#1e1b16] mb-6 text-center">
          Sign in to continue
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-[#e3dacb] rounded-lg hover:bg-[#f6f1e8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* Google Icon */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="text-sm font-medium text-[#1e1b16]">
            {isLoading ? "Signing in..." : "Sign in with Google"}
          </span>
        </button>

        <p className="mt-6 text-xs text-center text-[#1e1b16]/50">
          Only authorized team members can access this dashboard.
        </p>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-[#1e1b16]/40">
        Powered by Supabase Auth
      </p>
    </div>
  );
}
