import {
  SectionTabs,
  type SectionTab,
} from "@/components/patterns/section-tabs";
import { requireUser } from "@/lib/session";
import { userCan } from "@/config/permissions";

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
  tabs.push({ label: "Consumables", disabled: true });

  return (
    <div className="space-y-4">
      <SectionTabs tabs={tabs} />
      {children}
    </div>
  );
}
