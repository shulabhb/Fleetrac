import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
};

/** Legacy action detail — open workbench panel via `action` query param. */
export default async function ActionDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const qs = new URLSearchParams({ action: id, tab: "pending" });
  if (sp.returnTo) qs.set("returnTo", sp.returnTo);
  redirect(`${routes.actions()}?${qs.toString()}`);
}
