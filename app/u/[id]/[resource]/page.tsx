import Link from "next/link";
import { redirect } from "next/navigation";
import { slugify } from "@/lib/utils/slugify";
import { getCompilation } from "@/lib/compiler/store";
import { logCompilationPageLoad } from "@/lib/ai/metrics";
import { CompiledUIContent } from "@/components/compiler/CompiledUIContent";

export default async function GeneratedUIPage({
  params,
}: {
  params: Promise<{ id: string; resource: string }>;
}) {
  const { id, resource } = await params;
  if (!id?.trim()) {
    redirect("/");
  }
  const entry = getCompilation(id);

  if (!entry) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-destructive">
            UI no longer available
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This UI is no longer available. Re-upload the OpenAPI spec to regenerate.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Go to compiler
          </Link>
        </div>
      </div>
    );
  }

  const currentSpec = entry.specs[resource];
  const displayName =
    entry.resourceNames.find((n) => slugify(n) === resource) ?? resource;

  if (!currentSpec) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-destructive">
            Resource not found
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The resource &quot;{resource}&quot; does not exist in this compilation.
          </p>
          <Link
            href={`/u/${id}`}
            className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Go to first resource
          </Link>
        </div>
      </div>
    );
  }

  logCompilationPageLoad({
    id,
    resource,
    displayName,
    resourceNames: entry.resourceNames,
    resourceSlugs: entry.resourceSlugs,
    currentSpec,
    apiIrSummary: {
      title: entry.apiIr.api.title,
      version: entry.apiIr.api.version,
      resourceCount: entry.apiIr.resources.length,
    },
  });

  return (
    <CompiledUIContent
      id={id}
      resource={resource}
      spec={currentSpec}
      resourceNames={entry.resourceNames}
      resourceSlugs={entry.resourceSlugs}
      diffFromPrevious={entry.diffFromPrevious}
      updatedAt={entry.updatedAt}
    />
  );
}
