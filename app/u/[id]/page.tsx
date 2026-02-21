import { redirect } from "next/navigation";
import { getCompilation } from "@/lib/compiler/store";

export default async function CompilationRootPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id?.trim()) {
    redirect("/");
  }
  const entry = getCompilation(id);

  if (!entry) {
    redirect("/");
  }

  const firstResource = entry.resourceSlugs[0];
  if (!firstResource) {
    redirect("/");
  }

  redirect(`/u/${id}/${firstResource}`);
}
