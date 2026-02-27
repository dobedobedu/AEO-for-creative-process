import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy to enforce authentication on all routes except public ones.
 *
 * Public routes:
 * - /login (login page)
 * - /auth/callback (OAuth callback)
 * - /_next (Next.js internals)
 * - /api/benchmark/scheduled (cron job - uses CRON_SECRET instead)
 * - Static files (favicon, images, etc.)
 *
 * Admin routes:
 * - /admin/* (requires auth + ADMIN_ENABLED environment variable)
 * - /admin/setup is exempt from ADMIN_ENABLED check (setup wizard needs to work before admin is enabled)
 *
 * Setup wizard redirect:
 * - After auth succeeds, checks if initial setup is complete
 * - If not, redirects page routes to /admin/setup
 * - Skips redirect for /admin/setup itself, API routes, and auth paths
 */

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/login",
  "/auth/callback",
  "/_next",
  "/favicon.ico",
  "/api/benchmark/scheduled", // Cron job uses CRON_SECRET for auth
];

// Paths that should never be redirected to the setup wizard
// (to avoid infinite loops and allow the setup flow to work)
const SETUP_EXEMPT_PATHS = [
  "/admin/setup",
  "/api/tenant/setup-status",
  "/api/tenant/setup-complete",
  "/api/tenant/templates",
  "/api/tenant/config",
  "/login",
  "/auth/callback",
];

/**
 * Simple in-memory cache for setup status.
 * Avoids hitting the setup-status API on every middleware invocation.
 * Cache is short-lived (30s) so changes propagate quickly after wizard completes.
 */
let setupStatusCache: { value: boolean; expiresAt: number } | null = null;
const SETUP_CACHE_TTL_MS = 30_000; // 30 seconds
let authBypassLogged = false;

// API routes that require auth (mutation routes + AI call routes)
const PROTECTED_API_ROUTES = [
  "/api/benchmark/run",
  "/api/intents/library",
  "/api/intents/generate",
  "/api/query/generate",
  "/api/query",        // AI query endpoint
  "/api/run/execute",  // AI execution endpoint
  "/api/run/analyze",  // AI analysis endpoint
  "/api/chat",
  "/api/matrix/config", // Admin matrix configuration
];

/**
 * Check whether the initial setup wizard has been completed.
 * Uses an in-memory cache to avoid calling the API on every request.
 * Falls back to "setup complete" (true) on errors to avoid blocking the app.
 */
async function checkSetupComplete(request: NextRequest): Promise<boolean> {
  // Return cached value if still valid
  if (setupStatusCache && Date.now() < setupStatusCache.expiresAt) {
    return setupStatusCache.value;
  }

  try {
    // Build the absolute URL for the internal API call
    const url = new URL("/api/tenant/setup-status", request.url);
    const res = await fetch(url.toString(), {
      headers: {
        // Forward cookies so the API can access the same session if needed
        cookie: request.headers.get("cookie") ?? "",
      },
    });

    if (!res.ok) {
      console.warn(`[middleware] Setup status check failed: ${res.status}`);
      // On error, assume setup is complete to avoid blocking the app
      return true;
    }

    const data = await res.json();
    const setupComplete = data.setupComplete === true;

    // Cache the result
    setupStatusCache = {
      value: setupComplete,
      expiresAt: Date.now() + SETUP_CACHE_TTL_MS,
    };

    return setupComplete;
  } catch (error) {
    console.warn("[middleware] Failed to check setup status:", error);
    // On error, assume setup is complete to avoid blocking the app
    return true;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authDisabled = process.env.AUTH_DISABLED === "true";

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files
  if (pathname.includes(".") && !pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Check admin access - require ADMIN_ENABLED to be set
  // Covers all /admin/* routes, but exempts /admin/setup (setup wizard must remain
  // accessible before admin is enabled to avoid a chicken-and-egg problem)
  const isAdminRoute = pathname.startsWith("/admin/") && !pathname.startsWith("/admin/setup");
  if (isAdminRoute && process.env.NEXT_PUBLIC_ADMIN_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Admin panel is not enabled" },
      { status: 403 }
    );
  }

  // Check Supabase configuration
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Explicit auth bypass for white-label rollout/testing before Supabase is ready.
  // This is opt-in and controlled by AUTH_DISABLED=true in the deployment env.
  if (authDisabled) {
    if (!authBypassLogged) {
      console.info("[proxy] Auth bypass enabled (AUTH_DISABLED=true) - expected in testing mode");
      authBypassLogged = true;
    }
    return NextResponse.next();
  }

  if (!supabaseUrl || !supabaseKey) {
    // In production, fail closed - don't allow unauthenticated access
    if (process.env.NODE_ENV === "production") {
      console.error("[proxy] Supabase not configured in production!");
      return NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 }
      );
    }
    // In development, allow bypass with warning
    console.warn("[proxy] Supabase not configured - auth disabled (dev only)");
    return NextResponse.next();
  }

  // Create a response to potentially modify cookies
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client
  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          // Set cookies on the request for downstream components
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          // Set cookies on the response
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session if needed
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Check if this is a protected API route
  const isProtectedApi = PROTECTED_API_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // If no user and trying to access protected route, redirect or return 401
  if ((!user || error) && (isProtectedApi || !pathname.startsWith("/api/"))) {
    if (pathname.startsWith("/api/")) {
      // Return 401 for API routes
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    // Redirect to login for page routes
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // --- Setup wizard redirect ---
  // After auth succeeds, check if initial setup is complete.
  // Only redirect page routes (not API routes) to avoid breaking API calls.
  // Skip exempt paths to avoid infinite redirect loops.
  const isPageRoute = !pathname.startsWith("/api/");
  const isSetupExempt = SETUP_EXEMPT_PATHS.some((path) =>
    pathname.startsWith(path)
  );

  if (isPageRoute && !isSetupExempt) {
    const setupComplete = await checkSetupComplete(request);
    if (!setupComplete) {
      const setupUrl = new URL("/admin/setup", request.url);
      return NextResponse.redirect(setupUrl);
    }
  }

  // Allow read-only API routes without strict auth (e.g., progress polling)
  // They still work for authenticated users
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
