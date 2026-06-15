import { SystemsRegistryClient } from "@/components/systems/systems-registry-client";

export default async function SystemsPage({
  searchParams
}: {
  searchParams?: Promise<{ scope?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  return <SystemsRegistryClient scope={sp.scope ?? ""} />;
}
