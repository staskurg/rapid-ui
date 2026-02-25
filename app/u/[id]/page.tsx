import { redirect } from "next/navigation";
import { getCompilation } from "@/lib/compiler/store";

export default async function CompilationRootPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ resource?: string }>;
}) {
  const { id } = await params;
  const { resource: resourceParam } = await searchParams;

  if (!id?.trim()) {
    redirect("/");
  }
  const entry = await getCompilation(id);

  if (!entry) {
    redirect("/");
  }

  const firstResource = entry.resourceSlugs[0];
  if (!firstResource) {
    redirect("/");
  }

  // If ?resource=slug is present and valid, use it; else use first resource
  const targetResource =
    resourceParam && entry.resourceSlugs.includes(resourceParam)
      ? resourceParam
      : firstResource;

  redirect(`/u/${id}/${targetResource}`);
}
