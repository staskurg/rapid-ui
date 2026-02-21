import Link from "next/link";
import { redirect } from "next/navigation";
import { slugify } from "@/lib/utils/slugify";
import { getCompilation } from "@/lib/compiler/store";
import { logCompilationPageLoad } from "@/lib/ai/metrics";

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

  const displayName =
    entry.resourceNames.find((n) => slugify(n) === resource) ?? resource;

  const currentSpec = entry.specs[resource];
  logCompilationPageLoad({
    id,
    resource,
    displayName,
    resourceNames: entry.resourceNames,
    resourceSlugs: entry.resourceSlugs,
    currentSpec: currentSpec ?? null,
    apiIrSummary: {
      title: entry.apiIr.api.title,
      version: entry.apiIr.api.version,
      resourceCount: entry.apiIr.resources.length,
    },
  });

  return (
    <div className="flex min-h-screen flex-col bg-background p-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold">{displayName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Specs loaded for resource: {resource}
          </p>
          {entry.resourceNames.length > 1 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">
                Resources
              </p>
              <ul className="mt-2 space-y-1">
                {entry.resourceNames.map((name) => {
                  const slug = slugify(name);
                  return (
                    <li key={slug}>
                      <Link
                        href={`/u/${id}/${slug}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
