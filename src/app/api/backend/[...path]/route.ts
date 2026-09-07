import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { mintBackendToken } from "@/lib/server/backendToken";

const BACKEND_URL = process.env.BACKEND_URL;

const ALLOWED_PREFIXES = [
  "ai",
  "batches",
  "chat",
  "code",
  "cohorts",
  "courses",
  "file",
  "hva",
  "milestones",
  "organizations",
  "scorecards",
  "tasks",
  "uploads",
  "users",
];

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "authorization",
  "cookie",
]);

// FastAPI registers collection routes at "/cohorts/", so "/cohorts" 307s once.
// Remember where each path redirected to and go straight there next time.
const redirectCache = new Map<string, string>();

function isAllowed(segments: string[]): boolean {
  if (segments.length === 0) return false;
  if (segments.some((s) => s === ".." || s === "." || s.includes("\\"))) return false;
  return ALLOWED_PREFIXES.includes(segments[0]);
}

function forwardedHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  return headers;
}

async function handler(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  if (!BACKEND_URL) {
    console.error("BACKEND_URL is not set");
    return NextResponse.json({ detail: "Server misconfigured" }, { status: 500 });
  }

  const { path } = await context.params;

  if (!isAllowed(path)) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  let token: string;
  try {
    token = mintBackendToken(userId, session?.user?.email ?? "");
  } catch (error) {
    console.error("Cannot mint backend token:", error);
    return NextResponse.json({ detail: "Server misconfigured" }, { status: 500 });
  }

  const headers = forwardedHeaders(request);
  headers.set("Authorization", `Bearer ${token}`);

  const hasBody = !["GET", "HEAD"].includes(request.method);
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const backendOrigin = new URL(BACKEND_URL).origin;
  const basePath = path.join("/");
  let target = `${BACKEND_URL}/${redirectCache.get(basePath) ?? basePath}${request.nextUrl.search}`;
  let method = request.method;

  try {
    let upstream: Response | undefined;

    // FastAPI 307s between /scorecards and /scorecards/, but Next strips the
    // trailing slash before this handler runs, so we cannot pre-empt it.
    // Follow redirects here instead: handing one to the browser would leak the
    // backend URL and bounce off Next's normalisation forever.
    for (let hop = 0; hop < 5; hop++) {
      upstream = await fetch(target, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : body,
        redirect: "manual",
        cache: "no-store",
      } as RequestInit);

      const location = upstream.headers.get("location");
      if (!location || upstream.status < 300 || upstream.status >= 400) break;

      const resolved = new URL(location, target);
      if (resolved.origin !== backendOrigin) break;

      if (upstream.status === 303) method = "GET";
      if (method === request.method) {
        redirectCache.set(basePath, resolved.pathname.replace(/^\//, ""));
      }
      target = resolved.toString();
      upstream = undefined;
    }

    if (!upstream) {
      return NextResponse.json({ detail: "Too many redirects" }, { status: 502 });
    }

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    // Anything still redirecting points somewhere we would not follow; strip it
    // so the backend URL never reaches the browser.
    responseHeaders.delete("location");

    // Pass the body through untouched so streaming responses (/ai/chat is
    // application/x-ndjson) reach the browser incrementally.
    return new NextResponse(upstream.body, {
      status: upstream.status >= 300 && upstream.status < 400 ? 502 : upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`Proxy request failed for ${path.join("/")}:`, error);
    return NextResponse.json({ detail: "Upstream request failed" }, { status: 502 });
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;

export const dynamic = "force-dynamic";
