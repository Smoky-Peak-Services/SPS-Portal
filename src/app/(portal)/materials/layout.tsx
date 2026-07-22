import { Suspense } from "react";
import {
  SectionTabs,
  type SectionTab,
} from "@/components/patterns/section-tabs";
import { requireUser } from "@/lib/session";
import { userCan } from "@/config/permissions";
import { resolveActiveScope } from "@/features/scope/active-scope";
import {
  listScopeDivisions,
  readActiveScopeCookie,
} from "@/features/scope/get-active-scope";
import { ActiveScopeBar } from "@/features/scope/components/active-scope-bar";

export default async function MaterialsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const tabs: SectionTab[] = [{ label: "Materials", href: "/materials" }];

  if (userCan(user, "pricing.access")) {
    tabs.push({ label: "Recurring Fees", href: "/materials/recurring" });
  }
  if (userCan(user, "materials.import_export")) {
    tabs.push({ label: "Catalog I/O", href: "/materials/import-export" });
  }
  tabs.push({ label: "Consumables", href: "/materials/consumables" });

  const [divisions, cookie] = await Promise.all([
    listScopeDivisions(),
    readActiveScopeCookie(),
  ]);
  const scope = resolveActiveScope({ divisions, cookie });

  return (
    <div className="space-y-4">
      <SectionTabs tabs={tabs} />
      {scope ? (
        <Suspense fallback={null}>
          <ActiveScopeBar
            divisions={divisions}
            initialDivisionSlug={scope.divisionSlug}
            initialSegment={scope.segment}
          />
        </Suspense>
      ) : null}
      {children}
    </div>
  );
}
