import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: the cookie's presence, not its validity. The API is the real gate.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("access_token");
  const isLogin = request.nextUrl.pathname === "/login";

  if (!hasSession && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
