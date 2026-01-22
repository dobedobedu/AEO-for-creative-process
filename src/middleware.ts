import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware to enforce authentication on all routes except public ones.
 *
 * Public routes:
 * - /login (login page)
 * - /auth/callback (OAuth callback)
 * - /_next (Next.js internals)
 * - /api/benchmark/scheduled (cron job - uses CRON_SECRET instead)
 * - Static files (favicon, images, etc.)
 */

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/login",
  "/auth/callback",
  "/_next",
  "/favicon.ico",
  "/api/benchmark/scheduled", // Cron job uses CRON_SECRET for auth
];

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files
  if (pathname.includes(".") && !pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Check Supabase configuration
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // In production, fail closed - don't allow unauthenticated access
    if (process.env.NODE_ENV === "production") {
      console.error("[middleware] Supabase not configured in production!");
      return NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 }
      );
    }
    // In development, allow bypass with warning
    console.warn("[middleware] Supabase not configured - auth disabled (dev only)");
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
