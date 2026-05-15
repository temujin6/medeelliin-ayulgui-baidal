// Route protection proxy (Next.js 16 — replaces middleware.ts)
// Runs on the Edge Runtime, so only edge-compatible APIs are available.
// `jose` is edge-compatible; bcryptjs / nodemailer are NOT used here.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJwt } from "@/lib/auth";

// Routes that require an authenticated session
const PROTECTED_PREFIXES = ["/dashboard"];

// Routes that should redirect to /dashboard if already authenticated
const AUTH_ROUTES = ["/login", "/signup", "/verify", "/passkey"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionCookie = request.cookies.get("session")?.value;
  const payload = sessionCookie ? await verifyJwt(sessionCookie) : null;
  const isAuthenticated = payload !== null;

  // Redirect logged-in users away from auth pages
  if (isAuthenticated && AUTH_ROUTES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Guard protected routes
  if (
    !isAuthenticated &&
    PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
