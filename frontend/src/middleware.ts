import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware for route protection and role-based access control.
 * 
 * This middleware:
 * 1. Checks if user is authenticated (has access_token cookie)
 * 2. Redirects unauthenticated users to /login
 * 3. Preserves the intended destination as returnTo parameter
 * 
 * Role-based redirect (student trying to access /teacher) is handled
 * server-side in layouts after checking actual user role from API.
 */

// Login page path - centralized constant
const LOGIN_PATH = "/";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  
  // Check for authentication cookie
  const accessToken = request.cookies.get("access_token");
  
  // Protected routes that require authentication
  const isProtectedRoute = 
    pathname.startsWith("/teacher") || 
    pathname.startsWith("/student");
  
  // If accessing a protected route without authentication
  if (isProtectedRoute && !accessToken) {
    // Build returnTo URL (preserve pathname and search)
    // Don't manually encode - URLSearchParams handles encoding properly
    const returnToPath = `${pathname}${search}`;
    
    // Redirect to login with returnTo parameter
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("returnTo", returnToPath);
    
    return NextResponse.redirect(loginUrl);
  }
  
  // Allow the request to proceed
  return NextResponse.next();
}

/**
 * Configure which routes this middleware runs on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (images, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg).*)",
  ],
};
