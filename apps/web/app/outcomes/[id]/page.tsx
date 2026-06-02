import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

type Props = {
  params: Promise<{ id: string }>;
};

/** Legacy outcome detail — Evidence Library is the canonical measurement surface. */
export default async function OutcomeDetailPage({ params }: Props) {
  await params;
  redirect(routes.outcomes());
}
