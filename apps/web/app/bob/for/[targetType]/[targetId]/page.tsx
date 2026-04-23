import { redirect } from "next/navigation";
import { getBobInvestigationForTarget } from "@/lib/api";
import { routeToBobInvestigation } from "@/lib/routes";

type Props = {
  params: Promise<{ targetType: string; targetId: string }>;
};

export const dynamic = "force-dynamic";

/**
 * Resolver: surface-to-investigation lookup. Incident / system / control
 * pages deep-link to `/bob/for/<type>/<id>` so callers don't need to know the
 * investigation id; this page resolves it and redirects once to the exact
 * Bob investigation detail.
 *
 * Important: Next.js `redirect()` signals navigation by throwing a
 * `NEXT_REDIRECT` error. We MUST NOT wrap it in a try/catch that swallows
 * that error — doing so would cause every successful resolution to fall
 * through to the "missing" branch. Instead, resolve the target URL first,
 * then call `redirect()` exactly once at the end.
 */
export default async function BobForTargetPage({ params }: Props) {
  const { targetType, targetId } = await params;

  let target = `/bob?missing=${encodeURIComponent(
    `${targetType}:${targetId}`
  )}`;

  try {
    const { item } = await getBobInvestigationForTarget(targetType, targetId);
    if (item?.id) {
      target = routeToBobInvestigation(item.id);
    }
  } catch {
    // API/network failure — keep the "missing" fallback.
  }

  redirect(target);
}
