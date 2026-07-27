import { NextResponse } from "next/server";

import { auth } from "@/auth";

// Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts`
// (the exported function name is unconstrained for a default export) —
// see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
/**
 * Reachable without a session.
 *
 * `/onboard` is the member self-service form — members arrive from a shared
 * link with no account at all, so it must never redirect to /login.
 */
const PUBLIC_PATHS = ["/login", "/onboard"];

/**
 * Public paths that additionally bounce *authenticated* users away.
 *
 * Only /login belongs here. /onboard stays reachable while signed in, so an
 * admin can open the form to walk a member through it — bouncing them to the
 * dashboard would make the form impossible for staff to look at.
 */
const SIGNED_IN_REDIRECT_PATHS = ["/login"];

function matchesPath(pathname: string, paths: string[]): boolean {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublicPath = matchesPath(pathname, PUBLIC_PATHS);
  const user = req.auth?.user;

  if (!user) {
    if (isPublicPath) return NextResponse.next();
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated users shouldn't see the login page again.
  if (matchesPath(pathname, SIGNED_IN_REDIRECT_PATHS)) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // The forced password change must not trap a signed-in admin who is looking
  // at the public onboarding form.
  if (
    user.mustChangePassword &&
    pathname !== "/change-password" &&
    !isPublicPath
  ) {
    return NextResponse.redirect(new URL("/change-password", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // The app icons (src/app/icon.png, src/app/apple-icon.png) are requested
    // by the browser from the login page itself, before any session exists —
    // without these exclusions those requests get redirected to /login and the
    // favicon silently never loads.
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|sitemap.xml|robots.txt).*)",
  ],
};
