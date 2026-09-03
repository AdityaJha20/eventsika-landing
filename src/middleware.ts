import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Explicit exemption: Public admin login endpoint must be reachable to authenticate
  if (pathname === "/api/admin/auth/login") {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }

  const isApiAdmin = pathname.startsWith("/api/admin/");

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    if (isApiAdmin) {
      return NextResponse.json(
        { success: false, error: "Authentication service unavailable." },
        { status: 503 }
      );
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Verify authenticated user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Authoritative check on server-controlled app_metadata.role
  const role = user?.app_metadata?.role;

  if (!user || role !== "admin") {
    if (isApiAdmin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Administrator privileges required." },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
