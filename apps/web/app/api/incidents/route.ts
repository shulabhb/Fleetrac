import { getIncidents } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * JSON list for client-side incident triage dock (same-origin, avoids browser CORS to API).
 */
export async function GET() {
  try {
    const data = await getIncidents();
    return Response.json(data);
  } catch {
    return Response.json({ items: [] as unknown[] }, { status: 502 });
  }
}
