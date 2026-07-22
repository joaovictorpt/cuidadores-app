import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const FAMILY_PREFIX = "/dashboard/familia";
const CAREGIVER_PREFIX = "/dashboard/cuidador";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith(FAMILY_PREFIX) && token.role !== "FAMILY") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname.startsWith(CAREGIVER_PREFIX) && token.role !== "CAREGIVER") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/familia/:path*", "/dashboard/cuidador/:path*"],
};
