import { NextResponse, type NextRequest } from "next/server";

// Only skips the login page when a session cookie exists. The refresh cookie is scoped to /api/auth,
// so pages cannot tell an expired session from no session: SessionGuard decides after refresh-on-401.
export function proxy(request: NextRequest) {
  if (request.cookies.has("access_token")) {
    return NextResponse.redirect(new URL("/students", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/login"],
};
