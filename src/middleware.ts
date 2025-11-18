// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED = ["/start", "/campaigns", "/flows", "/topup", "/dashboard"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = !!req.cookies.get("aura_session")?.value;

  // Allow Next internals & auth API
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  // Root (landing): show it if not logged in; redirect if logged in
  if (pathname === "/") {
    if (hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return NextResponse.next(); // show landing page
  }

  // Keep logged-in users out of /auth
  if (pathname.startsWith("/auth") && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Protect app sections
  if (PROTECTED.some((p) => pathname.startsWith(p)) && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Match everything (Next skips static assets listed above)
export const config = { matcher: ["/:path*"] };
