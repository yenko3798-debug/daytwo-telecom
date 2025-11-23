// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "aura_session";
const SESSION_CHECK_PATH = "/api/auth/session";
const PROTECTED = ["/start", "/campaigns", "/flows", "/topup", "/dashboard", "/admin"];

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  balanceCents: number;
};

async function fetchSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader || !cookieHeader.includes(`${SESSION_COOKIE}=`)) {
    return null;
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 1500) : null;

  try {
    const checkUrl = req.nextUrl.clone();
    checkUrl.pathname = SESSION_CHECK_PATH;
    checkUrl.search = "";
    const response = await fetch(checkUrl, {
      headers: {
        cookie: cookieHeader,
      },
      cache: "no-store",
      signal: controller?.signal,
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json().catch(() => null)) as { valid?: boolean; user?: SessionUser } | null;
    if (!data?.valid || !data.user) {
      return null;
    }

    return data.user;
  } catch {
    return null;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function redirectToAuth(req: NextRequest) {
  const url = req.nextUrl.clone();
  const target = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  url.pathname = "/auth";
  if (target && target !== "/auth") {
    url.searchParams.set("redirect", target);
  } else {
    url.searchParams.delete("redirect");
  }
  const res = NextResponse.redirect(url);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

function stripInvalidCookie() {
  const res = NextResponse.next();
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSessionCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  let sessionPromise: Promise<SessionUser | null> | null = null;
  const ensureSession = () => {
    if (!hasSessionCookie) {
      return Promise.resolve<SessionUser | null>(null);
    }
    if (!sessionPromise) {
      sessionPromise = fetchSessionUser(req);
    }
    return sessionPromise;
  };

  if (pathname === "/") {
    if (hasSessionCookie) {
      const sessionUser = await ensureSession();
      if (sessionUser) {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
      return stripInvalidCookie();
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/auth")) {
    if (hasSessionCookie) {
      const sessionUser = await ensureSession();
      if (sessionUser) {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
      return stripInvalidCookie();
    }
    return NextResponse.next();
  }

  const requiresSession = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (requiresSession) {
    if (!hasSessionCookie) {
      return redirectToAuth(req);
    }
    const sessionUser = await ensureSession();
    if (!sessionUser) {
      return redirectToAuth(req);
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ["/:path*"] };
