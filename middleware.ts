// middleware.ts
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { createClient } from "@/utils/supabase/server";

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - common image extensions (svg, png, jpg, jpeg, gif, webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export async function middleware(request: NextRequest) {
  // 1. Update the session. This returns a response that may include updated cookies/headers.
  const sessionResponse = await updateSession(request);

  // 2. Create a Supabase SSR client using the current request and the sessionResponse.
  //    This ensures that any cookies set by updateSession are taken into account.
  const supabase = await createClient();

  // 3. Securely fetch the user by revalidating the auth token.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error(error);
  }

  // 4. Get URL details.
  const url = request.nextUrl;
  const searchParams = url.searchParams.toString();
  const path = `${url.pathname}${searchParams.length > 0 ? `?${searchParams}` : ""}`;

  // 5. Retrieve and normalize the hostname.
  let hostname = request.headers
    .get("host")!
    .replace(".localhost:3000", `.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`);

  // Special handling for Vercel preview deployment URLs.
  if (
    hostname.includes("---") &&
    hostname.endsWith(`.${process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_SUFFIX}`)
  ) {
    hostname = `${hostname.split("---")[0]}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`;
  }

  let finalResponse: NextResponse;

  // 6. Multi-tenancy routing logic:

  // a. For the "app" subdomain, protect pages with SSR authentication.
  if (hostname === `app.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`) {
    if (!user && path !== "/login") {
      // If not authenticated, redirect to the login page.
      finalResponse = NextResponse.redirect(new URL("/login", request.url));
    } else if (user && path === "/login") {
      // If authenticated, redirect away from the login page.
      finalResponse = NextResponse.redirect(new URL("/", request.url));
    } else {
      // Rewrite to serve pages from the `/app` folder.
      // For example, a request to app.xxx.com/profile rewrites to /app/profile.
      finalResponse = NextResponse.rewrite(
        new URL(`/app${path === "/" ? "" : path}`, request.url),
      );
    }
  }

  // c. For the landing page (root domain or localhost) serve pages from `/home`.
  else if (
    hostname === "localhost:3000" ||
    hostname === process.env.NEXT_PUBLIC_ROOT_DOMAIN
  ) {
    finalResponse = NextResponse.rewrite(
      new URL(`/home${path === "/" ? "" : path}`, request.url),
    );
  }
  // d. For all other subdomains, rewrite to a dynamic route for tenant-specific pages.
  else {
    finalResponse = NextResponse.rewrite(
      new URL(`/${hostname}${path}`, request.url),
    );
  }

  // 7. Merge headers from sessionResponse into the finalResponse.
  sessionResponse.headers.forEach((value, key) => {
    finalResponse.headers.set(key, value);
  });

  return finalResponse;
}
