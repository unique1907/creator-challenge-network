import { NextResponse, type NextRequest } from "next/server";

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production" || process.env.CCN_DEPLOYMENT_ENV === "production";
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (isProductionRuntime() && (pathname.startsWith("/internal") || pathname.startsWith("/api/internal"))) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/internal/:path*", "/api/internal/:path*"],
};
