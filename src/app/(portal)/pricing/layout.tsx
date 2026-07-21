import { SectionTabs } from "@/components/patterns/section-tabs";

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <SectionTabs
        tabs={[
          { label: "Labor Rates", href: "/pricing/labor-rates" },
          { label: "Complexity Multipliers", href: "/pricing/complexity" },
        ]}
      />
      {children}
    </div>
  );
}
