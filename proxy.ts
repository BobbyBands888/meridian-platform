import { NextResponse, type NextRequest } from "next/server";
import { resolveHost } from "@/lib/market-host";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * One app serves every market. The hostname picks the site, and the request is rewritten to that site's internal
 * route: nashvillebuys.com/homes renders app/[market]/homes with market "nashville", and getownvista.com renders
 * app/hub. Visitors never see the internal paths.
 */
export async function proxy(request: NextRequest) {
  // x-forwarded-host first: when a Server Action redirects, Next renders the destination with an internal fetch that
  // loses the original Host header but keeps x-forwarded-host (Vercel sets it on every request too).
  const target = await resolveHost(request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
  const { pathname } = request.nextUrl;
  // A route folder named sitemap.xml under a dynamic segment is treated as a metadata file and doesn't match in
  // production, so the sitemap lives at an internal sitemap-xml route.
  const rest = pathname === "/" ? "" : pathname === "/sitemap.xml" ? "/sitemap-xml" : pathname;

  const rewriteTo = request.nextUrl.clone();
  if (target.kind === "hub") {
    rewriteTo.pathname = `/hub${rest}`;
    const headers = new Headers(request.headers);
    headers.delete("x-market");
    return NextResponse.rewrite(rewriteTo, { request: { headers } });
  }

  rewriteTo.pathname = `/${target.slug}${rest}`;
  return updateSession(request, { rewriteTo, extraHeaders: { "x-market": target.slug } });
}

export const config = {
  matcher: [
    // Skip build assets, images, and the shared icons. Everything else (pages, robots.txt, sitemap.xml) goes through.
    "/((?!_next/static|_next/image|icon.svg|apple-icon|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
