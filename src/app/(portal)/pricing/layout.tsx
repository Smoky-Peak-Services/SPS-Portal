import { Suspense } from "react";
import { SectionTabs } from "@/components/patterns/section-tabs";
import { resolveActiveScope } from "@/features/scope/active-scope";
import {
  listScopeDivisions,
  readActiveScopeCookie,
} from "@/features/scope/get-active-scope";
import { ActiveScopeBar } from "@/features/scope/components/active-scope-bar";

export default async function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [divisions, cookie] = await Promise.all([
    listScopeDivisions(),
    readActiveScopeCookie(),
  ]);
  const scope = resolveActiveScope({ divisions, cookie });

  return (
    <div className="space-y-4">
      <SectionTabs
        tabs={[
          { label: "Labor Rates", href: "/pricing/labor-rates" },
          { label: "Complexity Multipliers", href: "/pricing/complexity" },
        ]}
      />
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
