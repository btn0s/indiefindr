import { adsenseClient } from "@/lib/monetization";
export function GET() {
  const client = adsenseClient();
  return client
    ? new Response(`google.com, ${client.slice(3)}, DIRECT, f08c47fec0942fa0\n`, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
    : new Response(null, { status: 404 });
}
