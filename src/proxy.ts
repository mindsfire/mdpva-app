import { NextResponse } from "next/server";

import { auth } from "@/auth";

// Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts`
// (the exported function name is unconstrained for a default export) —
// see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
const PUBLIC_PATHS = ["/login"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const user = req.auth?.user;

  if (!user) {
    if (isPublicPath) return NextResponse.next();
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated users shouldn't see the login page again.
  if (isPublicPath) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  if (user.mustChangePassword && pathname !== "/change-password") {
    return NextResponse.redirect(new URL("/change-password", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // icon.svg replaced the old favicon.ico (see src/app/icon.svg) — the
    // browser requests it from the login page itself, before any session
    // exists, so it must stay excluded the same way favicon.ico was.
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icon.svg|sitemap.xml|robots.txt).*)",
  ],
};
