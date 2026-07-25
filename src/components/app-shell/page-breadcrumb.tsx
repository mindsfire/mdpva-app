import * as React from "react";
import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export interface Crumb {
  label: string;
  /** Omit on the final crumb — the current page is not a link. */
  href?: string;
}

/**
 * Rendered by each page rather than derived from the pathname, because
 * dynamic segments need real labels ("Kavya Bhat", not a uuid) that only
 * the page's own data fetch knows.
 */
export function PageBreadcrumb({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            // Separator is a sibling <li>, never nested inside the item's
            // <li> — nesting them is invalid HTML and breaks hydration.
            <React.Fragment key={`${item.label}-${i}`}>
              <BreadcrumbItem>
                {isLast || !item.href ? (
                  <BreadcrumbPage className="max-w-[45vw] truncate sm:max-w-none">
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={item.href} />}>
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {isLast ? null : <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
