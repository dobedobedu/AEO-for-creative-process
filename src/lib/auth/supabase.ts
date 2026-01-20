/**
 * Supabase Auth Helpers
 *
 * Server-side: Uses @supabase/ssr with cookies for session management
 * Client-side: Uses @supabase/supabase-js for browser interactions
 */

import { createBrowserClient } from "@supabase/ssr";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Creates a Supabase client for use in the browser.
 * Used for client-side auth operations like signIn, signOut.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Creates a Supabase client for use in Server Components and Route Handlers.
 * Requires cookies() from next/headers.
 *
 * Usage in Server Component:
 * ```ts
 * import { cookies } from "next/headers";
 * const cookieStore = await cookies();
 * const supabase = createSupabaseServerClient(cookieStore);
 * const { data: { user } } = await supabase.auth.getUser();
 * ```
 */
export function createSupabaseServerClient(cookieStore: ReadonlyRequestCookies) {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            // In Server Components, we can't set cookies directly
            // This is handled by the middleware or route handlers
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (cookieStore as any).set(name, value, options);
          });
        } catch {
          // If we're in a Server Component where we can't set cookies,
          // the middleware will handle refreshing the session
        }
      },
    },
  });
}

/**
 * Creates a Supabase client for middleware.
 * This version can both read and write cookies via the response.
 */
export function createSupabaseMiddlewareClient(
  request: Request,
  response: Response
) {
  const cookieStore = new Map<string, string>();

  // Parse cookies from request
  const cookieHeader = request.headers.get("cookie") || "";
  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.split("=");
    if (name) {
      cookieStore.set(name.trim(), rest.join("=").trim());
    }
  });

  return {
    supabase: createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return Array.from(cookieStore.entries()).map(([name, value]) => ({
            name,
            value,
          }));
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value);
            // Set cookie on response
            const cookieValue = `${name}=${value}; Path=${options?.path || "/"}; ${
              options?.maxAge ? `Max-Age=${options.maxAge};` : ""
            } ${options?.httpOnly ? "HttpOnly;" : ""} ${
              options?.secure ? "Secure;" : ""
            } SameSite=${options?.sameSite || "Lax"}`;
            response.headers.append("Set-Cookie", cookieValue);
          });
        },
      },
    }),
    response,
  };
}

/**
 * Type for the authenticated user
 */
export type AuthUser = {
  id: string;
  email: string | undefined;
  name: string | undefined;
};

/**
 * Helper to get the current user from a server context.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(
  cookieStore: ReadonlyRequestCookies
): Promise<AuthUser | null> {
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.user_metadata?.name,
  };
}
