import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;

const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

function isRateLimited(ip: string): { limited: boolean; remaining: number } {
  const now = Date.now();
  const record = ipRequestCounts.get(ip);

  if (!record || now > record.resetAt) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return { limited: true, remaining: 0 };
  }

  record.count++;
  return { limited: false, remaining: MAX_REQUESTS_PER_WINDOW - record.count };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const rateLimitedPaths = [
    "/api/games/submit",
    "/api/games/batch",
  ];

  const shouldRateLimit = rateLimitedPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (!shouldRateLimit) {
    return NextResponse.next();
  }

  if (pathname.includes("/suggestions/refresh")) {
    const ip = getClientIp(request);
    const { limited, remaining } = isRateLimited(ip);

    if (limited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    return response;
  }

  const ip = getClientIp(request);
  const { limited, remaining } = isRateLimited(ip);

  if (limited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": "60",
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Remaining", remaining.toString());
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
