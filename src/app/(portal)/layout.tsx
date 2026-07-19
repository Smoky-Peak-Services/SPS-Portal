import { requireUser } from "@/lib/session";
import { PortalShell } from "@/components/portal-shell";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <PortalShell role={user.role} userName={user.name}>
      {children}
    </PortalShell>
  );
}
