import { redirect } from "next/navigation";
import { getBobInvestigationForTarget } from "@/lib/api";

type Props = {
  params: Promise<{ targetType: string; targetId: string }>;
};

export const dynamic = "force-dynamic";

/**
 * Resolver: surface-to-investigation lookup. Incident/system/control pages
 * deep-link to `/bob/for/<type>/<id>` so callers do not need to know the
 * investigation id; Bob decides which investigation (if any) is relevant.
 */
export default async function BobForTargetPage({ params }: Props) {
  const { targetType, targetId } = await params;
  try {
    const { item } = await getBobInvestigationForTarget(targetType, targetId);
    if (item) {
      redirect(`/bob/${item.id}`);
    }
  } catch {
    // fall through to no-investigation state
  }
  redirect(`/bob?missing=${targetType}:${targetId}`);
}
