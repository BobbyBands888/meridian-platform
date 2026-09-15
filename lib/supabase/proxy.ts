import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

const PROTECTED_PREFIXES = ["/dashboard", "/welcome", "/admin"];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

type Options = {
  /** Internal URL to render (the market's route segment). */
  rewriteTo: URL;
  /** Request headers to add for the rendered route, like x-market. */
  extraHeaders: Record<string, string>;
};

/**
 * Refreshes the Supabase auth session on each request and writes updated cookies to the response, then renders the
 * market route the proxy chose. Also sends signed-out visitors on account pages to sign-in. Pages still check auth.
 */
export async function updateSession(request: NextRequest, { rewriteTo, extraHeaders }: Options) {
  // Built from the current request headers each time, so refreshed session cookies reach the rendered route too.
  const render = () => {
    const headers = new Headers(request.headers);
    for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
    return NextResponse.rewrite(rewriteTo, { request: { headers } });
  };

  let response = render();
  const { pathname, search } = request.nextUrl;

  const env = getSupabaseEnv();
  let signedIn = false;

  if (env) {
    const supabase = createServerClient(env.url, env.key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = render();
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        },
      },
    });

    // Do not run code between createServerClient and getClaims(); it validates and refreshes the session.
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
  }

  if (!signedIn && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}
