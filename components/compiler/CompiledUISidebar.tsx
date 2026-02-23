"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { slugify } from "@/lib/utils/slugify";
import { cn } from "@/lib/utils";

interface CompiledUISidebarProps {
  id: string;
  currentResource: string;
  resourceNames: string[];
  resourceSlugs: string[];
}

export function CompiledUISidebar({
  id,
  currentResource,
  resourceNames,
  resourceSlugs,
}: CompiledUISidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground",
        "border-sidebar-border"
      )}
    >
      <div className="flex flex-col gap-1 p-3">
        <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">
          Resources
        </p>
        <nav className="flex flex-col gap-0.5">
          {resourceNames.map((name, i) => {
            const slug = resourceSlugs[i] ?? slugify(name);
            const href = `/u/${id}/${slug}`;
            const isActive = pathname === href || currentResource === slug;
            return (
              <Link
                key={slug}
                href={href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                {name}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
